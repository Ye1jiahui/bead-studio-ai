import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { analyzeImage } from './analyzeService'

const app = express()
const port = Number(process.env.PORT || 8787)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map((item) => item.trim())
const requests = new Map<string, number[]>()

app.use(cors({
  origin: (origin, callback) => {
    // 本地开发允许 Vite 备用端口；线上仍严格使用环境变量白名单。
    const localOrigin = origin
      ? origin.startsWith('http://localhost:51') || origin.startsWith('http://127.0.0.1:51')
      : false
    callback(null, !origin || allowedOrigins.includes(origin) || localOrigin)
  },
}))
app.use(express.json({ limit: '32kb' }))

app.get('/api/health', (_request, response) => response.json({ ok: true }))
app.post('/api/analyze', async (request, response) => {
  const key = request.ip || 'unknown'
  const now = Date.now()
  const recent = (requests.get(key) || []).filter((time) => now - time < 60_000)
  if (recent.length >= 12) return response.status(429).json({ error: '请求过于频繁，请稍后再试。' })
  requests.set(key, [...recent, now])

  try {
    return response.json(await analyzeImage(request.body))
  } catch (error) {
    if (error instanceof Error && /错误/.test(error.message)) return response.status(400).json({ error: '图像摘要格式不正确。' })
    console.error('分析接口发生错误')
    return response.status(500).json({ error: '分析服务暂不可用。' })
  }
})

app.listen(port, () => console.log(`拼豆分析服务已启动：http://localhost:${port}`))
