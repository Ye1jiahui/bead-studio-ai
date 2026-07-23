export const COLOR_OPTIONS = [8, 16, 32, 48, 64] as const
export type ImageSummary = { width: number; height: number; aspectRatio: number; averageBrightness: number; brightnessStdDev: number; averageSaturation: number; edgeDensity: number; complexity: number; transparencyRatio: number; dominantColors: string[]; allowed: { gridLongEdge: [number, number]; colorCounts: number[] } }
export type Recommendation = { gridLongEdge: number; colorCount: number; contrast: number; saturation: number; reason: string }
function inRange(value: unknown, min: number, max: number) { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max }
export function parseImageSummary(input: unknown): ImageSummary {
  if (!input || typeof input !== 'object') throw new Error('摘要格式错误')
  const value = input as Partial<ImageSummary>
  if (!Number.isInteger(value.width) || !inRange(value.width, 1, 20000) || !Number.isInteger(value.height) || !inRange(value.height, 1, 20000)) throw new Error('尺寸错误')
  for (const key of ['averageBrightness', 'brightnessStdDev', 'averageSaturation', 'edgeDensity', 'complexity', 'transparencyRatio'] as const) if (!inRange(value[key], 0, 1)) throw new Error('统计值错误')
  if (!inRange(value.aspectRatio, .01, 100) || !Array.isArray(value.dominantColors) || value.dominantColors.length < 1 || value.dominantColors.length > 8 || value.dominantColors.some((color) => !/^#[0-9a-f]{6}$/i.test(color))) throw new Error('颜色摘要错误')
  if (!value.allowed || !Array.isArray(value.allowed.gridLongEdge) || value.allowed.gridLongEdge.length !== 2 || !Array.isArray(value.allowed.colorCounts) || !value.allowed.colorCounts.length) throw new Error('选项错误')
  return value as ImageSummary
}
export function fallbackRecommendation(summary: ImageSummary): Recommendation {
  const detail = Math.max(summary.edgeDensity, summary.complexity)
  return { gridLongEdge: Math.round(Math.min(128, Math.max(40, 48 + detail * 72))), colorCount: detail > .62 ? 64 : detail > .38 ? 48 : 32, contrast: summary.brightnessStdDev < .18 ? 1.16 : 1.04, saturation: summary.averageSaturation < .22 ? 1.12 : 1, reason: '已根据照片的细节密度和色彩分布生成本地推荐。' }
}
export function normalizeRecommendation(input: unknown, summary: ImageSummary): Recommendation {
  if (!input || typeof input !== 'object') return fallbackRecommendation(summary)
  const value = input as Partial<Recommendation>
  if (!Number.isInteger(value.gridLongEdge) || !Number.isInteger(value.colorCount) || !inRange(value.contrast, .8, 1.4) || !inRange(value.saturation, .8, 1.4) || typeof value.reason !== 'string' || !value.reason || value.reason.length > 120) return fallbackRecommendation(summary)
  const nearest = summary.allowed.colorCounts.reduce((best, color) => Math.abs(color - value.colorCount!) < Math.abs(best - value.colorCount!) ? color : best)
  return { gridLongEdge: Math.min(summary.allowed.gridLongEdge[1], Math.max(summary.allowed.gridLongEdge[0], value.gridLongEdge!)), colorCount: nearest, contrast: value.contrast!, saturation: value.saturation!, reason: value.reason }
}
