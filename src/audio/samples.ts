// Loads the drum samples from public/samples/ (served by Vite from the
// repo itself, so this works offline, SPEC 0.2) and plays them.
import * as Tone from 'tone'
import { DRUMS } from './drums.ts'
import type { DrumName } from './drums.ts'

let players: Tone.Players | null = null

export async function loadSamples(): Promise<void> {
  if (players) {
    return
  }
  const urls: Record<string, string> = {}
  for (const drum of DRUMS) {
    urls[drum.name] = import.meta.env.BASE_URL + 'samples/' + drum.file
  }
  players = new Tone.Players(urls).toDestination()
  // A little headroom so several layers hitting at once don't clip.
  players.volume.value = -6
  await Tone.loaded()
}

// Plays a drum at an exact audio-clock time, or right now if no time given.
export function playDrum(name: DrumName, time?: number): void {
  if (!players) {
    return
  }
  const startTime = time === undefined ? Tone.now() : time
  players.player(name).start(startTime)
}
