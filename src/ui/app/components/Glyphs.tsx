// Small shared pieces of the design language.
import type { ReactNode } from 'react'

// Section title (design.md 5.2): Label text, white, 8px side padding.
export function SectionTitle(props: { children: ReactNode }) {
  return <div className="section-title text-label">{props.children}</div>
}

// Glyph/Tick (design.md 2.5): 1 x 16 white bar.
export function Tick() {
  return <div className="tick" />
}

// Rule (design.md 2.5): a 1px grey line that fills the space between a
// label and its control, as in the metronome strip.
export function Rule() {
  return <div className="metronome-rule" />
}
