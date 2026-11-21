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

// Camera frames are timed on performance.now() (ms); sounds on the audio
// clock (seconds). This converts camera time to audio-clock time.
// Measured once per call; the two clocks don't drift apart within a take.
// Same conversion as camera confirmation in recorder.ts. The camera lag
// check and melody takes (step 29) must both use this, so the measured
// lag matches what it corrects.
export function performanceMsToAudioTime(performanceMs: number): number {
  const audioToPerformanceMs = performance.now() - Tone.getContext().currentTime * 1000
  return (performanceMs - audioToPerformanceMs) / 1000
}
