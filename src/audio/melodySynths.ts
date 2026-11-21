// Melody instrument sounds (SPEC 3.5). Step 26 has only the synth lead;
// step 27 adds the other five behind the same MelodyVoice interface.
//
// One voice per hand (SPEC 3.4: one note per hand). Separate voices mean
// both hands can hold the same pitch (e.g. C5 from either column) and
// releasing one hand never cuts the other's note.
import * as Tone from 'tone'

export interface MelodyVoice {
  noteOn(pitch: string, time: number): void
  noteOff(time: number): void
}

// Shared effects for the synth lead, built once: a gentle low-pass to take
// the fizz off the saws, a short 1/8 echo and a small room, so it sounds
// produced rather than like a raw beep (SPEC 3.5).
let leadEffectsInput: Tone.Filter | null = null

function getLeadEffectsInput(): Tone.Filter {
  if (leadEffectsInput) {
    return leadEffectsInput
  }
  const volume = new Tone.Volume(-10).toDestination()
  const reverb = new Tone.Reverb({ decay: 1.8, wet: 0.2 }).connect(volume)
  const echo = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.2, wet: 0.15 }).connect(reverb)
  leadEffectsInput = new Tone.Filter({ type: 'lowpass', frequency: 4000, Q: 1 }).connect(echo)
  return leadEffectsInput
}

// Bright lead: three slightly detuned saws, fast attack, a little decay.
export function createSynthLeadVoice(): MelodyVoice {
  const synth = new Tone.Synth({
    oscillator: { type: 'fatsawtooth', count: 3, spread: 25 },
    envelope: { attack: 0.005, decay: 0.15, sustain: 0.7, release: 0.25 },
  }).connect(getLeadEffectsInput())
  synth.volume.value = -6 // two hands at once shouldn't clip

  return {
    noteOn(pitch: string, time: number) {
      synth.triggerAttack(pitch, time)
    },
    noteOff(time: number) {
      synth.triggerRelease(time)
    },
  }
}
