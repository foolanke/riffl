// Outline button (design.md 5.5): 1px grey border, Item text, optional
// 16px icon before the label. Disabled look from design.md section 8.
import type { ReactNode } from 'react'
import { releaseFocus } from './releaseFocus.ts'

interface OutlineButtonProps {
  children: ReactNode
  onClick: () => void
  icon?: string // image URL from ICONS
  title?: string
  disabled?: boolean
  className?: string // extra class for layout, e.g. "settings-button"
}

export function OutlineButton(props: OutlineButtonProps) {
  const extraClass = props.className ? ' ' + props.className : ''
  return (
    <button
      className={'button-outline' + extraClass + ' text-item'}
      type="button"
      title={props.title}
      disabled={props.disabled}
      onClick={(event) => {
        props.onClick()
        releaseFocus(event.currentTarget)
      }}
    >
      {props.icon ? <img src={props.icon} alt="" /> : null}
      {props.children}
    </button>
  )
}
