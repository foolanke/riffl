// The bottom Layers panel (design.md 4.1): LAYERS title, bar/beat readout,
// PLAY/STOP, UNDO and ADD LAYER, then
// the empty-state text, or one track row per recorded layer.
//
// Drum rows: one dot per 16th step of the loop, filled where the layer plays
// (SPEC 1.5 snaps to 16ths). Melody rows: a score staff (ScoreTrack.tsx).
// Newest layer first, as in the design.
import { useProject } from '../hooks.ts'
import { ICONS } from './icons.ts'
import { ScoreStaff } from './ScoreTrack.tsx'
import { getStepMap, getStepsInLoop } from './layerItems.ts'
import { BeatReadout, TransportButtons } from './TransportControls.tsx'
import type { LayerItem } from './layerItems.ts'

interface LayersPanelProps {
  items: LayerItem[]
  onAddLayer: () => void
}

export function LayersPanel(props: LayersPanelProps) {
  const settings = useProject().settings
  const stepsInLoop = getStepsInLoop(settings)

  const recordedNewestFirst: LayerItem[] = []
  for (let i = props.items.length - 1; i >= 0; i--) {
    if (props.items[i].layer !== null) {
      recordedNewestFirst.push(props.items[i])
    }
  }

  return (
    <div className="layers-panel">
      <div className="layers-header">
        <span className="text-title">Layers</span>
        <BeatReadout />
        <div className="layers-header-spacer" />
        <TransportButtons />
        <button
          className="button-outline text-item"
          type="button"
          onClick={(event) => {
            props.onAddLayer()
            event.currentTarget.blur() // so Space records instead of adding another layer
          }}
        >
          <img src={ICONS.plus} alt="" />
          Add layer
        </button>
      </div>

      {recordedNewestFirst.length === 0 ? (
        <div className="layers-empty">
          <span className="text-label color-muted">No layers yet. Record one to start your loop.</span>
        </div>
      ) : (
        <div className="tracks">
          {recordedNewestFirst.map((item) => {
            const layer = item.layer
            let className = 'track-row'
            if (layer && layer.type === 'melody') {
              className += ' is-score'
            }
            if (item.muted) {
              className += ' is-muted'
            }
            return (
              <div key={item.key} className={className}>
                <div className="track-label">
                  <span className="text-label color-muted">Layer {item.number}</span>
                  <span className="text-item">{item.soundLabel}</span>
                </div>
                <div className="tick" />
                {layer && layer.type === 'melody' ? (
                  <ScoreStaff layer={layer} settings={settings} />
                ) : (
                  <div className="track-steps">
                    {getStepMap(layer, stepsInLoop).map((isOn, step) => (
                      <div key={step} className={'step' + (isOn ? ' is-on' : '')} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
