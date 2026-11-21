// Select (design.md 5.8): full-width, 40 tall, 1px grey border, value in
// Item text and a chevron on the right. Pass <option>/<optgroup> children.
import type { ReactNode } from 'react'
import { ICONS } from '../icons.ts'

interface SelectProps {
  label: string // read by screen readers
  value: string
  disabled?: boolean
  onChange: (value: string) => void
  children: ReactNode
}

export function Select(props: SelectProps) {
  return (
    <div className={'select' + (props.disabled ? ' is-disabled' : '')}>
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
        {props.children}
      </select>
      <img src={ICONS.chevronDown} alt="" />
    </div>
  )
}
