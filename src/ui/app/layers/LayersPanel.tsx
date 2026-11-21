// The bottom Layers panel (design.md 4.1): LAYERS title, bar/beat readout,
// PLAY/STOP, UNDO and ADD LAYER, then the empty-state text, or one track
// row per recorded layer. Newest layer first, as in the design.
import { useProject } from '../../hooks.ts'
import { OutlineButton } from '../components/OutlineButton.tsx'
import { ICONS } from '../icons.ts'
import type { LayerItem } from './layerItems.ts'
import { TrackRow } from './TrackRow.tsx'
import { BeatReadout, TransportButtons } from './TransportControls.tsx'

interface LayersPanelProps {
  items: LayerItem[]
  onAddLayer: () => void
}

export function LayersPanel(props: LayersPanelProps) {
  const settings = useProject().settings

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
        <OutlineButton icon={ICONS.plus} onClick={props.onAddLayer}>
          Add layer
        </OutlineButton>
      </div>

      {recordedNewestFirst.length === 0 ? (
        <div className="layers-empty">
          <span className="text-label color-muted">No layers yet. Record one to start your loop.</span>
        </div>
      ) : (
        <div className="tracks">
          {recordedNewestFirst.map((item) => (
            <TrackRow key={item.key} item={item} settings={settings} />
          ))}
        </div>
      )}
    </div>
  )
}
