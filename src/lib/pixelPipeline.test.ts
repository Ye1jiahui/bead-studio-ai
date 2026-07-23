import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { areaSample, buildPalette, processPixels } from './pixelPipeline'

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
})
