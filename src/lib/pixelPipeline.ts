import { MARD_PALETTE } from '../data/mardPalette'

export type PixelRGB = [number, number, number]
export type BeadSwatch = { code: string; hex: string; rgb: PixelRGB; count: number }

export type PixelPipelineInput = {
  image: ImageData
  gridWidth: number
  gridHeight: number
  colorCount: number
  contrast: number
  saturation: number
  isolateSubject?: boolean
}

export type ProcessedPixel = PixelRGB | null

function clamp(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function adjustColor(color: PixelRGB, contrast: number, saturation: number): PixelRGB {
  // 限制模型建议的增益，避免人像肤色被过度拉伸。
  const safeContrast = Math.max(0.92, Math.min(1.18, contrast))
  const safeSaturation = Math.max(0.9, Math.min(1.16, saturation))
  const contrasted = color.map((value) => (value - 128) * safeContrast + 128) as PixelRGB
  const luminance = contrasted[0] * 0.2126 + contrasted[1] * 0.7152 + contrasted[2] * 0.0722
  return contrasted.map((value) => clamp(luminance + (value - luminance) * safeSaturation)) as PixelRGB
}

export function areaSample(image: ImageData, gridWidth: number, gridHeight: number): PixelRGB[] {
  const pixels: PixelRGB[] = []
  for (let y = 0; y < gridHeight; y += 1) {
    const startY = Math.floor(y * image.height / gridHeight)
    const endY = Math.max(startY + 1, Math.ceil((y + 1) * image.height / gridHeight))
    for (let x = 0; x < gridWidth; x += 1) {
      const startX = Math.floor(x * image.width / gridWidth)
      const endX = Math.max(startX + 1, Math.ceil((x + 1) * image.width / gridWidth))
      let red = 0; let green = 0; let blue = 0; let weight = 0
      for (let sourceY = startY; sourceY < Math.min(endY, image.height); sourceY += 1) {
        for (let sourceX = startX; sourceX < Math.min(endX, image.width); sourceX += 1) {
          const index = (sourceY * image.width + sourceX) * 4
          const alpha = image.data[index + 3] / 255
          // 透明区域按白色底板合成，避免出现黑边。
          red += image.data[index] * alpha + 255 * (1 - alpha)
          green += image.data[index + 1] * alpha + 255 * (1 - alpha)
          blue += image.data[index + 2] * alpha + 255 * (1 - alpha)
          weight += 1
        }
      }
      pixels.push([clamp(red / weight), clamp(green / weight), clamp(blue / weight)])
    }
  }
  return pixels
}

function colorDistance(a: PixelRGB, b: PixelRGB) {
  return Math.sqrt(perceptualDistance(a, b))
}

/**
 * 根据画面边缘建立背景色模型，再从四周向内扩张背景区域。
 * 这是完全在浏览器运行的主体分离：不上传原图，也不依赖额外云服务。
 */
export function buildSubjectMask(pixels: PixelRGB[], width: number, height: number): boolean[] {
  if (!pixels.length || width < 2 || height < 2) return pixels.map(() => true)
  const edge: PixelRGB[] = []
  for (let x = 0; x < width; x += 1) { edge.push(pixels[x], pixels[(height - 1) * width + x]) }
  for (let y = 1; y < height - 1; y += 1) { edge.push(pixels[y * width], pixels[y * width + width - 1]) }
  const background = edge.reduce<PixelRGB>((sum, color) => [sum[0] + color[0], sum[1] + color[1], sum[2] + color[2]], [0, 0, 0])
    .map((value) => value / edge.length) as PixelRGB
  const spread = edge.reduce((sum, color) => sum + colorDistance(color, background), 0) / edge.length
  const threshold = Math.max(34, Math.min(82, spread * 1.75 + 22))
  const backgroundMask = pixels.map(() => false)
  const queue: number[] = []
  const enqueue = (index: number) => {
    if (!backgroundMask[index] && colorDistance(pixels[index], background) <= threshold) { backgroundMask[index] = true; queue.push(index) }
  }
  for (let x = 0; x < width; x += 1) { enqueue(x); enqueue((height - 1) * width + x) }
  for (let y = 1; y < height - 1; y += 1) { enqueue(y * width); enqueue(y * width + width - 1) }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor]
    const x = index % width
    const y = Math.floor(index / width)
    if (x > 0) enqueue(index - 1)
    if (x + 1 < width) enqueue(index + 1)
    if (y > 0) enqueue(index - width)
    if (y + 1 < height) enqueue(index + width)
  }
  // 去除主体边缘的一格杂色，使最终轮廓更适合实际摆豆。
  const subject = backgroundMask.map((value) => !value)
  return subject.map((value, index) => {
    if (!value) return false
    const x = index % width
    const y = Math.floor(index / width)
    let neighbours = 0
    if (x > 0 && subject[index - 1]) neighbours += 1
    if (x + 1 < width && subject[index + 1]) neighbours += 1
    if (y > 0 && subject[index - width]) neighbours += 1
    if (y + 1 < height && subject[index + width]) neighbours += 1
    return neighbours >= 2
  })
}

function perceptualDistance(a: PixelRGB, b: PixelRGB) {
  // 红均值加权色差比直接 RGB 欧氏距离更接近人眼感知。
  const redMean = (a[0] + b[0]) / 2
  const red = a[0] - b[0]
  const green = a[1] - b[1]
  const blue = a[2] - b[2]
  return (2 + redMean / 256) * red * red + 4 * green * green + (2 + (255 - redMean) / 256) * blue * blue
}

function initialPalette(pixels: PixelRGB[], count: number): PixelRGB[] {
  const luminance = (color: PixelRGB) => color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722
  const sorted = [...pixels].sort((a, b) => luminance(a) - luminance(b))
  const palette: PixelRGB[] = []
  for (let index = 0; index < count; index += 1) {
    const position = Math.min(sorted.length - 1, Math.round((index + 0.5) * sorted.length / count))
    palette.push([...sorted[position]] as PixelRGB)
  }
  return palette
}

export function buildPalette(pixels: PixelRGB[], count: number): PixelRGB[] {
  let palette = initialPalette(pixels, Math.min(count, pixels.length))
  // 迭代聚类让有限颜色优先覆盖照片中占比更大的区域，同时保留亮度层次。
  for (let iteration = 0; iteration < 10; iteration += 1) {
    const sums = palette.map(() => [0, 0, 0, 0])
    for (const pixel of pixels) {
      let best = 0
      let bestDistance = Number.POSITIVE_INFINITY
      palette.forEach((candidate, index) => {
        const distance = perceptualDistance(pixel, candidate)
        if (distance < bestDistance) { best = index; bestDistance = distance }
      })
      sums[best][0] += pixel[0]; sums[best][1] += pixel[1]; sums[best][2] += pixel[2]; sums[best][3] += 1
    }
    palette = palette.map((color, index) => sums[index][3]
      ? [clamp(sums[index][0] / sums[index][3]), clamp(sums[index][1] / sums[index][3]), clamp(sums[index][2] / sums[index][3])]
      : color)
  }
  return palette
}

export function processPixels(input: PixelPipelineInput) {
  const sampled = areaSample(input.image, input.gridWidth, input.gridHeight)
    .map((color) => adjustColor(color, input.contrast, input.saturation))
  const subjectMask = input.isolateSubject ? buildSubjectMask(sampled, input.gridWidth, input.gridHeight) : sampled.map(() => true)
  // 主体模式下只让有效格参与聚类，避免被大量背景颜色挤占调色板名额。
  const activePixels = sampled.filter((_, index) => subjectMask[index])
  const customPalette = buildPalette(activePixels.length ? activePixels : sampled, input.colorCount)
  // 先提炼照片主色，再映射到最接近的 MARD 标准色，避免全色卡直接匹配产生太多零散色号。
  const mappedColors = customPalette.map((color) => MARD_PALETTE.reduce((best, candidate) =>
    perceptualDistance(color, candidate.rgb) < perceptualDistance(color, best.rgb) ? candidate : best))
  const selected = [...new Map(mappedColors.map((color) => [color.code, color])).values()]
  const counts = new Map<string, number>()
  const pixels: ProcessedPixel[] = sampled.map((color, index) => {
    if (!subjectMask[index]) return null
    const bead = selected.reduce((best, candidate) =>
      perceptualDistance(color, candidate.rgb) < perceptualDistance(color, best.rgb) ? candidate : best)
    counts.set(bead.code, (counts.get(bead.code) || 0) + 1)
    return bead.rgb
  })
  const swatches: BeadSwatch[] = selected.map((color) => ({ ...color, count: counts.get(color.code) || 0 }))
    .filter((color) => color.count > 0).sort((a, b) => b.count - a.count)
  return { pixels, palette: selected.map((color) => color.rgb), swatches, beadCount: pixels.filter(Boolean).length }
}
