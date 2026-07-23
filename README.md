# 豆格 · AI 照片转拼豆

上传照片后，浏览器会在本地提取匿名图像特征，由 DeepSeek 推荐格子密度、颜色数和画面参数，再在浏览器中生成可调节、可下载的拼豆图。原始照片不会发送到服务器。

## 本地体验

环境要求：Node.js 22 或更高版本。

```bash
npm install
cp .env.example .env
npm run dev
```

打开 `http://localhost:5173`。前端和 API 服务会同时启动；API 默认位于 `http://localhost:8787`。

请在 `.env` 中填写一枚新生成的 `DEEPSEEK_API_KEY`。曾经出现在聊天、截图或提交记录中的密钥应立即吊销，不要继续使用。未配置密钥时，产品会自动采用本地规则推荐，其他转换能力不受影响。

## 常用命令

```bash
npm run dev       # 同时启动前端与本地 API
npm test          # 运行单元测试
npm run build     # 类型检查并生成生产构建
npm run preview   # 预览生产构建
```

## 部署架构

### GitHub Pages 前端

仓库已经包含 `.github/workflows/deploy-pages.yml`。推送到 `main` 后，工作流会执行测试、构建并发布 `dist`。

1. 在 GitHub 仓库 Settings → Pages 中将 Source 设为 GitHub Actions。
2. 在工作流的 `VITE_API_BASE_URL` 中填写腾讯云函数 URL 根地址（不要带 `/api/analyze`）；公开函数 URL 会随前端构建发布，DeepSeek 密钥仍只保存在腾讯云。
3. 推送 `main` 分支并等待工作流完成。

Vite 使用相对资源路径，因此可部署到任意 GitHub 仓库子路径。

### 腾讯云函数 API

云函数入口为 `functions/analyze/index.main_handler`，核心逻辑与本地 API 共用。部署 Node.js 运行时函数时需要安装生产依赖，并配置：

- `DEEPSEEK_API_KEY`：新生成的密钥。
- `DEEPSEEK_BASE_URL`：默认 `https://api.deepseek.com`。
- `DEEPSEEK_MODEL`：默认 `deepseek-v4-flash`。
- `ALLOWED_ORIGINS`：GitHub Pages 完整源地址，例如 `https://用户名.github.io`；多个地址用英文逗号分隔。

为事件函数开启“函数 URL”，鉴权选择 `NONE`，通过该 HTTPS 地址接收 `POST /api/analyze` 与 `OPTIONS` 预检请求。生产环境应在函数配置中限制并发，并配合应用内限流。

## 隐私与安全

- 服务端只接收尺寸、亮度、饱和度、边缘密度和主色等数值摘要。
- 接口拒绝超大 JSON，不记录请求正文，也不会记录密钥。
- `.env` 已被 Git 忽略；仓库中只提供无密钥的 `.env.example`。
- 当前版本不保存照片、转换结果或用户身份信息。
