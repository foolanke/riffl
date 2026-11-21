// HUD strip (design.md 5.16), top left of the camera:
// | SESSION 01 | context label |
import { Tick } from '../components/Glyphs.tsx'

export function HudStrip(props: { label: string }) {
  return (
    <div className="hud-strip">
      <Tick />
      <span className="hud-session text-label">Session 01</span>
      <Tick />
      <span className="text-label">{props.label}</span>
      <Tick />
    </div>
  )
}
