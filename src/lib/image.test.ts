import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { calculateGrid, summarizePixels } from './image'

describe('图像处理', () => {
  it('保持横图比例', () => assert.deepEqual(calculateGrid(1600, 900, 80), { width: 80, height: 45 }))
  it('保持竖图比例', () => assert.deepEqual(calculateGrid(900, 1600, 80), { width: 45, height: 80 }))
  it('生成合规摘要', () => {
    const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255])
    const summary = summarizePixels(data, 2, 1)
    assert.equal(summary.aspectRatio, 2)
    assert.ok(summary.dominantColors.length > 0)
  })
})
