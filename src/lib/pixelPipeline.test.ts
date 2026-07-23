import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { areaSample, buildPalette, buildSubjectMask, processPixels } from './pixelPipeline'

describe('拼豆像素管线', () => {
  it('区域采样会对格子内像素取平均而不是只取中心点', () => {
    const image = { width: 2, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255, 200, 100, 50, 255]), colorSpace: 'srgb' } as ImageData
    assert.deepEqual(areaSample(image, 1, 1), [[100, 50, 25]])
  })

  it('生成的调色板不超过指定颜色数', () => {
    const palette = buildPalette([[0, 0, 0], [10, 10, 10], [240, 230, 220], [255, 255, 255]], 2)
    assert.equal(palette.length, 2)
  })

  it('输出 MARD 色号与准确颗数', () => {
    const image = { width: 2, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]), colorSpace: 'srgb' } as ImageData
    const result = processPixels({ image, gridWidth: 2, gridHeight: 1, colorCount: 2, contrast: 1, saturation: 1 })
    assert.equal(result.swatches.reduce((sum, swatch) => sum + swatch.count, 0), 2)
    assert.ok(result.swatches.every((swatch) => /^[A-HM]\d+$/.test(swatch.code)))
  })

  it('主体识别会移除与四周连通的背景', () => {
    const background: [number, number, number] = [245, 245, 245]
    const subject: [number, number, number] = [20, 60, 180]
    const pixels = Array.from({ length: 25 }, () => background)
    for (const index of [7, 11, 12, 13, 17]) pixels[index] = subject
    const mask = buildSubjectMask(pixels, 5, 5)
    assert.equal(mask[12], true)
    assert.equal(mask[0], false)
  })

  it('主体模式的空白格不计入拼豆总数', () => {
    const data: number[] = []
    for (let y = 0; y < 5; y += 1) for (let x = 0; x < 5; x += 1) data.push(...(x === 2 && y >= 1 && y <= 3 ? [20, 60, 180, 255] : [245, 245, 245, 255]))
    const image = { width: 5, height: 5, data: new Uint8ClampedArray(data), colorSpace: 'srgb' } as ImageData
    const result = processPixels({ image, gridWidth: 5, gridHeight: 5, colorCount: 2, contrast: 1, saturation: 1, isolateSubject: true })
    assert.ok(result.beadCount < 25)
    assert.equal(result.swatches.reduce((sum, swatch) => sum + swatch.count, 0), result.beadCount)
  })
})
