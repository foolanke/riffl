// On/off switch (not in the design; built from its tokens).
// Off: outlined track, grey knob left. On: white track, black knob right.
import { releaseFocus } from './releaseFocus.ts'

interface ToggleSwitchProps {
  on: boolean
  label: string // read by screen readers
  title?: string // hover hint
  onChange: (on: boolean) => void
}

export function ToggleSwitch(props: ToggleSwitchProps) {
  return (
    <button
      className={'toggle-switch' + (props.on ? ' is-on' : '')}
      type="button"
      role="switch"
      aria-checked={props.on}
      aria-label={props.label}
      title={props.title}
      onClick={(event) => {
        props.onChange(!props.on)
        releaseFocus(event.currentTarget)
      }}
    >
      <span className="toggle-switch-knob" />
    </button>
  )
}
