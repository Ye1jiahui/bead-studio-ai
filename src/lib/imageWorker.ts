import { processPixels, type PixelPipelineInput } from './pixelPipeline'

self.onmessage = (event: MessageEvent<PixelPipelineInput>) => {
  self.postMessage(processPixels(event.data))
}
