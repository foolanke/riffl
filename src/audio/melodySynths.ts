// Melody instrument sounds (SPEC 3.5, step 27). Every instrument must
// sound produced, not like a raw beep, so each has its own small effects
// chain. Presets are a first guess at the I Gotta Feeling sounds; the team
// will tune them by ear (SPEC 3.5).
//
// One voice per hand per instrument (SPEC 3.4: one note per hand), so
// both hands can hold the same pitch (e.g. C5 from either column) and
// releasing one hand never cuts the other's note.
// Offline rule (SPEC 0.2): piano and 808 samples are in public/samples/.
import * as Tone from 'tone'
import { INSTRUMENTS } from './instruments.ts'
import type { InstrumentName } from './instruments.ts'
import type { HandSide } from '../vision/handTracking.ts'

// A voice plays one gesture's notes: one note, or three for the chord pad.
export interface MelodyVoice {
  noteOn(notes: string[], time: number): void
  noteOff(time: number): void
}

// What PolySynth and Sampler have in common.
interface NotePlayer {
  triggerAttack(notes: string[], time: number): unknown
  triggerRelease(notes: string[], time: number): unknown
}

const voices = new Map<InstrumentName, Record<HandSide, MelodyVoice>>()
// Each instrument's effects, built once and shared by both hands.
const chainInputs = new Map<InstrumentName, Tone.ToneAudioNode>()

// Call once from startAudio(). Waits for the piano and 808 samples.
export async function loadMelodyInstruments(): Promise<void> {
  if (voices.size > 0) {
    return
  }
  for (const instrument of INSTRUMENTS) {
    voices.set(instrument.name, {
      left: makeVoice(createNotePlayer(instrument.name)),
      right: makeVoice(createNotePlayer(instrument.name)),
    })
  }
  await Tone.loaded()
}

export function getMelodyVoice(instrument: InstrumentName, side: HandSide): MelodyVoice | null {
  const handVoices = voices.get(instrument)
  return handVoices ? handVoices[side] : null
}

// Remembers which notes are sounding, so note off (or the next note)
// releases exactly those.
function makeVoice(player: NotePlayer): MelodyVoice {
  let sounding: string[] = []
  return {
    noteOn(notes: string[], time: number) {
      if (sounding.length > 0) {
        player.triggerRelease(sounding, time)
      }
      player.triggerAttack(notes, time)
      sounding = notes
    },
    noteOff(time: number) {
      if (sounding.length > 0) {
        player.triggerRelease(sounding, time)
        sounding = []
      }
    },
  }
}

function createNotePlayer(instrument: InstrumentName): NotePlayer {
  const output = getChainInput(instrument)
  if (instrument === 'pluck') {
    // I Gotta Feeling's opening repeated chords: bright saws with a quick
    // decay and no sustain, so every hit is a short pluck.
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 20 },
      envelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.2 },
    }).connect(output)
    synth.volume.value = -6
    return synth
  }
  if (instrument === 'pad') {
    // Warm and slow: soft attack, long release, wide detune.
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 40 },
      envelope: { attack: 0.4, decay: 0.5, sustain: 0.8, release: 1.5 },
    }).connect(output)
    synth.volume.value = -10
    return synth
  }
  if (instrument === 'synthLead') {
    // Same sound as step 26: three slightly detuned saws, fast attack.
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 25 },
      envelope: { attack: 0.005, decay: 0.15, sustain: 0.7, release: 0.25 },
    }).connect(output)
    synth.volume.value = -6
    return synth
  }
  if (instrument === 'piano') {
    // Real piano samples every 3 semitones; the Sampler fills the gaps.
    const sampler = new Tone.Sampler({
      urls: {
        A3: 'A3.mp3',
        C4: 'C4.mp3',
        'D#4': 'Ds4.mp3',
        'F#4': 'Fs4.mp3',
        A4: 'A4.mp3',
        C5: 'C5.mp3',
        'D#5': 'Ds5.mp3',
        'F#5': 'Fs5.mp3',
        A5: 'A5.mp3',
        C6: 'C6.mp3',
        'D#6': 'Ds6.mp3',
        'F#6': 'Fs6.mp3',
        A6: 'A6.mp3',
        C7: 'C7.mp3',
      },
      baseUrl: import.meta.env.BASE_URL + 'samples/piano/',
      release: 1,
    }).connect(output)
    return sampler
  }
  if (instrument === 'bass') {
    // Electro-house bass: saw through a filter that opens on each note,
    // so it punches without getting muddy.
    const synth = new Tone.PolySynth(Tone.MonoSynth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.8, release: 0.15 },
      filter: { Q: 2, type: 'lowpass' },
      filterEnvelope: { attack: 0.005, decay: 0.25, sustain: 0.4, release: 0.2, baseFrequency: 120, octaves: 3 },
    }).connect(output)
    synth.volume.value = -4
    return synth
  }
  if (instrument === 'chordPad') {
    // Full triads for the G - C - Em loop: pad-like, but a faster attack
    // so chords can be played in rhythm.
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 30 },
      envelope: { attack: 0.03, decay: 0.3, sustain: 0.7, release: 0.6 },
    }).connect(output)
    synth.volume.value = -12 // three notes per pinch
    return synth
  }
  // bass808: the 808 drum sample, pitched to the note. The sample is
  // about 50 Hz, which is G1, so it's mapped there.
  const sampler = new Tone.Sampler({
    urls: { G1: '808.wav' },
    baseUrl: import.meta.env.BASE_URL + 'samples/',
    release: 0.6,
  }).connect(output)
  return sampler
}

// Effects per instrument, built the first time they're needed.
function getChainInput(instrument: InstrumentName): Tone.ToneAudioNode {
  const existing = chainInputs.get(instrument)
  if (existing) {
    return existing
  }
  const input = buildChain(instrument)
  chainInputs.set(instrument, input)
  return input
}

function buildChain(instrument: InstrumentName): Tone.ToneAudioNode {
  if (instrument === 'pluck') {
    // The intro's plucks ring out through a 1/8 echo.
    const volume = new Tone.Volume(-10).toDestination()
    const reverb = new Tone.Reverb({ decay: 1.5, wet: 0.2 }).connect(volume)
    const echo = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.25, wet: 0.2 }).connect(reverb)
    return new Tone.Filter({ type: 'lowpass', frequency: 3000, Q: 1 }).connect(echo)
  }
  if (instrument === 'pad' || instrument === 'chordPad') {
    // Chorus widens it, a darker filter and a bigger room make it warm.
    const volume = new Tone.Volume(instrument === 'pad' ? -10 : -8).toDestination()
    const reverb = new Tone.Reverb({ decay: 3, wet: 0.35 }).connect(volume)
    const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.6, wet: 0.5 }).connect(reverb)
    chorus.start()
    const cutoff = instrument === 'pad' ? 1800 : 2500
    return new Tone.Filter({ type: 'lowpass', frequency: cutoff, Q: 0.7 }).connect(chorus)
  }
  if (instrument === 'synthLead') {
    // Same chain as step 26.
    const volume = new Tone.Volume(-10).toDestination()
    const reverb = new Tone.Reverb({ decay: 1.8, wet: 0.2 }).connect(volume)
    const echo = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.2, wet: 0.15 }).connect(reverb)
    return new Tone.Filter({ type: 'lowpass', frequency: 4000, Q: 1 }).connect(echo)
  }
  if (instrument === 'piano') {
    const volume = new Tone.Volume(-4).toDestination()
    return new Tone.Reverb({ decay: 2, wet: 0.15 }).connect(volume)
  }
  if (instrument === 'bass') {
    // Dry: reverb on bass turns to mud.
    return new Tone.Volume(-6).toDestination()
  }
  // bass808: same character as the 808 drum (samples.ts): light
  // saturation so it's heard on laptop speakers, then a long, wet reverb.
  const volume = new Tone.Volume(-6).toDestination()
  const reverb = new Tone.Reverb({ decay: 5, preDelay: 0.02, wet: 0.45 }).connect(volume)
  return new Tone.Distortion({ distortion: 0.25, wet: 0.4 }).connect(reverb)
}
