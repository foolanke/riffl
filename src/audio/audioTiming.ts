// Small helpers shared by the recorder and the lag check.
import * as Tone from 'tone'
import type { CapturedChunk } from './recorderWorklet.ts'

// Resolves once the audio clock reaches `audioTime` (seconds).
// Only used to know when to process audio, never for playback timing.
export function waitUntilAudioTime(audioTime: number): Promise<void> {
  return new Promise(function (resolve) {
    function check() {
      if (Tone.getContext().currentTime >= audioTime) {
        resolve()
      } else {
        setTimeout(check, 20)
      }
    }
    check()
  })
}

// Builds one continuous recording from the worklet's chunks, covering
// exactly `frameCount` frames starting at audio-clock frame `startFrame`.
export function buildRecording(
  chunks: CapturedChunk[],
  startFrame: number,
  frameCount: number,
): Float32Array {
  const output = new Float32Array(frameCount)
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.samples.length; i++) {
      const outputIndex = chunk.startFrame + i - startFrame
      if (outputIndex >= 0 && outputIndex < frameCount) {
        output[outputIndex] = chunk.samples[i]
      }
    }
  }
  return output
}
