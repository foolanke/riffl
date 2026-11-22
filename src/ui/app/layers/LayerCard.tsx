// Layer card (design.md 5.9): collapsed = number, sound, chevron right.
// Expanded = header, RECORD, audio bar, sound (read-only), MUTE / DELETE row.
// A draft card (not recorded yet) records a new take; a recorded card retakes it.
import type { RecordStatus } from '../../../audio/recorder.ts'
import { toggleLayerMuted } from '../../../project/projectStore.ts'
import { OutlineButton } from '../components/OutlineButton.tsx'
import { RecordButton } from '../components/RecordButton.tsx'
import { releaseFocus } from '../components/releaseFocus.ts'
import { ICONS } from '../icons.ts'
import { AudioBar } from './AudioBar.tsx'
import type { LayerItem } from './layerItems.ts'

const RECORD_LABELS: Record<RecordStatus, string> = {
  idle: 'Record',
  countIn: 'Count-in',
  recording: 'Recording',
  processing: 'Processing',
}

interface LayerCardProps {
  item: LayerItem
  expanded: boolean
  recorderStatus: RecordStatus
  isRecordingThis: boolean // this card's take is the one in progress
  message: string // status or result of the last take; '' = none
  onActivate: () => void
  onRecord: () => void
  onDelete: () => void // recorded layer: from the project; draft: from the page
}

export function LayerCard(props: LayerCardProps) {
  const item = props.item
  const isBusy = props.recorderStatus !== 'idle'

  let className = 'layer-card'
  if (!props.expanded) {
    className += ' is-collapsed'
  }
  if (item.muted) {
    className += ' is-muted'
  }

  return (
    <div className={className}>
      <button
        className="layer-card-header"
        type="button"
        aria-expanded={props.expanded}
        onClick={(event) => {
          props.onActivate()
          releaseFocus(event.currentTarget)
        }}
      >
        <span className="text-item">{item.number}</span>
        <span className="text-item">{item.soundLabel}</span>
        <span className="layer-card-spacer" />
        <img src={props.expanded ? ICONS.chevronDown : ICONS.chevronRight} alt="" />
      </button>

      {props.expanded ? (
        <div className="layer-card-body">
          <RecordButton
            label={props.isRecordingThis ? RECORD_LABELS[props.recorderStatus] : RECORD_LABELS.idle}
            recording={props.isRecordingThis && props.recorderStatus === 'recording'}
            disabled={isBusy}
            onClick={props.onRecord}
          />

          <AudioBar layer={item.layer} />

          {/* The sound is chosen once, from ADD LAYER, so here it is a
              read-only label in the Select's box (same place and size). */}
          <div className="select is-readonly text-item">{item.soundLabel.toUpperCase()}</div>

          {/* Mute and delete (SPEC 1.6). A draft has nothing to mute yet. */}
          <div className="layer-card-actions">
            <OutlineButton
              disabled={item.layer === null}
              onClick={() => {
                if (item.layer) {
                  toggleLayerMuted(item.layer.id)
                }
              }}
            >
              {item.muted ? 'Unmute' : 'Mute'}
            </OutlineButton>
            <OutlineButton disabled={isBusy} onClick={props.onDelete}>
              Delete
            </OutlineButton>
          </div>

          {props.message ? <p className="layer-card-message text-label color-muted">{props.message}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
