// Brand badge (design.md 5.1), changed at the human's request:
// settings icon | RIFFL wordmark | logo mark.
// The settings icon (not a design asset; drawn in the icons' style) replaces
// the sidebar toggle and opens the settings overlay, on the start screen too.
import { useState } from 'react'
import { ICONS } from './icons.ts'
import settingsIcon from './icons/icon-settings.svg'
import { SettingsOverlay } from './SettingsSection.tsx'

interface BrandBadgeProps {
  audioStarted: boolean // false on the start screen: no mic settings yet
}

export function BrandBadge(props: BrandBadgeProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <div className="brand-badge">
        <button
          className="brand-toggle-cell"
          type="button"
          aria-label="Settings"
          aria-haspopup="dialog"
          title="Settings"
          onClick={(event) => {
            setSettingsOpen(true)
            event.currentTarget.blur() // so Space records instead of pressing this
          }}
        >
          <img src={settingsIcon} alt="" />
        </button>
        <div className="brand-divider" />
        <div className="brand-wordmark-cell">RIFFL</div>
        <div className="brand-divider" />
        <div className="brand-logo-cell">
          <img src={ICONS.logoMark} alt="" />
        </div>
      </div>
      {settingsOpen ? (
        <SettingsOverlay showMic={props.audioStarted} onClose={() => setSettingsOpen(false)} />
      ) : null}
    </>
  )
}
