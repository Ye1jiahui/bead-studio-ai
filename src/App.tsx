import { useCallback, useEffect, useRef, useState } from 'react'
import { COLOR_OPTIONS, fallbackRecommendation, type ImageSummary, type Recommendation } from '../shared/analyze'
import { calculateGrid, loadImage, summarizePixels } from './lib/image'
import { renderBeads, renderPatternSheet } from './lib/render'
import type { BeadSwatch, ProcessedPixel } from './lib/pixelPipeline'

type Status = 'empty' | 'ready' | 'analyzing' | 'done' | 'error'
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

function Icon({ name }: { name: string }) {
  return <span className="ui-icon" aria-hidden="true">{name}</span>
}

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [summary, setSummary] = useState<ImageSummary | null>(null)
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [gridLongEdge, setGridLongEdge] = useState(72)
  const [colorCount, setColorCount] = useState(32)
  const [showGrid, setShowGrid] = useState(true)
  const [showCodes, setShowCodes] = useState(false)
  const [isolateSubject, setIsolateSubject] = useState(false)
  const [zoom, setZoom] = useState(5)
  const [status, setStatus] = useState<Status>('empty')
  const [message, setMessage] = useState('')
  const [pixels, setPixels] = useState<ProcessedPixel[]>([])
  const [swatches, setSwatches] = useState<BeadSwatch[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const workerRef = useRef<Worker | null>(null)

  const grid = imageData ? calculateGrid(imageData.width, imageData.height, gridLongEdge) : { width: 0, height: 0 }

  const processFile = useCallback(async (nextFile: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(nextFile.type)) { setStatus('error'); setMessage('请选择 JPG、PNG 或 WebP 图片。'); return }
    if (nextFile.size > 10 * 1024 * 1024) { setStatus('error'); setMessage('图片不能超过 10MB。'); return }
    try {
      const loaded = await loadImage(nextFile)
      const nextSummary = summarizePixels(loaded.data.data, loaded.data.width, loaded.data.height)
      setFile(nextFile)
      setPreview((current) => { if (current) URL.revokeObjectURL(current); return URL.createObjectURL(nextFile) })
      setImageData(loaded.data)
      setSummary(nextSummary)
      setRecommendation(null)
      setGridLongEdge(72)
      setColorCount(32)
      setIsolateSubject(false)
      setStatus('ready')
      setMessage('照片只在你的浏览器中处理，原图不会发送给 AI。')
      loaded.bitmap.close()
    } catch { setStatus('error'); setMessage('图片读取失败，请换一张图片重试。') }
  }, [])

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); workerRef.current?.terminate() }, [preview])

  useEffect(() => {
    if (!imageData || !grid.width) return
    workerRef.current?.terminate()
    const worker = new Worker(new URL('./lib/imageWorker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent<{ pixels: ProcessedPixel[]; swatches: BeadSwatch[] }>) => {
      setPixels(event.data.pixels)
      setSwatches(event.data.swatches)
    }
    worker.postMessage({ image: imageData, gridWidth: grid.width, gridHeight: grid.height, colorCount, contrast: recommendation?.contrast || 1.04, saturation: recommendation?.saturation || 1, isolateSubject })
    return () => worker.terminate()
  }, [imageData, grid.width, grid.height, colorCount, recommendation?.contrast, recommendation?.saturation, isolateSubject])

  useEffect(() => {
    if (canvasRef.current && pixels.length) renderBeads(canvasRef.current, pixels, grid.width, grid.height, showGrid, zoom, swatches, showCodes)
  }, [pixels, grid.width, grid.height, showGrid, zoom, swatches, showCodes])

  async function requestAi() {
    if (!summary) return
    setStatus('analyzing'); setMessage('DeepSeek 正在阅读匿名图像摘要…')
    try {
      const response = await fetch(`${API_BASE}/api/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(summary) })
      if (!response.ok) throw new Error('接口不可用')
      const result = await response.json() as { recommendation: Recommendation; source: 'ai' | 'local'; warning?: string }
      setRecommendation(result.recommendation)
      setGridLongEdge(result.recommendation.gridLongEdge)
      setColorCount(result.recommendation.colorCount)
      setStatus('done')
      setMessage(result.warning || `AI 建议：${result.recommendation.reason}`)
    } catch {
      const local = fallbackRecommendation(summary)
      setRecommendation(local); setGridLongEdge(local.gridLongEdge); setColorCount(local.colorCount)
      setStatus('done'); setMessage('连接不到 AI 服务，已自动使用本地推荐，转换仍可正常使用。')
    }
  }

  function resetRecommendation() {
    if (!recommendation) return
    setGridLongEdge(recommendation.gridLongEdge); setColorCount(recommendation.colorCount)
  }

  function download() {
    if (!pixels.length) return
    const output = document.createElement('canvas')
    renderPatternSheet(output, pixels, grid.width, grid.height, swatches, `${file?.name.replace(/\.[^.]+$/, '') || '照片'} · 拼豆制作图`)
    const link = document.createElement('a')
    link.download = `${file?.name.replace(/\.[^.]+$/, '') || '照片'}-高清拼豆图纸.png`
    link.href = output.toDataURL('image/png')
    link.click()
  }

  const beadCount = pixels.filter(Boolean).length

  function downloadList() {
    if (!swatches.length) return
    const rows = ['MARD色号,屏幕近似色,颗数', ...swatches.map((swatch) => `${swatch.code},${swatch.hex},${swatch.count}`)]
    const blob = new Blob([`\ufeff${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.download = `${file?.name.replace(/\.[^.]+$/, '') || '照片'}-MARD用量清单.csv`
    link.href = URL.createObjectURL(blob)
    link.click()
    URL.revokeObjectURL(link.href)
  }

  function clear() { setFile(null); setImageData(null); setSummary(null); setRecommendation(null); setPixels([]); setSwatches([]); setStatus('empty'); setMessage('') }

  return <main>
    <header className="topbar">
      <a className="brand" href="./" aria-label="豆格首页"><span className="brand-mark"><i /><i /><i /><i /></span><span>豆格</span><small>BEAD STUDIO</small></a>
      <div className="privacy-pill"><span /> 原图不上传 · 浏览器本地处理</div>
    </header>

    <section className={`intro ${file ? 'intro-compact' : ''}`}>
      <p className="eyebrow"><Icon name="✦" /> AI 拼豆工作台</p>
      <h1>{file ? <>把照片变成<span>制作图纸。</span></> : <>把珍贵的照片，<br />变成一格一格的<span>小作品。</span></>}</h1>
      <p>{file ? '调整参数、核对色号，然后下载你的拼豆制作图。' : <>AI 帮你推荐合适的格子密度与颜色数量，<br className="desktop-only" />转换和调节都在本地完成。</>}</p>
    </section>

    {status === 'empty' || (status === 'error' && !file) ? <section
      className="upload-card"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { event.preventDefault(); const dropped = event.dataTransfer.files[0]; if (dropped) void processFile(dropped) }}
    >
      <div className="upload-art"><div className="photo-card"><div className="mountains" /><span /></div><div className="bead-spark"><i /><i /><i /></div></div>
      <h2>从一张照片开始</h2>
      <p>拖到这里，或者从设备中选择</p>
      <button className="primary" onClick={() => fileInputRef.current?.click()}><Icon name="↑" /> 选择照片</button>
      <small>支持 JPG · PNG · WebP　最大 10MB</small>
      {message && <p className="error-text">{message}</p>}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void processFile(selected) }} />
    </section> : <section className="workspace">
      <div className="canvas-panel">
        <div className="panel-title"><div><span className="step">01</span><h2>转换画布</h2></div><button className="icon-button" onClick={clear} aria-label="更换照片">×</button></div>
        <div className="comparison">
          <figure><figcaption>原始照片</figcaption><div className="image-stage"><img src={preview} alt="原始照片预览" /></div></figure>
          <figure><figcaption><span>拼豆预览</span><em>{grid.width} × {grid.height} 格</em></figcaption><div className="image-stage bead-stage">{pixels.length ? <canvas ref={canvasRef} aria-label="拼豆预览" /> : <div className="loading-beads"><span /><span /><span /></div>}</div></figure>
        </div>
        <div className={`notice ${status === 'analyzing' ? 'is-loading' : ''}`}><Icon name="✦" /><span>{message}</span></div>
        <section className="material-sheet">
          <div className="sheet-heading">
            <div><span className="step">03</span><div><h2>制作清单</h2><p>按用量排列的 MARD 标准色色号</p></div></div>
            <button className="list-download" onClick={downloadList}><Icon name="↓" /> 下载 CSV 清单</button>
          </div>
          <div className="sheet-stats">
            <article><small>图纸尺寸</small><strong>{grid.width} × {grid.height}</strong><span>格</span></article>
            <article><small>拼豆总数</small><strong>{beadCount.toLocaleString()}</strong><span>颗</span></article>
            <article><small>实际颜色</small><strong>{swatches.length}</strong><span>种</span></article>
            <article><small>建议底板</small><strong>{Math.ceil(grid.width / 29)} × {Math.ceil(grid.height / 29)}</strong><span>块 29 格板</span></article>
          </div>
          <div className="material-grid">{swatches.map((swatch, index) => <article className="material-card" key={swatch.code}>
            <span className="material-rank">{String(index + 1).padStart(2, '0')}</span>
            <i style={{ backgroundColor: swatch.hex }} />
            <div><strong>{swatch.code}</strong><code>{swatch.hex}</code></div>
            <b>{swatch.count.toLocaleString()}<small>颗</small></b>
          </article>)}</div>
          <p className="palette-note">屏幕颜色为近似值，实体豆可能受光线与批次影响，购买前建议用实体色卡复核。</p>
        </section>
      </div>

      <aside className="controls">
        <div className="panel-title"><div><span className="step">02</span><h2>调整效果</h2></div></div>
        <button className="ai-button" disabled={status === 'analyzing'} onClick={requestAi}><Icon name="✦" /> {status === 'analyzing' ? 'AI 分析中…' : recommendation ? '重新获取 AI 推荐' : '获取 AI 推荐'}</button>
        <div className="control-block"><label htmlFor="clarity"><span>清晰度</span><b>{gridLongEdge} 格</b></label><input id="clarity" type="range" min="24" max="160" value={gridLongEdge} onChange={(event) => setGridLongEdge(Number(event.target.value))} /><div className="range-hints"><span>抽象</span><span>精细</span></div><p>格子越多，细节越清楚，制作所需拼豆也越多。</p></div>
        <div className="control-block"><label><span>颜色数量</span><b>{swatches.length || colorCount} 色</b></label><div className="color-options">{COLOR_OPTIONS.map((value) => <button key={value} className={value === colorCount ? 'active' : ''} onClick={() => setColorCount(value)}>{value}</button>)}</div><p>这是颜色上限；映射到 MARD 色卡后，实际使用色号可能更少。</p></div>
        <div className="toggle-row"><div><Icon name="▦" /><span>显示网格线<small>方便按格制作</small></span></div><button role="switch" aria-checked={showGrid} className={`switch ${showGrid ? 'on' : ''}`} onClick={() => setShowGrid((value) => !value)}><span /></button></div>
        <div className="toggle-row"><div><Icon name="A1" /><span>格内显示色号<small>预览调到 10× 时显示最清楚</small></span></div><button role="switch" aria-checked={showCodes} className={`switch ${showCodes ? 'on' : ''}`} onClick={() => { setShowCodes((value) => !value); if (!showCodes) setZoom(10) }}><span /></button></div>
        <div className={`subject-control ${isolateSubject ? 'is-active' : ''}`}><div className="subject-copy"><Icon name="◎" /><span>只保留主体<small>本地识别画面主体，背景格自动留空</small></span><button role="switch" aria-label="只保留主体" aria-checked={isolateSubject} className={`switch ${isolateSubject ? 'on' : ''}`} onClick={() => setIsolateSubject((value) => !value)}><span /></button></div><p>{isolateSubject ? `已留空 ${(pixels.length - beadCount).toLocaleString()} 格，下载图纸中的空白格无需摆豆。` : '适合人物、宠物和物品照片；复杂背景可能需要关闭。'}</p></div>
        <div className="control-block"><label htmlFor="zoom"><span>预览缩放</span><b>{zoom}×</b></label><input id="zoom" type="range" min="2" max="10" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></div>
        <div className="sidebar-summary"><span><Icon name="▦" /> {grid.width} × {grid.height} 格</span><span><Icon name="●" /> {swatches.length} 色</span><span><Icon name="∑" /> {beadCount.toLocaleString()} 颗</span></div>
        <button className="secondary" disabled={!recommendation} onClick={resetRecommendation}><Icon name="↺" /> 恢复 AI 推荐</button>
        <button className="download" onClick={download}><span><Icon name="↓" /> 下载高清图纸</span><small>每格固定显示色号 · PNG</small></button>
      </aside>
    </section>}

    {!file && <section className="steps"><article><Icon name="▧" /><span>1</span><div><h3>上传照片</h3><p>选择清晰、主体明确的照片</p></div></article><article><Icon name="✦" /><span>2</span><div><h3>AI 推荐参数</h3><p>根据色彩和细节选择合适密度</p></div></article><article><Icon name="↓" /><span>3</span><div><h3>调整并下载</h3><p>得到可以照着制作的拼豆图</p></div></article></section>}
    <footer>豆格 · 让每一格都有意义 <span>照片不会离开你的设备</span></footer>
  </main>
}

export default App
