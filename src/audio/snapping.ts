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
