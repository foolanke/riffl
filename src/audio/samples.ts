// Loads the drum samples from public/samples/ (served by Vite from the
// repo itself, so this works offline, SPEC 0.2) and plays them.
//
// Every drum plays dry and punchy, except the 808, which has its own
// chain (deep and heavy reverb) so the reverb never touches the others.
import * as Tone from 'tone'
import { DRUMS } from './drums.ts'
import { pumpAt } from './masterBus.ts'
import type { DrumName } from './drums.ts'

// 808: played slower = lower and longer (about 3 semitones down, from
// ~50 Hz to ~42 Hz). A little saturation adds harmonics so the boom is
// still heard on laptop speakers, which can't play that low on their own.
const BASS_808_PLAYBACK_RATE = 0.85

let players: Tone.Players | null = null
let bass808Player: Tone.Player | null = null
// Where quieter hits go: the same places the full-volume players play into.
let bass808Input: Tone.ToneAudioNode | null = null
const PLAYERS_VOLUME_DB = -6

export async function loadSamples(): Promise<void> {
  if (players) {
    return
  }
  const urls: Record<string, string> = {}
  for (const drum of DRUMS) {
    if (drum.name !== 'bass808') {
      urls[drum.name] = getSampleUrl(drum.file)
    }
  }
  players = new Tone.Players(urls).toDestination()
  // A little headroom so several layers hitting at once don't clip.
  players.volume.value = PLAYERS_VOLUME_DB

  bass808Player = create808Player()
  await Tone.loaded()
}

function create808Player(): Tone.Player {
  let file = '808.wav'
  for (const drum of DRUMS) {
    if (drum.name === 'bass808') {
      file = drum.file
    }
  }
  const volume = new Tone.Volume(-6).toDestination()
  // Long, very wet reverb: the "hella reverb" the team asked for.
  const reverb = new Tone.Reverb({ decay: 5, preDelay: 0.02, wet: 0.45 }).connect(volume)
  const saturation = new Tone.Distortion({ distortion: 0.25, wet: 0.4 }).connect(reverb)
  const player = new Tone.Player(getSampleUrl(file)).connect(saturation)
  bass808Input = saturation
  player.playbackRate = BASS_808_PLAYBACK_RATE
  return player
}

function getSampleUrl(file: string): string {
  return import.meta.env.BASE_URL + 'samples/' + file
}

// Plays a drum at an exact audio-clock time, or right now if no time given.
export function playDrum(name: DrumName, time?: number): void {
  if (!players || !bass808Player) {
    return
  }
  const startTime = time === undefined ? Tone.now() : time

  if (name === 'bass808') {
    bass808Player.start(startTime)
    return
  }
  if (name === 'hihatRoll') {
    // Two hats a 32nd note apart: the step itself, then halfway to the next.
    const roll = players.player('hihatRoll')
    roll.start(startTime)
    roll.start(startTime + Tone.Time('32n').toSeconds())
    return
  }
  players.player(name).start(startTime)
  if (name === 'kick') {
    pumpAt(startTime) // house pump on the melody (masterBus.ts)
  }
}

// A drum at a layer's volume (0-1, designed page). Full volume plays the
// normal way. Quieter hits play the same sample once through their own
// gain, so another layer on the same drum keeps its own volume.
export function playDrumAtVolume(name: DrumName, time: number, volume: number): void {
  if (volume >= 1) {
    playDrum(name, time)
    return
  }
  if (!players || !bass808Player || !bass808Input || volume <= 0) {
    return
  }
  if (name === 'bass808') {
    playQuietSample(bass808Player.buffer, bass808Input, volume, time, BASS_808_PLAYBACK_RATE)
    return
  }
  const quietGain = Tone.dbToGain(PLAYERS_VOLUME_DB) * volume
  const buffer = players.player(name).buffer
  const output = Tone.getDestination()
  playQuietSample(buffer, output, quietGain, time, 1)
  if (name === 'hihatRoll') {
    playQuietSample(buffer, output, quietGain, time + Tone.Time('32n').toSeconds(), 1)
  }
  if (name === 'kick') {
    pumpAt(time)
  }
}

// One shot of a sample through a gain, cleaned up when it ends.
function playQuietSample(
  buffer: Tone.ToneAudioBuffer,
  output: Tone.InputNode,
  gainValue: number,
  time: number,
  playbackRate: number,
): void {
  const gain = new Tone.Gain(gainValue).connect(output)
  const source = new Tone.ToneBufferSource({ url: buffer, playbackRate: playbackRate }).connect(gain)
  source.onended = function () {
    source.dispose()
    gain.dispose()
  }
  source.start(time)
}
