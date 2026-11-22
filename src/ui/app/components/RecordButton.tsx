// Record button (design.md 5.3): grey filled, red record icon, Item label.
// While recording, the icon pulses (design.md section 8, .is-recording).
import { ICONS } from '../icons.ts'
import { releaseFocus } from './releaseFocus.ts'

interface RecordButtonProps {
  label: string // "Record", "Count-in", "Recording" ...
  recording: boolean // pulse the icon
  disabled: boolean
  onClick: () => void
}

export function RecordButton(props: RecordButtonProps) {
  return (
    <button
      className={'button-filled button-record text-item' + (props.recording ? ' is-recording' : '')}
      type="button"
      disabled={props.disabled}
      onClick={(event) => {
        props.onClick()
        releaseFocus(event.currentTarget)
      }}
    >
      <img src={ICONS.record} alt="" />
      {props.label}
    </button>
  )
}
