// The list of layers with mute and delete (SPEC step 9).
// Keys 1-9 also toggle mute; that's handled in App.
import { getDrumLabel } from '../audio/drums.ts'
import { addLayers, deleteLayer, getProject, toggleLayerMuted } from '../project/projectStore.ts'
import { createTestLayers } from '../project/testLayers.ts'
import { useProject } from './hooks.ts'

export function LayerList() {
  const layers = useProject().layers

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
            {getDrumLabel(layer.drum)} ({layer.hits.length} hits)
            {layer.muted ? ' [muted]' : ''}{' '}
            <button onClick={() => toggleLayerMuted(layer.id)}>
              {layer.muted ? 'Unmute' : 'Mute'}
              {index < 9 ? ` (${index + 1})` : ''}
            </button>{' '}
            <button onClick={() => deleteLayer(layer.id)}>Delete</button>
          </li>
        ))}
      </ol>
    </fieldset>
  )
}
