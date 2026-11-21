// AudioWorklet that streams raw mic samples to the main thread, each chunk
// tagged with the exact audio-clock frame of its first sample. That frame
// number is what lets a take start and stop exactly on the loop boundary.
//
// The worklet code is a string turned into a Blob URL, so it needs no
// bundler tricks and nothing loads from the internet (SPEC 0.2).
// It runs in the audio thread, where `currentFrame`, `AudioWorkletProcessor`
// and `registerProcessor` are globals.

export const RECORDER_PROCESSOR_NAME = 'take-recorder'

const RECORDER_WORKLET_CODE = `
class TakeRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.chunk = new Float32Array(4096)
    this.chunkLength = 0
    this.chunkStartFrame = 0
  }

  flush() {
    if (this.chunkLength === 0) {
      return
    }
    const samples = this.chunk.slice(0, this.chunkLength)
    this.port.postMessage({ startFrame: this.chunkStartFrame, samples: samples }, [samples.buffer])
    this.chunkLength = 0
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (!channel) {
      return true
    }
    // If audio skipped a block, start a new chunk so frame numbers stay exact.
    if (this.chunkLength > 0 && currentFrame !== this.chunkStartFrame + this.chunkLength) {
      this.flush()
    }
    if (this.chunkLength === 0) {
      this.chunkStartFrame = currentFrame
    }
    this.chunk.set(channel, this.chunkLength)
    this.chunkLength += channel.length
    if (this.chunkLength + channel.length > this.chunk.length) {
      this.flush()
    }
    return true
  }
}

registerProcessor('${RECORDER_PROCESSOR_NAME}', TakeRecorderProcessor)
`

export function createRecorderWorkletUrl(): string {
  const blob = new Blob([RECORDER_WORKLET_CODE], { type: 'application/javascript' })
  return URL.createObjectURL(blob)
}

// One message from the worklet.
export interface CapturedChunk {
  startFrame: number
  samples: Float32Array
}
