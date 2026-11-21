// The beat clock and metronome.
// Reads tempo, time signature, loop length, count-in and metronome
// settings from the project data (SPEC 0.4) and reacts when they change.
//
// Timing rule: every click is scheduled ahead of time on the Tone.js
// audio clock. The screen is told about beats through Tone's Draw queue,
// which fires each callback at the moment the beat is heard. React never
// drives timing (SPEC 0.1 "Engine vs. UI").
//
// Timeline layout on the Tone transport (in ticks):
//   [ count-in bars ][ loop bars ] <- loops back to the start of "loop bars"
// So the count-in plays once, then the loop repeats forever.
import * as Tone from 'tone'
import { getProject, getStepsPerBar, subscribeToProject } from '../project/projectStore.ts'
import type { ProjectSettings, TimeSignature } from '../project/projectStore.ts'

export interface BeatInfo {
  isCountIn: boolean
  bar: number // 1-based. During count-in: count-in bar. Otherwise: bar within the loop.
  beat: number // 1-based beat within the bar
  beatsPerBar: number
  barsTotal: number // count-in bars, or loop bars
}

// How one bar is divided into metronome clicks.
interface Meter {
  clicksPerBar: number
  ticksPerClick: number
  quarterNotesPerBar: number
}

// Tempo is always in quarter notes per minute.
// 6/8 clicks every eighth note (6 clicks per bar).
function getMeter(timeSignature: TimeSignature): Meter {
  const ticksPerQuarter = Tone.getTransport().PPQ
  if (timeSignature === '3/4') {
    return { clicksPerBar: 3, ticksPerClick: ticksPerQuarter, quarterNotesPerBar: 3 }
  }
  if (timeSignature === '6/8') {
    return { clicksPerBar: 6, ticksPerClick: ticksPerQuarter / 2, quarterNotesPerBar: 3 }
  }
  return { clicksPerBar: 4, ticksPerClick: ticksPerQuarter, quarterNotesPerBar: 4 }
}

// ---- Clock state ----

let initialized = false
let isPlaying = false
let meter: Meter = { clicksPerBar: 4, ticksPerClick: 192, quarterNotesPerBar: 4 }
// Count-in and loop length are fixed for the layout currently on the transport.
let layoutCountInBars = 0
let layoutLoopBars = 2
let layoutStepsPerBar = 16
let repeatEventId: number | null = null
let lastSettings: ProjectSettings | null = null

let clickSynth: Tone.Synth | null = null
let clickVolume: Tone.Volume | null = null

const beatListeners = new Set<(beat: BeatInfo | null) => void>()
const playStateListeners = new Set<() => void>()

// ---- Setup ----

// Call once, after startAudio().
export function initClock(): void {
  if (initialized) {
    return
  }
  initialized = true

  // A short, bright click that cuts through drums.
  clickVolume = new Tone.Volume(0).toDestination()
  clickSynth = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
  }).connect(clickVolume)

  const settings = getProject().settings
  applyLiveSettings(settings)
  lastSettings = settings
  subscribeToProject(handleProjectChanged)
}

// Settings that can change mid-loop without restarting.
function applyLiveSettings(settings: ProjectSettings): void {
  Tone.getTransport().bpm.value = settings.tempoBpm
  if (clickVolume) {
    clickVolume.volume.value = volumeToDecibels(settings.metronomeVolume)
  }
}

function volumeToDecibels(volume: number): number {
  if (volume <= 0) {
    return -Infinity
  }
  return Tone.gainToDb(volume)
}

function getTicksPerBar(): number {
  return meter.clicksPerBar * meter.ticksPerClick
}

// Puts the count-in + loop layout onto the transport and schedules clicks.
function applyLoopLayout(settings: ProjectSettings, countInBars: number): void {
  const transport = Tone.getTransport()

  meter = getMeter(settings.timeSignature)
  layoutCountInBars = countInBars
  layoutLoopBars = settings.loopBars
  layoutStepsPerBar = getStepsPerBar(settings.timeSignature)

  transport.timeSignature = meter.quarterNotesPerBar
  const ticksPerBar = getTicksPerBar()
  transport.loop = true
  transport.loopStart = layoutCountInBars * ticksPerBar + 'i'
  transport.loopEnd = (layoutCountInBars + layoutLoopBars) * ticksPerBar + 'i'

  // Re-schedule the click: its spacing depends on the time signature.
  if (repeatEventId !== null) {
    transport.clear(repeatEventId)
  }
  repeatEventId = transport.scheduleRepeat(handleClickTime, meter.ticksPerClick + 'i', 0)
}

// ---- Play / stop ----

export function play(): void {
  if (!initialized || isPlaying) {
    return
  }
  const settings = getProject().settings
  applyLoopLayout(settings, settings.countInBars)

  const transport = Tone.getTransport()
  transport.stop() // also rewinds to the very start (the count-in)
  transport.start()
  setPlaying(true)
}

export function stop(): void {
  if (!isPlaying) {
    return
  }
  Tone.getTransport().stop()
  Tone.getDraw().cancel()
  setPlaying(false)
  emitBeat(null)
}

// Time signature or loop length changed while playing:
// rebuild the layout and jump straight to the start of the loop.
function restartAtLoopStart(settings: ProjectSettings): void {
  const transport = Tone.getTransport()
  transport.stop()
  Tone.getDraw().cancel()
  applyLoopLayout(settings, layoutCountInBars)
  transport.start(undefined, layoutCountInBars * getTicksPerBar() + 'i')
}

function handleProjectChanged(): void {
  const settings = getProject().settings
  const previous = lastSettings
  lastSettings = settings

  applyLiveSettings(settings)

  const layoutChanged =
    previous !== null &&
    (previous.timeSignature !== settings.timeSignature || previous.loopBars !== settings.loopBars)
  if (isPlaying && layoutChanged) {
    restartAtLoopStart(settings)
  }
  // Count-in changes take effect on the next Play.
}

// ---- The click itself ----

// Called by Tone slightly ahead of time; `time` is when the click will sound.
function handleClickTime(time: number): void {
  const settings = getProject().settings
  const ticks = Tone.getTransport().getTicksAtTime(time)
  const clickIndex = Math.round(ticks / meter.ticksPerClick)
  const clicksPerBar = meter.clicksPerBar
  const countInClicks = layoutCountInBars * clicksPerBar

  let beatInfo: BeatInfo
  if (clickIndex < countInClicks) {
    beatInfo = {
      isCountIn: true,
      bar: Math.floor(clickIndex / clicksPerBar) + 1,
      beat: (clickIndex % clicksPerBar) + 1,
      beatsPerBar: clicksPerBar,
      barsTotal: layoutCountInBars,
    }
  } else {
    // Modulo guards against the loop-restart tick being read as loop end.
    const loopClicks = layoutLoopBars * clicksPerBar
    const clickInLoop = (clickIndex - countInClicks) % loopClicks
    beatInfo = {
      isCountIn: false,
      bar: Math.floor(clickInLoop / clicksPerBar) + 1,
      beat: (clickInLoop % clicksPerBar) + 1,
      beatsPerBar: clicksPerBar,
      barsTotal: layoutLoopBars,
    }
  }

  // Count-in always clicks, even with the metronome off; otherwise
  // there would be nothing to count in with.
  const shouldClick = beatInfo.isCountIn || settings.metronomeOn
  if (shouldClick && clickSynth) {
    const isAccent = beatInfo.beat === 1
    const note = isAccent ? 'C6' : 'G5'
    const velocity = isAccent ? 1 : 0.6
    clickSynth.triggerAttackRelease(note, 0.03, time, velocity)
  }

  Tone.getDraw().schedule(function () {
    emitBeat(beatInfo)
  }, time)
}

// ---- The 16th-note grid, for layer playback ----

export function getTicksPerStep(): number {
  return Tone.getTransport().PPQ / 4
}

// Which 16th-note step of the loop lands at `time`, or null during count-in.
export function getLoopStepAtTime(time: number): number | null {
  const ticks = Tone.getTransport().getTicksAtTime(time)
  const stepIndex = Math.round(ticks / getTicksPerStep())
  const countInSteps = layoutCountInBars * layoutStepsPerBar
  if (stepIndex < countInSteps) {
    return null
  }
  // Modulo guards against the loop-restart tick being read as loop end.
  const stepsInLoop = layoutLoopBars * layoutStepsPerBar
  return (stepIndex - countInSteps) % stepsInLoop
}

// ---- For the screen ----

// 0..1 through the loop, based on what is being heard right now.
// 0 during count-in and when stopped.
export function getLoopProgress(): number {
  if (!isPlaying) {
    return 0
  }
  const ticksNow = Tone.getTransport().getTicksAtTime(Tone.immediate())
  const ticksPerBar = getTicksPerBar()
  const ticksIntoLoop = ticksNow - layoutCountInBars * ticksPerBar
  if (ticksIntoLoop < 0) {
    return 0
  }
  const loopLengthTicks = layoutLoopBars * ticksPerBar
  return (ticksIntoLoop % loopLengthTicks) / loopLengthTicks
}

export function getIsPlaying(): boolean {
  return isPlaying
}

export function subscribeToPlayState(listener: () => void): () => void {
  playStateListeners.add(listener)
  return function unsubscribe() {
    playStateListeners.delete(listener)
  }
}

// Called on every beat as it is heard; called with null on stop.
export function onBeat(listener: (beat: BeatInfo | null) => void): () => void {
  beatListeners.add(listener)
  return function unsubscribe() {
    beatListeners.delete(listener)
  }
}

function setPlaying(playing: boolean): void {
  isPlaying = playing
  for (const listener of playStateListeners) {
    listener()
  }
}

function emitBeat(beat: BeatInfo | null): void {
  for (const listener of beatListeners) {
    listener(beat)
  }
}
