// A dropdown that animates (native <select> lists can't): the option list
// fades in while sliding from the trigger, and out again on close; the
// chevron turns. Used by Select (design.md 5.8) and ChipSelect (the BPM
// chip, 5.4); closed, it looks exactly like them. The 'menu' variant is an
// action menu (ADD LAYER): the trigger is any button look, nothing is
// selected, and every pick calls onChange.
//
// The list is drawn in #root (so the page zoom applies) with fixed
// positioning, so a parent with overflow: hidden (sidebar, settings panel)
// can't clip it. Mouse: click to open, click an option. Keyboard: arrows,
// Enter, Escape. After a choice, focus leaves the trigger so Space records.
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { usePresence } from '../hooks/usePresence.ts'
import { ICONS } from '../icons.ts'
import { releaseFocus } from './releaseFocus.ts'

export interface DropdownOption {
  value: string
  text: string
}

export interface DropdownGroup {
  label?: string // heading above the group, e.g. "DRUMS"
  options: DropdownOption[]
}

interface DropdownProps {
  variant: 'select' | 'chip' | 'menu' // full-width Select, the small BPM chip, or an action menu
  label: string // read by screen readers
  value: string // '' in a menu: nothing is selected
  groups: DropdownGroup[]
  disabled?: boolean
  onChange: (value: string) => void
  triggerClassName?: string // menu only: the trigger button's look
  children?: ReactNode // menu only: the trigger button's content
}

const ANIMATION_MS = 120 // keep in step with the dropdown-menu animations in components.css
const MENU_MAX_HEIGHT = 280
const MENU_GAP = 4 // between the trigger and the list

interface MenuPlace {
  left: number
  top: number | null // below the trigger
  bottom: number | null // above the trigger (not enough room below)
  minWidth: number
}

export function Dropdown(props: DropdownProps) {
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const [place, setPlace] = useState<MenuPlace | null>(null)
  const presence = usePresence(open, ANIMATION_MS)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const allOptions: DropdownOption[] = []
  for (const group of props.groups) {
    for (const option of group.options) {
      allOptions.push(option)
    }
  }
  let selectedText = ''
  for (const option of allOptions) {
    if (option.value === props.value) {
      selectedText = option.text
    }
  }

  function openMenu() {
    if (props.disabled || !triggerRef.current) {
      return
    }
    setPlace(measurePlace(triggerRef.current))
    setHighlighted(props.value === '' ? null : props.value) // a menu starts with nothing highlighted
    setOpen(true)
  }

  function closeMenu() {
    setOpen(false)
    if (triggerRef.current) {
      releaseFocus(triggerRef.current)
    }
  }

  function choose(value: string) {
    // A menu is an action: every pick counts, even the same one twice.
    if (props.variant === 'menu' || value !== props.value) {
      props.onChange(value)
    }
    closeMenu()
  }

  // A take started (controls disabled): close.
  useEffect(
    function () {
      if (props.disabled && open) {
        setOpen(false)
      }
    },
    [props.disabled, open],
  )

  // While open: a click elsewhere, a resize or a scroll outside the list closes it.
  useEffect(
    function () {
      if (!open) {
        return
      }
      function isInside(target: EventTarget | null): boolean {
        const node = target as Node | null
        return (
          node !== null &&
          ((triggerRef.current !== null && triggerRef.current.contains(node)) ||
            (menuRef.current !== null && menuRef.current.contains(node)))
        )
      }
      function handlePointerDown(event: PointerEvent) {
        if (!isInside(event.target)) {
          setOpen(false)
        }
      }
      function handleScroll(event: Event) {
        if (!isInside(event.target)) {
          setOpen(false)
        }
      }
      function handleResize() {
        setOpen(false)
      }
      document.addEventListener('pointerdown', handlePointerDown, true)
      document.addEventListener('scroll', handleScroll, true)
      window.addEventListener('resize', handleResize)
      return function () {
        document.removeEventListener('pointerdown', handlePointerDown, true)
        document.removeEventListener('scroll', handleScroll, true)
        window.removeEventListener('resize', handleResize)
      }
    },
    [open],
  )

  // On open, scroll the chosen option into the middle of a long list (tempo).
  useEffect(
    function () {
      const menu = menuRef.current
      if (!presence.mounted || !menu) {
        return
      }
      const selected = menu.querySelector<HTMLElement>('.dropdown-option.is-selected')
      if (selected) {
        menu.scrollTop = selected.offsetTop - menu.clientHeight / 2 + selected.offsetHeight / 2
      }
    },
    [presence.mounted],
  )

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter') {
        event.preventDefault()
        openMenu()
      }
      return
    }
    if (event.key === 'Escape') {
      // Don't let Escape also close the settings overlay behind the list.
      event.preventDefault()
      event.stopPropagation()
      closeMenu()
    } else if (event.key === 'Tab') {
      setOpen(false)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const index = findIndex(allOptions, highlighted)
      const step = event.key === 'ArrowDown' ? 1 : -1
      const next = Math.min(allOptions.length - 1, Math.max(0, index + step))
      setHighlighted(allOptions[next].value)
      scrollOptionIntoView(menuRef.current, allOptions[next].value)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (highlighted !== null) {
        choose(highlighted)
      }
    }
  }

  let wrapperClass = 'select'
  if (props.variant === 'chip') {
    wrapperClass = 'bpm-chip'
  } else if (props.variant === 'menu') {
    wrapperClass = 'dropdown-action'
  }
  if (props.disabled) {
    wrapperClass += ' is-disabled'
  }
  if (open) {
    wrapperClass += ' is-open'
  }

  let menuClass = 'dropdown-menu'
  if (presence.closing) {
    menuClass += ' is-closing'
  }
  if (place && place.bottom !== null) {
    menuClass += ' is-above'
  }

  const root = document.getElementById('root')

  return (
    <div className={wrapperClass}>
      <button
        ref={triggerRef}
        className={props.variant === 'menu' ? props.triggerClassName : 'dropdown-trigger text-item'}
        type="button"
        aria-label={props.label}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={props.disabled}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={handleKeyDown}
      >
        {props.variant === 'menu' ? (
          props.children
        ) : (
          <>
            {/* Every option, stacked and hidden, so the trigger is as wide as
                the widest one (like a native select) and never jumps in size. */}
            <span className="dropdown-value">{selectedText.toUpperCase()}</span>
            {allOptions.map((option) => (
              <span key={option.value} className="dropdown-sizer" aria-hidden="true">
                {option.text.toUpperCase()}
              </span>
            ))}
          </>
        )}
      </button>
      {props.variant === 'menu' ? null : <img src={ICONS.chevronDown} alt="" />}

      {presence.mounted && place && root
        ? createPortal(
            <div
              ref={menuRef}
              className={menuClass}
              role="listbox"
              aria-label={props.label}
              style={{
                left: place.left,
                top: place.top !== null ? place.top : undefined,
                bottom: place.bottom !== null ? place.bottom : undefined,
                minWidth: place.minWidth,
                maxHeight: MENU_MAX_HEIGHT,
              }}
            >
              {props.groups.map((group, groupIndex) => (
                <div key={groupIndex} role="group" aria-label={group.label}>
                  {group.label ? <div className="dropdown-group-label text-label">{group.label}</div> : null}
                  {group.options.map((option) => {
                    let optionClass = 'dropdown-option text-item'
                    if (option.value === props.value) {
                      optionClass += ' is-selected'
                    }
                    if (option.value === highlighted) {
                      optionClass += ' is-highlighted'
                    }
                    return (
                      <div
                        key={option.value}
                        className={optionClass}
                        role="option"
                        aria-selected={option.value === props.value}
                        data-value={option.value}
                        onPointerEnter={() => setHighlighted(option.value)}
                        onClick={() => choose(option.value)}
                      >
                        {option.text.toUpperCase()}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>,
            root,
          )
        : null}
    </div>
  )
}

// Where the list goes, in #root's layout pixels. The page is zoomed
// (--ui-scale on #root), and fixed positions inside #root are zoomed too, so
// screen pixels from getBoundingClientRect are divided by the zoom.
function measurePlace(trigger: HTMLElement): MenuPlace {
  const root = document.getElementById('root')
  const rect = trigger.getBoundingClientRect()
  let zoom = 1
  if (root && root.clientWidth > 0) {
    zoom = root.getBoundingClientRect().width / root.clientWidth
  }
  const left = rect.left / zoom
  const top = rect.top / zoom
  const bottom = rect.bottom / zoom
  const viewportHeight = window.innerHeight / zoom
  const spaceBelow = viewportHeight - bottom - MENU_GAP
  const spaceAbove = top - MENU_GAP
  const minWidth = rect.width / zoom
  if (spaceBelow < MENU_MAX_HEIGHT && spaceAbove > spaceBelow) {
    return { left: left, top: null, bottom: viewportHeight - top + MENU_GAP, minWidth: minWidth }
  }
  return { left: left, top: bottom + MENU_GAP, bottom: null, minWidth: minWidth }
}

function findIndex(options: DropdownOption[], value: string | null): number {
  for (let i = 0; i < options.length; i++) {
    if (options[i].value === value) {
      return i
    }
  }
  return 0
}

function scrollOptionIntoView(menu: HTMLElement | null, value: string) {
  if (!menu) {
    return
  }
  for (const element of menu.querySelectorAll<HTMLElement>('.dropdown-option')) {
    if (element.dataset.value === value) {
      element.scrollIntoView({ block: 'nearest' })
    }
  }
}
