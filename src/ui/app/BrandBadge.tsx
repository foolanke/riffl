// Brand badge (design.md 5.1), order swapped at the human's request:
// sidebar toggle | RIFFL wordmark | logo mark.
import { ICONS } from './icons.ts'

export function BrandBadge() {
  return (
    <div className="brand-badge">
      {/* Sidebar toggle first and logo last: swapped from the design at the human's request. */}
      {/* The collapsed sidebar isn't designed yet, so this does nothing for now. */}
      <button className="brand-toggle-cell" type="button" aria-label="Sidebar toggle (not available yet)" tabIndex={-1}>
        <img src={ICONS.sidebar} alt="" />
      </button>
      <div className="brand-divider" />
      <div className="brand-wordmark-cell">RIFFL</div>
      <div className="brand-divider" />
      <div className="brand-logo-cell">
        <img src={ICONS.logoMark} alt="" />
      </div>
    </div>
  )
}
