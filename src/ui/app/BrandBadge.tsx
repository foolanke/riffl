// Brand badge (design.md 5.1), order swapped at the human's request:
// left cell | RIFFL wordmark | logo mark.
// In the sidebar the left cell is the sidebar toggle. The start screen has no
// sidebar, so there it shows the audio waveform icon (a design asset) instead.
import { ICONS } from './icons.ts'
import audioWaveform from './icons/icon-audio-waveform.svg'

interface BrandBadgeProps {
  showSidebarToggle?: boolean // false on the start screen
}

export function BrandBadge(props: BrandBadgeProps) {
  const showSidebarToggle = props.showSidebarToggle !== false
  return (
    <div className="brand-badge">
      {showSidebarToggle ? (
        // The collapsed sidebar isn't designed yet, so this does nothing for now.
        <button className="brand-toggle-cell" type="button" aria-label="Sidebar toggle (not available yet)" tabIndex={-1}>
          <img src={ICONS.sidebar} alt="" />
        </button>
      ) : (
        <div className="brand-toggle-cell">
          <span className="brand-icon-box">
            <img src={audioWaveform} alt="" />
          </span>
        </div>
      )}
      <div className="brand-divider" />
      <div className="brand-wordmark-cell">RIFFL</div>
      <div className="brand-divider" />
      <div className="brand-logo-cell">
        <img src={ICONS.logoMark} alt="" />
      </div>
    </div>
  )
}
