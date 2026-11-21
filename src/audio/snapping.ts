// Snapping hits to the beat (SPEC 1.5): every hit moves to the nearest
// 16th-note step. Two hits on the same step merge into one.

// hitTimes: seconds from the loop start. Returns sorted, unique step numbers.
export function snapHitsToSteps(
  hitTimes: number[],
  stepSeconds: number,
  stepsInLoop: number,
): number[] {
  const steps: number[] = []
  for (const time of hitTimes) {
    const step = wrapStep(Math.round(time / stepSeconds), stepsInLoop)
    if (!steps.includes(step)) {
      steps.push(step)
    }
  }
  steps.sort(function (a, b) {
    return a - b
  })
  return steps
}

// A hit just before the loop start, or at its very end, belongs to step 0.
export function wrapStep(step: number, stepsInLoop: number): number {
  return ((step % stepsInLoop) + stepsInLoop) % stepsInLoop
}

// ---- Melody notes (SPEC 3.7, step 29) ----

// A note in seconds from the loop start, lag already subtracted.
export interface TimedNote {
  pitch: string
  startSeconds: number
  endSeconds: number
}

export interface SnappedNote {
  step: number
  length: number // in 16ths, at least 1
  pitch: string
}

// Start and end each snap to the nearest 16th (SPEC 1.5). Minimum length
// is one 16th. A note never runs past the loop end (SPEC 3.7). Two notes
// with the same pitch on the same step merge (the longer one is kept);
// different pitches on one step are a chord and both stay.
export function snapMelodyNotes(notes: TimedNote[], stepSeconds: number, stepsInLoop: number): SnappedNote[] {
  const snapped: SnappedNote[] = []
  for (const note of notes) {
    // A note started just before beat 1 belongs to step 0.
    const step = Math.min(stepsInLoop - 1, Math.max(0, Math.round(note.startSeconds / stepSeconds)))
    const endStep = Math.min(stepsInLoop, Math.round(note.endSeconds / stepSeconds))
    const length = Math.max(1, Math.min(endStep - step, stepsInLoop - step))

    let merged = false
    for (const existing of snapped) {
      if (existing.step === step && existing.pitch === note.pitch) {
        existing.length = Math.max(existing.length, length)
        merged = true
        break
      }
    }
    if (!merged) {
      snapped.push({ step: step, length: length, pitch: note.pitch })
    }
  }
  snapped.sort(function (a, b) {
    return a.step - b.step
  })
  return snapped
}
