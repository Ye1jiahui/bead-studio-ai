import { fallbackRecommendation, normalizeRecommendation, parseImageSummary, type Recommendation } from '../shared/analyze'

type AnalyzeResult = { recommendation: Recommendation; source: 'ai' | 'local'; warning?: string }

const SYSTEM_PROMPT = `你是拼豆图案参数顾问。你不会看到原图，只根据客户端计算的匿名图像统计摘要做决策。
目标是忠实保留构图和主色，同时让结果适合规则拼豆制作。
只返回 JSON，不要 Markdown。字段必须是：gridLongEdge（24-160整数）、colorCount（只能是8/16/32/48/64；真人照片优先推荐48或64色）、contrast（0.8-1.4）、saturation（0.8-1.4）、reason（不超过60字中文）。`

function extractJson(text: string): unknown {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('模型未返回 JSON')
  return JSON.parse(cleaned.slice(start, end + 1))
}

export async function analyzeImage(input: unknown, env = process.env): Promise<AnalyzeResult> {
  const summary = parseImageSummary(input)
  const apiKey = env.DEEPSEEK_API_KEY
  if (!apiKey) {
    return { recommendation: fallbackRecommendation(summary), source: 'local', warning: '未配置 DeepSeek 密钥，已使用本地推荐。' }
  }

  const baseUrl = (env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')
  const model = env.DEEPSEEK_MODEL || 'deepseek-v4-flash'
  let lastError = 'AI 服务暂不可用'

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify(summary) },
          ],
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        // 只记录状态码，绝不输出密钥或请求正文。
        console.error(`DeepSeek 请求失败，状态码：${response.status}`)
        throw new Error(`AI 服务响应 ${response.status}`)
      }
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
      const content = data.choices?.[0]?.message?.content
      if (!content) throw new Error('AI 服务返回为空')
      return { recommendation: normalizeRecommendation(extractJson(content), summary), source: 'ai' }
    } catch (error) {
      if (error instanceof Error) console.error(`DeepSeek 调用异常：${error.message}`)
      lastError = error instanceof Error && error.name === 'AbortError' ? 'AI 请求超时' : 'AI 推荐暂不可用'
    } finally {
      clearTimeout(timeout)
    }
  }

  return { recommendation: fallbackRecommendation(summary), source: 'local', warning: `${lastError}，已使用本地推荐。` }
}
