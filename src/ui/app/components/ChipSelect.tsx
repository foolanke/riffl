// The BPM chip's look (design.md 5.4): grey chip, Item text, chevron, with
// an animated option list (Dropdown). Used for tempo and compact settings.
import { Dropdown } from './Dropdown.tsx'
import type { DropdownOption } from './Dropdown.tsx'

export type ChipOption = DropdownOption

interface ChipSelectProps {
  label: string // read by screen readers
  value: string
  options: ChipOption[]
  disabled?: boolean
  onChange: (value: string) => void
}

export function ChipSelect(props: ChipSelectProps) {
  return (
    <Dropdown
      variant="chip"
      label={props.label}
      value={props.value}
      groups={[{ options: props.options }]}
      disabled={props.disabled}
      onChange={props.onChange}
    />
  )
}
