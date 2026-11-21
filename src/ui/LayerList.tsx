// The list of layers with mute, retake and delete (SPEC steps 9, 17).
// Keys 1-9 also toggle mute; that's handled in App.
import { useSyncExternalStore } from 'react'
import { getDrumLabel } from '../audio/drums.ts'
import { getInstrumentLabel } from '../audio/instruments.ts'
import { getRecorderState, recordTake, subscribeToRecorder } from '../audio/recorder.ts'
import { addLayers, deleteLayer, getProject, toggleLayerMuted } from '../project/projectStore.ts'
import type { Layer } from '../project/projectStore.ts'
import { createTestLayers } from '../project/testLayers.ts'
import { useProject } from './hooks.ts'

export function LayerList() {
  const layers = useProject().layers
  const recorder = useSyncExternalStore(subscribeToRecorder, getRecorderState)
  const isBusy = recorder.status !== 'idle'

  function handleAddTestLayers() {
    addLayers(createTestLayers(getProject().settings))
  }

  return (
    <fieldset>
      <legend>Layers</legend>
      <button onClick={handleAddTestLayers}>Add test layers (kick, clap, open hi-hat)</button>
      {layers.length === 0 ? <p>No layers yet.</p> : null}
      <ol>
        {layers.map((layer, index) => (
          <li key={layer.id}>
            {getLayerLabel(layer)}
            {layer.muted ? ' [muted]' : ''}
            {recorder.retakeLayerId === layer.id ? ' [RETAKING]' : ''}{' '}
            <button onClick={() => toggleLayerMuted(layer.id)}>
              {layer.muted ? 'Unmute' : 'Mute'}
              {index < 9 ? ` (${index + 1})` : ''}
            </button>{' '}
            <button onClick={() => recordTake(layer.id)} disabled={isBusy}>
              Retake
            </button>{' '}
            <button onClick={() => deleteLayer(layer.id)} disabled={isBusy}>
              Delete
            </button>
          </li>
        ))}
      </ol>
    </fieldset>
  )
}

// "Kick (8 hits)" or "Chord pad (6 notes)".
function getLayerLabel(layer: Layer): string {
  if (layer.type === 'drum') {
    return `${getDrumLabel(layer.drum)} (${layer.hits.length} hits)`
  }
  return `${getInstrumentLabel(layer.instrument)} (${layer.notes.length} notes)`
}
