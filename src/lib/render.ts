import type { RGB } from './image'
import type { BeadSwatch } from './pixelPipeline'

export function renderBeads(canvas: HTMLCanvasElement, pixels: RGB[], width: number, height: number, showGrid: boolean, scale = 1, swatches: BeadSwatch[] = [], showCodes = false) {
  const cell = Math.max(1, Math.round(scale))
  canvas.width = width * cell
  canvas.height = height * cell
  const context = canvas.getContext('2d')
  if (!context) return
  pixels.forEach(([r, g, b], index) => {
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
      const code = codes.get(color.join(',')) || ''
      const lightness = color[0] * .2126 + color[1] * .7152 + color[2] * .0722
      context.fillStyle = lightness > 145 ? 'rgba(20,24,20,.78)' : 'rgba(255,255,255,.88)'
      context.fillText(code, (index % width + .5) * cell, (Math.floor(index / width) + .5) * cell, cell - 1)
    })
  }
}
