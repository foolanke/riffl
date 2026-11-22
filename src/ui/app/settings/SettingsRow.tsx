// Building blocks of the settings overlay (not in the design; built from
// the metronome strip 5.4 and the section title 5.2).
import type { ReactNode } from 'react'
import { Rule, SectionTitle } from '../components/Glyphs.tsx'

// One boxed group: a section title, then its rows.
export function SettingsGroup(props: { title: string; children: ReactNode }) {
  return (
    <div className="settings-group">
      <SectionTitle>{props.title}</SectionTitle>
      {props.children}
    </div>
  )
}

interface SettingsRowProps {
  label: string
  title?: string // hover hint
  fill?: boolean // the control takes the rule's place and fills the row
  children: ReactNode
}

// LABEL ──── control, like the metronome strip without its border.
export function SettingsRow(props: SettingsRowProps) {
  return (
    <div className="settings-row" title={props.title}>
      <span className="text-label">{props.label}</span>
      {props.fill ? null : <Rule />}
      {props.children}
    </div>
  )
}

interface SliderRowProps {
  label: string
  ariaLabel: string
  value: number // 0-100
  onChange: (value: number) => void
}

// LABEL [slider] 42 — a 0-100 range input with its value on the right.
export function SliderRow(props: SliderRowProps) {
  return (
    <SettingsRow label={props.label} fill>
      <input
        className="settings-range"
        type="range"
        min={0}
        max={100}
        step={1}
        aria-label={props.ariaLabel}
        value={props.value}
        onChange={(event) => props.onChange(Number(event.target.value))}
        onPointerUp={(event) => event.currentTarget.blur()} // so Space records instead of moving this
      />
      <span className="settings-value text-label color-muted">{props.value}</span>
    </SettingsRow>
  )
}

// A short muted line under a group: a result or a problem.
export function SettingsNote(props: { text: string }) {
  return <p className="settings-note text-label color-muted">{props.text}</p>
}
