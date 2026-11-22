// Track row (design.md 5.12) in the bottom Layers panel.
// Drum layers: one dot per 16th step of the loop, filled where the layer
// plays (SPEC 1.5 snaps to 16ths). Each dot is a toggle so the rhythm can
// be fixed by hand. Melody layers: a score staff.
import type { ProjectSettings } from '../../../project/projectStore.ts'
import { toggleDrumLayerStep } from '../../../project/projectStore.ts'
import { Tick } from '../components/Glyphs.tsx'
import { releaseFocus } from '../components/releaseFocus.ts'
import { useRecorder } from '../hooks/engineState.ts'
import { getStepMap, getStepsInLoop } from './layerItems.ts'
import type { LayerItem } from './layerItems.ts'
import { ScoreStaff } from './ScoreStaff.tsx'

export function TrackRow(props: { item: LayerItem; settings: ProjectSettings }) {
  const item = props.item
  const layer = item.layer
  const isMelody = layer !== null && layer.type === 'melody'
  // No edits while a take runs: the take may replace this very layer.
  const isBusy = useRecorder().status !== 'idle'

  let className = 'track-row'
  if (isMelody) {
    className += ' is-score'
  }
  if (item.muted) {
    className += ' is-muted'
  }

  return (
    <div className={className}>
      <div className="track-label">
        <span className="text-label color-muted">Layer {item.number}</span>
        <span className="text-item">{item.soundLabel}</span>
      </div>
      <Tick />
      {layer && layer.type === 'melody' ? (
        <ScoreStaff layer={layer} settings={props.settings} />
      ) : (
        <div className="track-steps">
          {getStepMap(layer, getStepsInLoop(props.settings)).map((isOn, step) => {
            // Drafts have no stored rhythm to edit, so their dots stay plain.
            if (!layer) {
              return <div key={step} className={'step' + (isOn ? ' is-on' : '')} />
            }
            return (
              <button
                key={step}
                type="button"
                className={'step is-toggle' + (isOn ? ' is-on' : '')}
                aria-pressed={isOn}
                aria-label={'Step ' + (step + 1)}
                disabled={isBusy}
                onClick={(event) => {
                  toggleDrumLayerStep(layer.id, step)
                  releaseFocus(event.currentTarget)
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
