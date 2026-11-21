// Download button (design.md 5.7): the one white-filled, primary button.
// Disabled (grey) while there is nothing to save.
import { ICONS } from '../icons.ts'
import { releaseFocus } from './releaseFocus.ts'

interface DownloadButtonProps {
  disabled: boolean
  onClick: () => void
}

export function DownloadButton(props: DownloadButtonProps) {
  return (
    <button
      className="button-filled button-download text-item"
      type="button"
      disabled={props.disabled}
      onClick={(event) => {
        props.onClick()
        releaseFocus(event.currentTarget)
      }}
    >
      <img src={props.disabled ? ICONS.downloadDisabled : ICONS.download} alt="" />
      Download
    </button>
  )
}
