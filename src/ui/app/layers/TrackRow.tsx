// Track row (design.md 5.12) in the bottom Layers panel.
// Drum layers: one dot per 16th step of the loop, filled where the layer
// plays (SPEC 1.5 snaps to 16ths). Each dot is a toggle so the rhythm can
// be fixed by hand. Melody layers: a score staff.
import type { ProjectSettings } from '../../../project/projectStore.ts'
import { toggleDrumLayerStep, toggleLayerMuted } from '../../../project/projectStore.ts'
import { Tick } from '../components/Glyphs.tsx'
import { releaseFocus } from '../components/releaseFocus.ts'
import { ICONS } from '../icons.ts'
import { useRecorder } from '../hooks/engineState.ts'
import { getStepMap, getStepsInLoop } from './layerItems.ts'
import { LayerVolumeSlider } from './LayerVolumeSlider.tsx'
import type { LayerItem } from './layerItems.ts'
import { ScoreStaff } from './ScoreStaff.tsx'

// isRecording: this row's take is running; LayersPanel lights the current
// step (by class, every frame, without re-rendering).
export function TrackRow(props: { item: LayerItem; settings: ProjectSettings; isRecording?: boolean }) {
  const item = props.item
  const layer = item.layer
  const isMelody = layer !== null && layer.type === 'melody'
  // No edits while a take runs: the take may replace this very layer.
  const isBusy = useRecorder().status !== 'idle'

  let className = 'track-row'
  if (isMelody) {
    className += ' is-score'
  }
  if (props.isRecording) {
    className += ' is-recording'
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
      {/* Mute toggle (SPEC 1.6), same store call as the card's MUTE and keys
          1-9, so playback follows. Allowed during a take, like those are. */}
      {layer ? (
        <button
          type="button"
          className="track-mute"
          aria-pressed={item.muted}
          aria-label={(item.muted ? 'Unmute' : 'Mute') + ' layer ' + item.number}
          title={item.muted ? 'Unmute' : 'Mute'}
          onClick={(event) => {
            toggleLayerMuted(layer.id)
            releaseFocus(event.currentTarget)
          }}
        >
          <img src={item.muted ? ICONS.volumeOff : ICONS.volumeOn} alt="" />
        </button>
      ) : null}
      {layer ? (
        <div className="track-volume">
          <LayerVolumeSlider layer={layer} number={item.number} />
        </div>
      ) : null}
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
