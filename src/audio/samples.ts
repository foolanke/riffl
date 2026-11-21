// Loads the drum samples from public/samples/ (served by Vite from the
// repo itself, so this works offline, SPEC 0.2) and plays them.
//
// Every drum plays dry and punchy, except the 808, which has its own
// chain (deep and heavy reverb) so the reverb never touches the others.
import * as Tone from 'tone'
import { DRUMS } from './drums.ts'
import type { DrumName } from './drums.ts'

// 808: played slower = lower and longer (about 3 semitones down, from
// ~50 Hz to ~42 Hz). A little saturation adds harmonics so the boom is
// still heard on laptop speakers, which can't play that low on their own.
const BASS_808_PLAYBACK_RATE = 0.85

let players: Tone.Players | null = null
let bass808Player: Tone.Player | null = null

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
  players.volume.value = -6

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
}
