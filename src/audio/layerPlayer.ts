// Plays every unmuted layer's hits on the 16th-note grid, in time with the clock.
// Runs one check per 16th note, scheduled ahead on the Tone.js audio clock.
// It reads the project data at schedule time, so mute/delete take effect
// within one scheduling window (~0.1s).
import * as Tone from 'tone'
import { getProject } from '../project/projectStore.ts'
import { getLoopStepAtTime, getTicksPerStep } from './clock.ts'
import { playDrum } from './samples.ts'

let initialized = false

// Call once, after the clock is initialized.
export function initLayerPlayer(): void {
  if (initialized) {
    return
  }
  initialized = true
  // The grid is always 16th notes (SPEC 2.3), so this never needs rescheduling.
  Tone.getTransport().scheduleRepeat(handleStepTime, getTicksPerStep() + 'i', 0)
}

function handleStepTime(time: number): void {
  const step = getLoopStepAtTime(time)
  if (step === null) {
    return // count-in: no layers play
  }
  for (const layer of getProject().layers) {
    if (layer.muted) {
      continue
    }
    if (layer.hits.includes(step)) {
      playDrum(layer.drum, time)
    }
  }
}
