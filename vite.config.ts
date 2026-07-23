import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? './' : '/',
  // 固定端口，避免旧进程存在时悄悄切到 5174，导致前后端来源不一致。
  server: { port: 5173, strictPort: true },
}))
