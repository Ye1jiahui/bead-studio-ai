import type { BeadSwatch, ProcessedPixel } from './pixelPipeline'

export function renderBeads(canvas: HTMLCanvasElement, pixels: ProcessedPixel[], width: number, height: number, showGrid: boolean, scale = 1, swatches: BeadSwatch[] = [], showCodes = false) {
  const cell = Math.max(1, Math.round(scale))
  canvas.width = width * cell
  canvas.height = height * cell
  const context = canvas.getContext('2d')
  if (!context) return
  pixels.forEach((color, index) => {
    if (!color) return
    const [r, g, b] = color
    const x = index % width
    const y = Math.floor(index / width)
    context.fillStyle = `rgb(${r} ${g} ${b})`
    context.fillRect(x * cell, y * cell, cell, cell)
  })
  if (showGrid && cell >= 3) {
    // 小尺寸预览中一像素网格会遮掉大量画面，因此根据格子尺寸动态降低强度。
    context.strokeStyle = cell <= 4 ? 'rgba(25, 31, 26, .08)' : 'rgba(25, 31, 26, .14)'
    context.lineWidth = cell <= 4 ? .5 : 1
    const offset = context.lineWidth / 2
    for (let x = 0; x <= width; x += 1) { context.beginPath(); context.moveTo(x * cell + offset, 0); context.lineTo(x * cell + offset, canvas.height); context.stroke() }
    for (let y = 0; y <= height; y += 1) { context.beginPath(); context.moveTo(0, y * cell + offset); context.lineTo(canvas.width, y * cell + offset); context.stroke() }
  }
  if (showCodes && cell >= 10 && swatches.length) {
    const codes = new Map(swatches.map((swatch) => [swatch.rgb.join(','), swatch.code]))
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = `600 ${Math.max(5, Math.floor(cell * .38))}px monospace`
    pixels.forEach((color, index) => {
      if (!color) return
      const code = codes.get(color.join(',')) || ''
      const lightness = color[0] * .2126 + color[1] * .7152 + color[2] * .0722
      context.fillStyle = lightness > 145 ? 'rgba(20,24,20,.78)' : 'rgba(255,255,255,.88)'
      context.fillText(code, (index % width + .5) * cell, (Math.floor(index / width) + .5) * cell, cell - 1)
    })
  }
}

export function renderPatternSheet(canvas: HTMLCanvasElement, pixels: ProcessedPixel[], width: number, height: number, swatches: BeadSwatch[], title: string) {
  const cell = 42
  const margin = 72
  const header = 120
  const footer = 46
  canvas.width = width * cell + margin * 2
  canvas.height = height * cell + header + footer
  const context = canvas.getContext('2d')
  if (!context) return
  context.fillStyle = '#fffdf8'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#283127'
  context.font = '700 30px sans-serif'
  context.fillText(title, margin, 47)
  context.fillStyle = '#697064'
  context.font = '18px monospace'
  context.fillText(`${width} × ${height} 格 · ${pixels.filter(Boolean).length.toLocaleString()} 颗 · ${swatches.length} 色`, margin, 82)
  const codes = new Map(swatches.map((swatch) => [swatch.rgb.join(','), swatch.code]))
  pixels.forEach((color, index) => {
    const x = margin + (index % width) * cell
    const y = header + Math.floor(index / width) * cell
    if (!color) {
      context.fillStyle = '#ffffff'
      context.fillRect(x, y, cell, cell)
      return
    }
    context.fillStyle = `rgb(${color[0]} ${color[1]} ${color[2]})`
    context.fillRect(x, y, cell, cell)
    const lightness = color[0] * .2126 + color[1] * .7152 + color[2] * .0722
    context.fillStyle = lightness > 145 ? '#172019' : '#ffffff'
    context.font = `700 ${codes.get(color.join(','))!.length > 2 ? 15 : 17}px monospace`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText(codes.get(color.join(',')) || '', x + cell / 2, y + cell / 2, cell - 5)
  })
  context.strokeStyle = '#687066'
  context.lineWidth = 1
  context.beginPath()
  for (let x = 0; x <= width; x += 1) { context.moveTo(margin + x * cell + .5, header); context.lineTo(margin + x * cell + .5, header + height * cell) }
  for (let y = 0; y <= height; y += 1) { context.moveTo(margin, header + y * cell + .5); context.lineTo(margin + width * cell, header + y * cell + .5) }
  context.stroke()
  context.fillStyle = '#7c8176'
  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'
  context.font = '15px sans-serif'
  context.fillText('每格均显示 MARD 色号；空白格不需要摆豆。', margin, canvas.height - 17)
}
