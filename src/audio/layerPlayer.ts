// Plays every unmuted layer on the 16th-note grid, in time with the clock.
// Runs one check per 16th note, scheduled ahead on the Tone.js audio clock.
// It reads the project data at schedule time, so mute/delete take effect
// within one scheduling window (~0.1s).
import * as Tone from 'tone'
import { getProject } from '../project/projectStore.ts'
import { getLoopStepAtTime, getTicksPerStep } from './clock.ts'
import { getNotesToPlay } from './instruments.ts'
import { playMelodyNotes } from './melodySynths.ts'
import { isLayerSilencedAt } from './recorder.ts'
import { playDrum } from './samples.ts'

let initialized = false

// A recorded note is released this much before its last 16th ends, so a
// following note on the same pitch starts cleanly instead of being cut.
const NOTE_GAP_SECONDS = 0.01

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
  // A 16th at the tempo at this exact time (a slow take changes tempo
  // right at the loop end, so the current tempo could be the wrong one).
  const stepSeconds = 15 / Tone.getTransport().bpm.getValueAtTime(time)
  for (const layer of getProject().layers) {
    if (layer.muted || isLayerSilencedAt(layer.id, time)) {
      continue
    }
    if (layer.type === 'drum') {
      if (layer.hits.includes(step)) {
        playDrum(layer.drum, time)
      }
    }
    if (layer.type === 'melody') {
      for (const note of layer.notes) {
        if (note.step === step) {
          const duration = Math.max(0.02, note.length * stepSeconds - NOTE_GAP_SECONDS)
          playMelodyNotes(layer.instrument, getNotesToPlay(layer.instrument, note.pitch), duration, time)
        }
      }
    }
  }
}
