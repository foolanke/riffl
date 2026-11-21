// A native select in the BPM chip's look (design.md 5.4): grey chip, Item
// text, chevron. Used for tempo and the compact settings.
import { ICONS } from '../icons.ts'

export interface ChipOption {
  value: string
  text: string
}

interface ChipSelectProps {
  label: string // read by screen readers
  value: string
  options: ChipOption[]
  disabled?: boolean
  onChange: (value: string) => void
}

export function ChipSelect(props: ChipSelectProps) {
  return (
    <div className={'bpm-chip' + (props.disabled ? ' is-disabled' : '')}>
      <select
        className="text-item"
        aria-label={props.label}
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => {
          props.onChange(event.target.value)
          event.target.blur() // so Space records instead of opening the list
        }}
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.text.toUpperCase()}
          </option>
        ))}
      </select>
      <img src={ICONS.chevronDown} alt="" />
    </div>
  )
}
