import { analyzeImage } from '../../server/analyzeService'

type CloudEvent = {
  body?: string | null
  headers?: Record<string, string | undefined>
  httpMethod?: string
}

export const main_handler = async (event: CloudEvent) => {
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((item) => item.trim())
  const headers = event.headers || {}
  const origin = headers.origin || headers.Origin || ''
  const corsOrigin = allowed.includes(origin) ? origin : allowed[0] || ''
  const corsHeaders = {
    'content-type': 'application/json',
    'access-control-allow-origin': corsOrigin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  }

  // 函数 URL 会把浏览器的预检请求交给函数，需要显式返回成功。
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' }
  }
  if (event.httpMethod && event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: '仅支持 POST 请求。' }) }
  }
  try {
    const result = await analyzeImage(JSON.parse(event.body || '{}'))
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result) }
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: '请求格式不正确。' }) }
  }
}
