import type { ImageSummary } from '../../shared/analyze'

export type RGB = [number, number, number]

function rgbToHex([r, g, b]: RGB) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

export function summarizePixels(data: Uint8ClampedArray, width: number, height: number): ImageSummary {
  const total = width * height
  const step = Math.max(1, Math.floor(total / 30000))
  const histogram = new Map<string, number>()
  const brightness: number[] = []
  let saturationSum = 0
  let transparent = 0
  let edgeHits = 0
  let edgeChecks = 0

  for (let pixel = 0; pixel < total; pixel += step) {
    const index = pixel * 4
    const r = data[index] / 255
    const g = data[index + 1] / 255
    const b = data[index + 2] / 255
    const alpha = data[index + 3] / 255
    if (alpha < 0.5) transparent += 1
    const light = 0.2126 * r + 0.7152 * g + 0.0722 * b
    brightness.push(light)
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    saturationSum += max === 0 ? 0 : (max - min) / max
    const quantized: RGB = [Math.round(data[index] / 32) * 32, Math.round(data[index + 1] / 32) * 32, Math.round(data[index + 2] / 32) * 32].map((value) => Math.min(255, value)) as RGB
    const color = rgbToHex(quantized)
    histogram.set(color, (histogram.get(color) || 0) + 1)

    if (pixel % width < width - 1) {
      const next = index + 4
      const delta = Math.abs(data[index] - data[next]) + Math.abs(data[index + 1] - data[next + 1]) + Math.abs(data[index + 2] - data[next + 2])
      if (delta > 96) edgeHits += 1
      edgeChecks += 1
    }
  }

  const samples = brightness.length || 1
  const averageBrightness = brightness.reduce((sum, value) => sum + value, 0) / samples
  const variance = brightness.reduce((sum, value) => sum + (value - averageBrightness) ** 2, 0) / samples
  const edgeDensity = edgeHits / Math.max(1, edgeChecks)
  const brightnessStdDev = Math.sqrt(variance)
  return {
    width,
    height,
    aspectRatio: width / height,
    averageBrightness,
    brightnessStdDev,
    averageSaturation: saturationSum / samples,
    edgeDensity,
    complexity: Math.min(1, edgeDensity * 0.65 + brightnessStdDev * 1.2),
    transparencyRatio: transparent / samples,
    dominantColors: [...histogram.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([color]) => color),
    allowed: { gridLongEdge: [24, 160], colorCounts: [8, 16, 32, 48, 64] },
  }
}

export function loadImage(file: File): Promise<{ bitmap: ImageBitmap; data: ImageData }> {
  return createImageBitmap(file, { imageOrientation: 'from-image' }).then((bitmap) => {
    const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('无法读取图片')
    context.drawImage(bitmap, 0, 0, width, height)
    return { bitmap, data: context.getImageData(0, 0, width, height) }
  })
}

export function calculateGrid(width: number, height: number, longEdge: number) {
  return width >= height
    ? { width: longEdge, height: Math.max(1, Math.round(longEdge * height / width)) }
    : { width: Math.max(1, Math.round(longEdge * width / height)), height: longEdge }
}
