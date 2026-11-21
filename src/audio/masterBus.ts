// Mix processing shared by everything (sound pass, after step 27).
//
// 1. Master bus: every sound goes through a gentle compressor (glues the
//    mix together, like a produced track) and then a limiter (louder, and
//    never clips). Applied on Tone's destination, so every existing
//    .toDestination() goes through it with no other code changes.
//
// 2. Pump ("sidechain"): the classic house trick, as on I Gotta Feeling.
//    All melody instruments go through one gain that dips on every kick
//    and swells back over about an 8th note, so the synths "breathe" with
//    the beat. Tone.js has no sidechain input, so instead of listening to
//    the kick, the dip is scheduled at the exact time each kick is played.
//    Drums and the 808 drum are not pumped.
//
// Note: the browser's compressor delays output by a few ms (look-ahead).
// The lag check measures output delay too, so re-run it once after this.
import * as Tone from 'tone'

// Gain at the bottom of the dip: 0.35 is about -9 dB.
const PUMP_DEPTH_GAIN = 0.35
// How fast the dip happens, so it doesn't click.
const PUMP_ATTACK_SECONDS = 0.01

let initialized = false
let melodyBus: Tone.Gain | null = null
let pumpOn = true
const pumpListeners = new Set<() => void>()

// Call once from startAudio(), before any instrument is built.
export function initMasterBus(): void {
  if (initialized) {
    return
  }
  initialized = true
  const compressor = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.01, release: 0.2 })
  const makeUpGain = new Tone.Gain(Tone.dbToGain(3))
  const limiter = new Tone.Limiter(-1)
  Tone.getDestination().chain(compressor, makeUpGain, limiter)

  melodyBus = new Tone.Gain(1).toDestination()
}

// Every melody instrument connects here instead of to the destination.
export function getMelodyBus(): Tone.Gain {
  if (!melodyBus) {
    throw new Error('initMasterBus() must run before instruments are built.')
  }
  return melodyBus
}

// Called for every kick at the exact time it will sound.
export function pumpAt(time: number): void {
  if (!melodyBus || !pumpOn) {
    return
  }
  // Swell back over just under an 8th note at the current tempo.
  const releaseSeconds = Tone.Time('8n').toSeconds() * 0.9
  const gain = melodyBus.gain
  gain.cancelAndHoldAtTime(time)
  gain.linearRampToValueAtTime(PUMP_DEPTH_GAIN, time + PUMP_ATTACK_SECONDS)
  gain.linearRampToValueAtTime(1, time + PUMP_ATTACK_SECONDS + releaseSeconds)
}

// ---- Pump on/off, for comparing by ear ----

export function getPumpOn(): boolean {
  return pumpOn
}

export function setPumpOn(on: boolean): void {
  pumpOn = on
  if (!on && melodyBus) {
    melodyBus.gain.cancelScheduledValues(Tone.immediate())
    melodyBus.gain.setValueAtTime(1, Tone.immediate())
  }
  for (const listener of pumpListeners) {
    listener()
  }
}

export function subscribeToPump(listener: () => void): () => void {
  pumpListeners.add(listener)
  return function unsubscribe() {
    pumpListeners.delete(listener)
  }
}
