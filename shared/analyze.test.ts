import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { fallbackRecommendation, normalizeRecommendation, type ImageSummary } from './analyze'

const summary: ImageSummary = { width: 1200, height: 800, aspectRatio: 1.5, averageBrightness: .5, brightnessStdDev: .2, averageSaturation: .4, edgeDensity: .35, complexity: .4, transparencyRatio: 0, dominantColors: ['#112233'], allowed: { gridLongEdge: [24, 160], colorCounts: [8, 16, 32, 48, 64] } }

describe('推荐参数', () => {
  it('本地推荐始终处于允许范围', () => {
    const result = fallbackRecommendation(summary)
    assert.ok(result.gridLongEdge >= 24)
    assert.ok(summary.allowed.colorCounts.includes(result.colorCount))
  })
  it('非法模型响应会回退', () => assert.deepEqual(normalizeRecommendation({ broken: true }, summary), fallbackRecommendation(summary)))
  it('颜色数会归一到最近选项', () => assert.equal(normalizeRecommendation({ gridLongEdge: 80, colorCount: 50, contrast: 1, saturation: 1, reason: '测试' }, summary).colorCount, 48))
})
