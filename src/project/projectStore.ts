// The whole project is one plain data object (SPEC 0.4).
// Later steps add objects, layers and hits to it. Save, load and undo
// will work by copying this object, so every change replaces it with a
// new copy instead of editing it in place.
// Plain TypeScript, no React (SPEC 0.1 "Engine vs. UI").
import type { DrumName } from '../audio/drums.ts'
import type { InstrumentName } from '../audio/instruments.ts'

export type TimeSignature = '4/4' | '3/4' | '6/8'
export type LoopBars = 1 | 2 | 4
export type CountInBars = 0 | 1 | 2

export interface ProjectSettings {
  tempoBpm: number
  timeSignature: TimeSignature
  loopBars: LoopBars
  key: string
  metronomeOn: boolean
  metronomeVolume: number // 0 (silent) to 1 (full)
  countInBars: CountInBars
}

// One recorded take (SPEC 1.6). Drum and melody takes share one layer list:
// mute, delete, undo, retake and save/load treat them the same (SPEC 3.1).
// Only playback and the take's input differ, so those check `type`.
// Steps are 16th notes counted from the loop start (0 = bar 1, beat 1).
export type Layer = DrumLayer | MelodyLayer

export interface DrumLayer {
  type: 'drum'
  id: string
  muted: boolean
  drum: DrumName
  hits: number[]
  // The object this take was played on (step 24), so a retake checks the
  // same box. Missing for takes recorded without an object.
  objectId?: string
}

// SPEC 3.10. A note sounds from `step` for `length` 16ths.
export interface MelodyNote {
  step: number
  length: number
  pitch: string // e.g. "G4"
}

export interface MelodyLayer {
  type: 'melody'
  id: string
  muted: boolean
  instrument: InstrumentName
  notes: MelodyNote[]
}

// Every 16th step where a layer starts a sound. Used by the speaker check.
export function getLayerSoundSteps(layer: Layer): number[] {
  if (layer.type === 'drum') {
    return layer.hits
  }
  const steps: number[] = []
  for (const note of layer.notes) {
    steps.push(note.step)
  }
  return steps
}

// A box on the camera image, 0..1 from left to right and top to bottom.
// Stored in camera-image coordinates (not mirrored like the screen).
export interface Box {
  x: number
  y: number
  width: number
  height: number
}

// A physical object on the table (SPEC 1.2): one fixed box, one drum.
export interface TrackedObject {
  id: string
  drum: DrumName
  box: Box
}

export interface Project {
  version: number // file format version, for loading saves later
  settings: ProjectSettings
  objects: TrackedObject[]
  layers: Layer[]
}

// 2: layers have a `type` ("drum" or "melody"). Version 1 files have only
// drum layers and still load (a layer without a type is a drum layer).
export const PROJECT_VERSION = 2

// 16th-note grid steps in one bar (SPEC 2.3). 6/8 = 6 eighths = 12 sixteenths.
export function getStepsPerBar(timeSignature: TimeSignature): number {
  if (timeSignature === '3/4' || timeSignature === '6/8') {
    return 12
  }
  return 16
}

// Allowed values for the setup controls (SPEC 2.1, 2.2).
export const MIN_TEMPO_BPM = 60
export const MAX_TEMPO_BPM = 180
export const TIME_SIGNATURES: TimeSignature[] = ['4/4', '3/4', '6/8']
export const LOOP_BAR_OPTIONS: LoopBars[] = [1, 2, 4]
export const COUNT_IN_OPTIONS: CountInBars[] = [0, 1, 2]

const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

function buildKeyList(): string[] {
  const keys: string[] = []
  for (const note of NOTE_NAMES) {
    keys.push(note + ' major')
  }
  for (const note of NOTE_NAMES) {
    keys.push(note + ' minor')
  }
  return keys
}

export const KEYS: string[] = buildKeyList()

// Defaults are the demo song's settings: I Gotta Feeling (SPEC 2.4).
export function createDefaultProject(): Project {
  return {
    version: PROJECT_VERSION,
    settings: {
      tempoBpm: 128,
      timeSignature: '4/4',
      loopBars: 2,
      key: 'G major',
      metronomeOn: true,
      metronomeVolume: 0.8,
      countInBars: 1, // SPEC 1.3: 1-bar count-in
    },
    objects: [],
    layers: [],
  }
}

// ---- The single current project, plus change notifications ----

let currentProject: Project = createDefaultProject()
const listeners = new Set<() => void>()

export function getProject(): Project {
  return currentProject
}

export function subscribeToProject(listener: () => void): () => void {
  listeners.add(listener)
  return function unsubscribe() {
    listeners.delete(listener)
  }
}

export function updateSettings(changes: Partial<ProjectSettings>): void {
  const newSettings: ProjectSettings = { ...currentProject.settings, ...changes }

  // Keep tempo inside the allowed range no matter who calls this.
  newSettings.tempoBpm = Math.min(MAX_TEMPO_BPM, Math.max(MIN_TEMPO_BPM, newSettings.tempoBpm))

  setProject({ ...currentProject, settings: newSettings })
}

// Every change goes through here: replace the object, then tell listeners.
function setProject(newProject: Project): void {
  currentProject = newProject
  for (const listener of listeners) {
    listener()
  }
}

// Swap in a whole project (loading a save or starting fresh).
// Undo history belongs to the old project, so it is cleared.
export function replaceProject(newProject: Project): void {
  undoStack.length = 0
  setProject(newProject)
}

// ---- Undo (SPEC 1.6: undo deletes the most recent take) ----
// Before every take the layer list is copied onto this stack. Undo puts
// the copy back, which removes a new take or brings back a retaken layer.
// Layers are never edited in place, so copying the array is enough.

const MAX_UNDO_STEPS = 50
const undoStack: Layer[][] = []

function rememberLayersForUndo(): void {
  undoStack.push([...currentProject.layers])
  if (undoStack.length > MAX_UNDO_STEPS) {
    undoStack.shift()
  }
}

// Returns false if there was nothing to undo.
export function undoLastTake(): boolean {
  const previousLayers = undoStack.pop()
  if (!previousLayers) {
    return false
  }
  setProject({ ...currentProject, layers: previousLayers })
  return true
}

// A new take becomes a new layer (SPEC 1.6), undoable.
export function addTakeLayer(layer: Layer): void {
  rememberLayersForUndo()
  addLayers([layer])
}

// A retake replaces one layer's content, keeping its place in the list.
// The new layer must have the same id as the one it replaces. Undoable.
export function replaceTakeLayer(newLayer: Layer): void {
  rememberLayersForUndo()
  const updated: Layer[] = []
  for (const layer of currentProject.layers) {
    if (layer.id === newLayer.id) {
      updated.push(newLayer)
    } else {
      updated.push(layer)
    }
  }
  setProject({ ...currentProject, layers: updated })
}

// ---- Objects (SPEC 1.2, step 21) ----
// Not part of undo: undo is only for takes (SPEC 1.6).

export function addObject(object: TrackedObject): void {
  setProject({ ...currentProject, objects: [...currentProject.objects, object] })
}

export function deleteObject(objectId: string): void {
  const remaining: TrackedObject[] = []
  for (const object of currentProject.objects) {
    if (object.id !== objectId) {
      remaining.push(object)
    }
  }
  setProject({ ...currentProject, objects: remaining })
}

export function setObjectDrum(objectId: string, drum: DrumName): void {
  const updated: TrackedObject[] = []
  for (const object of currentProject.objects) {
    if (object.id === objectId) {
      updated.push({ ...object, drum: drum })
    } else {
      updated.push(object)
    }
  }
  setProject({ ...currentProject, objects: updated })
}

export function findObject(objectId: string | null | undefined): TrackedObject | null {
  for (const object of currentProject.objects) {
    if (object.id === objectId) {
      return object
    }
  }
  return null
}

// ---- Layers ----

export function addLayers(newLayers: Layer[]): void {
  setProject({ ...currentProject, layers: [...currentProject.layers, ...newLayers] })
}

// Change which drum a recorded drum layer plays; its hits stay the same.
// Used by the designed page's layer card. Not undoable (undo is for takes, SPEC 1.6).
export function setLayerDrum(layerId: string, drum: DrumName): void {
  const updated: Layer[] = []
  for (const layer of currentProject.layers) {
    if (layer.id === layerId && layer.type === 'drum') {
      updated.push({ ...layer, drum: drum })
    } else {
      updated.push(layer)
    }
  }
  setProject({ ...currentProject, layers: updated })
}

// Change which instrument a recorded melody layer plays; its notes stay the same.
// Used by the designed page's layer card. Not undoable (undo is for takes, SPEC 1.6).
export function setLayerInstrument(layerId: string, instrument: InstrumentName): void {
  const updated: Layer[] = []
  for (const layer of currentProject.layers) {
    if (layer.id === layerId && layer.type === 'melody') {
      updated.push({ ...layer, instrument: instrument })
    } else {
      updated.push(layer)
    }
  }
  setProject({ ...currentProject, layers: updated })
}

export function deleteLayer(layerId: string): void {
  const remaining: Layer[] = []
  for (const layer of currentProject.layers) {
    if (layer.id !== layerId) {
      remaining.push(layer)
    }
  }
  setProject({ ...currentProject, layers: remaining })
}

export function toggleLayerMuted(layerId: string): void {
  const updated: Layer[] = []
  for (const layer of currentProject.layers) {
    if (layer.id === layerId) {
      updated.push({ ...layer, muted: !layer.muted })
    } else {
      updated.push(layer)
    }
  }
  setProject({ ...currentProject, layers: updated })
}

// For keys 1-9 (SPEC 0.6). Index 0 = layer 1. Does nothing if no such layer.
export function toggleLayerMutedByIndex(index: number): void {
  const layer = currentProject.layers[index]
  if (layer) {
    toggleLayerMuted(layer.id)
  }
}
