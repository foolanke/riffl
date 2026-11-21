// Select (design.md 5.8): full-width, 40 tall, 1px grey border, value in
// Item text and a chevron on the right, with an animated option list
// (Dropdown). Options can be split into labelled groups.
import { Dropdown } from './Dropdown.tsx'
import type { DropdownGroup } from './Dropdown.tsx'

export type SelectGroup = DropdownGroup

interface SelectProps {
  label: string // read by screen readers
  value: string
  groups: SelectGroup[]
  disabled?: boolean
  onChange: (value: string) => void
}

export function Select(props: SelectProps) {
  return (
    <Dropdown
      variant="select"
      label={props.label}
      value={props.value}
      groups={props.groups}
      disabled={props.disabled}
      onChange={props.onChange}
    />
  )
}
