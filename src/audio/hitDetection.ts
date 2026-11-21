// Hit detection: a hand-written sudden-loudness check (SPEC 0.1, no library).
//
// Audio is fed in as short blocks. A block counts as a hit when:
//   1. its peak is louder than the sensitivity threshold, AND
//   2. it is much louder than the recent background (a sudden jump), AND
//   3. enough time has passed since the last hit.
// Taps are sharp jumps from quiet; talking rises and falls gradually,
// so rule 2 filters most speech even when it is loud.
//
// Pure logic, no Web Audio, so the same check can later run on a recorded
// take (step 13) as well as on the live mic (step 11).

// A hit must be at least this many times louder than the background (~10 dB).
const SUDDEN_RISE_RATIO = 3
// How long the background level takes to follow changes.
const BACKGROUND_SECONDS = 0.25
// 16th notes at 128 BPM are ~117ms apart, so this must stay below that.
const MIN_SECONDS_BETWEEN_HITS = 0.08

// Sensitivity 0..100 maps to a threshold from -10 dBFS (only very loud
// sounds count) down to -50 dBFS (quiet sounds count).
const LEAST_SENSITIVE_DB = -10
const MOST_SENSITIVE_DB = -50

export interface HitDetector {
  backgroundPeak: number
  lastHitTime: number
}

export function createHitDetector(): HitDetector {
  return { backgroundPeak: 0, lastHitTime: -Infinity }
}

export function sensitivityToThresholdDb(sensitivity: number): number {
  return LEAST_SENSITIVE_DB + (sensitivity / 100) * (MOST_SENSITIVE_DB - LEAST_SENSITIVE_DB)
}

export function decibelsToAmplitude(db: number): number {
  return Math.pow(10, db / 20)
}

export function amplitudeToDecibels(amplitude: number): number {
  if (amplitude <= 0) {
    return -Infinity
  }
  return 20 * Math.log10(amplitude)
}

// Feed one block. Returns true if this block is a hit.
// blockPeak: loudest absolute sample in the block (0..1)
// blockSeconds: block length; blockTime: when the block happened (seconds)
export function checkBlockForHit(
  detector: HitDetector,
  blockPeak: number,
  blockSeconds: number,
  blockTime: number,
  thresholdAmplitude: number,
): boolean {
  const isLoudEnough = blockPeak >= thresholdAmplitude
  const isSudden = blockPeak >= detector.backgroundPeak * SUDDEN_RISE_RATIO
  const isAfterGap = blockTime - detector.lastHitTime >= MIN_SECONDS_BETWEEN_HITS
  const isHit = isLoudEnough && isSudden && isAfterGap

  if (isHit) {
    detector.lastHitTime = blockTime
  }

  // Update the background after the check, so a hit is compared with what came before it.
  const smoothing = 1 - Math.exp(-blockSeconds / BACKGROUND_SECONDS)
  detector.backgroundPeak += (blockPeak - detector.backgroundPeak) * smoothing

  return isHit
}
