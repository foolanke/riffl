// The layer list the designed page shows: recorded layers from the project,
// followed by draft layers (added with ADD LAYER but not recorded yet).
// Drafts live only in the page; a take turns a draft into a real layer.
import { getDrumLabel } from '../../../audio/drums.ts'
import type { DrumName } from '../../../audio/drums.ts'
import { getInstrumentLabel } from '../../../audio/instruments.ts'
import type { InstrumentName } from '../../../audio/instruments.ts'
import { getLayerSoundSteps } from '../../../project/projectStore.ts'
import type { Layer, ProjectSettings } from '../../../project/projectStore.ts'
import { getStepsPerBar } from '../../../project/projectStore.ts'

// What a layer plays: a drum sound (SPEC 1.7) or a melody instrument (SPEC 3.5).
export type LayerSound = { kind: 'drum'; drum: DrumName } | { kind: 'melody'; instrument: InstrumentName }

export interface DraftLayer {
  key: string
  sound: LayerSound
}

export interface LayerItem {
  key: string // layer id for recorded layers, draft key for drafts
  number: string // "01", "02" ... position in the list
  layer: Layer | null // null = draft
  draft: DraftLayer | null
  soundLabel: string // "Snare", "Pluck"
  muted: boolean
}

export function buildLayerItems(layers: Layer[], drafts: DraftLayer[]): LayerItem[] {
  const items: LayerItem[] = []
  for (const layer of layers) {
    items.push({
      key: layer.id,
      number: formatLayerNumber(items.length + 1),
      layer: layer,
      draft: null,
      soundLabel: layer.type === 'drum' ? getDrumLabel(layer.drum) : getInstrumentLabel(layer.instrument),
      muted: layer.muted,
    })
  }
  for (const draft of drafts) {
    items.push({
      key: draft.key,
      number: formatLayerNumber(items.length + 1),
      layer: null,
      draft: draft,
      soundLabel: getSoundLabel(draft.sound),
      muted: false,
    })
  }
  return items
}

export function getSoundLabel(sound: LayerSound): string {
  return sound.kind === 'drum' ? getDrumLabel(sound.drum) : getInstrumentLabel(sound.instrument)
}

// The sound of a draft or recorded layer.
export function getItemSound(item: LayerItem): LayerSound | null {
  if (item.draft) {
    return item.draft.sound
  }
  if (item.layer && item.layer.type === 'drum') {
    return { kind: 'drum', drum: item.layer.drum }
  }
  if (item.layer && item.layer.type === 'melody') {
    return { kind: 'melody', instrument: item.layer.instrument }
  }
  return null
}

export function isMelodyItem(item: LayerItem | null): boolean {
  if (item === null) {
    return false
  }
  const sound = getItemSound(item)
  return sound !== null && sound.kind === 'melody'
}

export function findItem(items: LayerItem[], key: string | null): LayerItem | null {
  for (const item of items) {
    if (item.key === key) {
      return item
    }
  }
  return null
}

// Two digits with a leading zero (design.md section 7).
export function formatLayerNumber(number: number): string {
  return number < 10 ? '0' + number : String(number)
}

// 16th steps in one loop (SPEC 2.3).
export function getStepsInLoop(settings: ProjectSettings): number {
  return settings.loopBars * getStepsPerBar(settings.timeSignature)
}

// For each 16th step of the loop: does this layer start a sound there?
// Drafts have no sounds yet.
export function getStepMap(layer: Layer | null, stepsInLoop: number): boolean[] {
  const map: boolean[] = []
  for (let step = 0; step < stepsInLoop; step++) {
    map.push(false)
  }
  if (layer) {
    for (const step of getLayerSoundSteps(layer)) {
      if (step >= 0 && step < stepsInLoop) {
        map[step] = true
      }
    }
  }
  return map
}

// Loop length in seconds. Tempo is in quarter notes per minute;
// 3/4 and 6/8 bars are both 3 quarter notes long.
export function getLoopSeconds(settings: ProjectSettings): number {
  const quarterNotesPerBar = settings.timeSignature === '4/4' ? 4 : 3
  return (settings.loopBars * quarterNotesPerBar * 60) / settings.tempoBpm
}

// "00:04" (design.md section 7: MM:SS).
export function formatMinutesSeconds(seconds: number): string {
  const whole = Math.round(seconds)
  const minutes = Math.floor(whole / 60)
  const rest = whole - minutes * 60
  return pad2(minutes) + ':' + pad2(rest)
}

function pad2(value: number): string {
  return value < 10 ? '0' + value : String(value)
}
