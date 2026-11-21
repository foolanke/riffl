// Hardcoded test layers for step 8: the basic I Gotta Feeling dance beat.
// Kick on every beat, clap on beats 2 and 4, open hi-hat on the offbeats.
// Built for the current loop length and time signature.
import { getStepsPerBar } from './projectStore.ts'
import type { Layer, ProjectSettings } from './projectStore.ts'
import type { DrumName } from '../audio/drums.ts'

const STEPS_PER_BEAT = 4 // 16th notes per quarter-note beat

export function createTestLayers(settings: ProjectSettings): Layer[] {
  const stepsInLoop = getStepsPerBar(settings.timeSignature) * settings.loopBars

  const kickHits: number[] = []
  const clapHits: number[] = []
  const openHatHits: number[] = []

  for (let step = 0; step < stepsInLoop; step += STEPS_PER_BEAT) {
    const beatIndex = step / STEPS_PER_BEAT
    kickHits.push(step)
    openHatHits.push(step + 2) // the "and" between beats
    if (beatIndex % 2 === 1) {
      clapHits.push(step) // beats 2 and 4
    }
  }

  return [
    makeLayer('kick', kickHits),
    makeLayer('clap', clapHits),
    makeLayer('hihatOpen', openHatHits),
  ]
}

function makeLayer(drum: DrumName, hits: number[]): Layer {
  return { id: crypto.randomUUID(), drum: drum, hits: hits, muted: false }
}
