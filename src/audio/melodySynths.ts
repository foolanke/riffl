// Melody instrument sounds (SPEC 3.5, step 27). Every instrument must
// sound produced, not like a raw beep, so each has its own small effects
// chain. Presets are a first guess at the I Gotta Feeling sounds; the team
// will tune them by ear (SPEC 3.5).
//
// One voice per hand per instrument (SPEC 3.4: one note per hand), so
// both hands can hold the same pitch (e.g. C5 from either column) and
// releasing one hand never cuts the other's note.
// Offline rule (SPEC 0.2): guitar, piano, flute and 808 samples are in public/samples/.
// Every chain ends on the melody bus, which pumps with the kick (masterBus.ts).
import * as Tone from 'tone'
import { INSTRUMENTS } from './instruments.ts'
import { getMelodyBus } from './masterBus.ts'
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
  triggerAttackRelease(notes: string[], duration: number, time: number): unknown
}

const voices = new Map<InstrumentName, Record<HandSide, MelodyVoice>>()
// Recorded melody layers (step 29) play on their own player per
// instrument, so loop playback never cuts off a note you're playing live.
const layerPlayers = new Map<InstrumentName, NotePlayer>()
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
    layerPlayers.set(instrument.name, createNotePlayer(instrument.name))
  }
  await Tone.loaded()
}

// Plays one recorded note (all the notes of one gesture) for a set time.
export function playMelodyNotes(instrument: InstrumentName, notes: string[], durationSeconds: number, time: number): void {
  const player = layerPlayers.get(instrument)
  if (player) {
    player.triggerAttackRelease(notes, durationSeconds, time)
  }
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
    // I Gotta Feeling's intro is a clean electric guitar, so the pluck is
    // real guitar samples. A short release keeps it plucky: let go of the
    // pinch and the string is damped.
    const sampler = new Tone.Sampler({
      urls: {
        C3: 'C3.mp3',
        'D#3': 'Ds3.mp3',
        'F#3': 'Fs3.mp3',
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
      },
      baseUrl: import.meta.env.BASE_URL + 'samples/guitar/',
      release: 0.15,
    }).connect(output)
    return sampler
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
    // Supersaw: the big, wide house chords after the intro. Seven detuned
    // saws per note, spread wide; a fast attack so chords play in rhythm.
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 7, spread: 50 },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.8, release: 0.4 },
    }).connect(output)
    synth.volume.value = -16 // four notes x seven saws per pinch
    return synth
  }
  if (instrument === 'flute' || instrument === 'lowFlute') {
    // Real flute samples (C4-C7, every 3-4 semitones). A soft attack and
    // a release long enough to breathe out, like the Mask Off loop.
    // The low flute plays the same samples an octave down (getNotesToPlay).
    const sampler = new Tone.Sampler({
      urls: {
        C4: 'C4.mp3',
        E4: 'E4.mp3',
        A4: 'A4.mp3',
        C5: 'C5.mp3',
        E5: 'E5.mp3',
        A5: 'A5.mp3',
        C6: 'C6.mp3',
        E6: 'E6.mp3',
        A6: 'A6.mp3',
        C7: 'C7.mp3',
      },
      baseUrl: import.meta.env.BASE_URL + 'samples/flute/',
      attack: 0.02,
      release: 0.35,
    }).connect(output)
    return sampler
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
    // The intro guitar rings out through a strong dotted-1/8 echo (the
    // classic pop guitar delay), plus a little room. A gentle low cut keeps
    // it clear of the bass.
    const volume = new Tone.Volume(-2).connect(getMelodyBus())
    const reverb = new Tone.Reverb({ decay: 1.6, wet: 0.18 }).connect(volume)
    const echo = new Tone.FeedbackDelay({ delayTime: '8n.', feedback: 0.35, wet: 0.3 }).connect(reverb)
    return new Tone.Filter({ type: 'highpass', frequency: 150, Q: 0.7 }).connect(echo)
  }
  if (instrument === 'chordPad') {
    // Bright and wide: chorus for width, a high cutoff so it shines,
    // a medium room so it fills the space without washing out.
    const volume = new Tone.Volume(-6).connect(getMelodyBus())
    const reverb = new Tone.Reverb({ decay: 2.5, wet: 0.3 }).connect(volume)
    const chorus = new Tone.Chorus({ frequency: 1.2, delayTime: 4, depth: 0.7, wet: 0.4 }).connect(reverb)
    chorus.start()
    return new Tone.Filter({ type: 'lowpass', frequency: 6000, Q: 0.5 }).connect(chorus)
  }
  if (instrument === 'pad') {
    // Chorus widens it, a darker filter and a bigger room make it warm.
    const volume = new Tone.Volume(-10).connect(getMelodyBus())
    const reverb = new Tone.Reverb({ decay: 3, wet: 0.35 }).connect(volume)
    const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.6, wet: 0.5 }).connect(reverb)
    chorus.start()
    return new Tone.Filter({ type: 'lowpass', frequency: 1800, Q: 0.7 }).connect(chorus)
  }
  if (instrument === 'synthLead') {
    // Same chain as step 26.
    const volume = new Tone.Volume(-10).connect(getMelodyBus())
    const reverb = new Tone.Reverb({ decay: 1.8, wet: 0.2 }).connect(volume)
    const echo = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.2, wet: 0.15 }).connect(reverb)
    return new Tone.Filter({ type: 'lowpass', frequency: 4000, Q: 1 }).connect(echo)
  }
  if (instrument === 'piano') {
    const volume = new Tone.Volume(-4).connect(getMelodyBus())
    return new Tone.Reverb({ decay: 2, wet: 0.15 }).connect(volume)
  }
  if (instrument === 'bass') {
    // Dry: reverb on bass turns to mud.
    return new Tone.Volume(-6).connect(getMelodyBus())
  }
  if (instrument === 'flute') {
    // Mask Off: the flute is an old sampled record, so it sits in a big,
    // dark room with a soft echo. Low cut keeps it off the 808; a gentle
    // high cut takes the edge off like the vintage sample.
    const volume = new Tone.Volume(0).connect(getMelodyBus())
    const reverb = new Tone.Reverb({ decay: 3.5, preDelay: 0.02, wet: 0.35 }).connect(volume)
    const echo = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.25, wet: 0.18 }).connect(reverb)
    const highCut = new Tone.Filter({ type: 'lowpass', frequency: 7000, Q: 0.5 }).connect(echo)
    return new Tone.Filter({ type: 'highpass', frequency: 250, Q: 0.7 }).connect(highCut)
  }
  if (instrument === 'lowFlute') {
    // Darker and breathier than the flute, more room: sits under it.
    const volume = new Tone.Volume(2).connect(getMelodyBus())
    const reverb = new Tone.Reverb({ decay: 4.5, preDelay: 0.03, wet: 0.4 }).connect(volume)
    const echo = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.2, wet: 0.12 }).connect(reverb)
    const highCut = new Tone.Filter({ type: 'lowpass', frequency: 3500, Q: 0.5 }).connect(echo)
    return new Tone.Filter({ type: 'highpass', frequency: 120, Q: 0.7 }).connect(highCut)
  }
  // bass808: same character as the 808 drum (samples.ts): light
  // saturation so it's heard on laptop speakers, then a long, wet reverb.
  const volume = new Tone.Volume(-6).connect(getMelodyBus())
  const reverb = new Tone.Reverb({ decay: 5, preDelay: 0.02, wet: 0.45 }).connect(volume)
  return new Tone.Distortion({ distortion: 0.25, wet: 0.4 }).connect(reverb)
}
