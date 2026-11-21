// Settings (SPEC 1.4, 2.1, 2.2, steps 10-11, 16, 18): every setting the
// designed page has no place for (design.md 10, Q7). Tempo and metronome
// on/off stay in the metronome strip.
//
// Opened from the settings icon in the brand badge, over the middle 75% of
// the screen (human's request). Not designed, so built from existing parts:
// compact rows like the metronome strip (5.4) with BPM-chip selects, the
// toggle switch, and outline buttons (5.5, 5.6), in boxed groups.
// Esc, CLOSE or a click outside the panel closes it.
import { useEffect } from 'react'
import { setMuteLayersWhileRecording, setTakeSpeed, TAKE_SPEEDS } from '../../../audio/recorder.ts'
import {
  COUNT_IN_OPTIONS,
  KEYS,
  LOOP_BAR_OPTIONS,
  TIME_SIGNATURES,
  updateSettings,
} from '../../../project/projectStore.ts'
import type { CountInBars, LoopBars, TimeSignature } from '../../../project/projectStore.ts'
import { useProject } from '../../hooks.ts'
import { ChipSelect } from '../components/ChipSelect.tsx'
import { OutlineButton } from '../components/OutlineButton.tsx'
import { ToggleSwitch } from '../components/ToggleSwitch.tsx'
import { useRecorder } from '../hooks/engineState.ts'
import { MicSettings } from './MicSettings.tsx'
import { ProjectFileSettings } from './ProjectFileSettings.tsx'
import { SettingsGroup, SettingsRow, SliderRow } from './SettingsRow.tsx'

interface SettingsOverlayProps {
  showMic: boolean // false on the start screen: the mic needs audio started first
  onClose: () => void
}

export function SettingsOverlay(props: SettingsOverlayProps) {
  const onClose = props.onClose

  // Esc closes the overlay.
  useEffect(
    function () {
      function handleKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
          onClose()
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return function () {
        window.removeEventListener('keydown', handleKeyDown)
      }
    },
    [onClose],
  )

  return (
    <div
      className="settings-backdrop"
      onPointerDown={(event) => {
        // Only a click on the dimmed area itself, not inside the panel.
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="settings-panel" role="dialog" aria-label="Settings">
        <div className="settings-panel-header">
          <span className="text-title">Settings</span>
          <div className="layers-header-spacer" />
          <OutlineButton onClick={onClose}>Close</OutlineButton>
        </div>
        <SettingsBody showMic={props.showMic} />
      </div>
    </div>
  )
}

// Only mounted while open, so the mic meter's animation frame loop only runs then.
function SettingsBody(props: { showMic: boolean }) {
  const settings = useProject().settings
  const recorder = useRecorder()
  // Changing these mid-take would break the take.
  const takeRunning = recorder.status !== 'idle'

  return (
    <div className="settings-body">
      {/* Project setup (SPEC 2.1). */}
      <SettingsGroup title="Project">
        <SettingsRow label="Time signature">
          <ChipSelect
            label="Time signature"
            value={settings.timeSignature}
            disabled={takeRunning}
            options={TIME_SIGNATURES.map((signature) => ({ value: signature, text: signature }))}
            onChange={(value) => updateSettings({ timeSignature: value as TimeSignature })}
          />
        </SettingsRow>
        <SettingsRow label="Loop length">
          <ChipSelect
            label="Loop length"
            value={String(settings.loopBars)}
            disabled={takeRunning}
            options={LOOP_BAR_OPTIONS.map((bars) => ({ value: String(bars), text: formatBars(bars) }))}
            onChange={(value) => updateSettings({ loopBars: Number(value) as LoopBars })}
          />
        </SettingsRow>
        <SettingsRow label="Key">
          <ChipSelect
            label="Key"
            value={settings.key}
            disabled={takeRunning}
            options={KEYS.map((key) => ({ value: key, text: key }))}
            onChange={(value) => updateSettings({ key: value })}
          />
        </SettingsRow>
      </SettingsGroup>

      {/* Recording options (SPEC 2.2, step 16). */}
      <SettingsGroup title="Recording">
        <SettingsRow label="Count-in">
          <ChipSelect
            label="Count-in"
            value={String(settings.countInBars)}
            disabled={takeRunning}
            options={COUNT_IN_OPTIONS.map((bars) => ({
              value: String(bars),
              text: bars === 0 ? 'Off' : formatBars(bars),
            }))}
            onChange={(value) => updateSettings({ countInBars: Number(value) as CountInBars })}
          />
        </SettingsRow>
        <SliderRow
          label="Click volume"
          ariaLabel="Metronome volume"
          value={Math.round(settings.metronomeVolume * 100)}
          onChange={(value) => updateSettings({ metronomeVolume: value / 100 })}
        />
        <SettingsRow label="Take speed">
          <ChipSelect
            label="Take speed"
            value={String(recorder.takeSpeed)}
            disabled={takeRunning}
            options={TAKE_SPEEDS.map((speed) => ({ value: String(speed), text: speed + 'x' }))}
            onChange={(value) => setTakeSpeed(Number(value))}
          />
        </SettingsRow>
        <SettingsRow label="Mute other layers" title="Mute the other layers while recording (metronome only)">
          <ToggleSwitch
            on={recorder.muteLayersWhileRecording}
            label="Mute other layers while recording"
            onChange={setMuteLayersWhileRecording}
          />
        </SettingsRow>
      </SettingsGroup>

      {props.showMic ? (
        <SettingsGroup title="Mic">
          <MicSettings />
        </SettingsGroup>
      ) : null}

      <SettingsGroup title="Project file">
        <ProjectFileSettings disabled={takeRunning} />
      </SettingsGroup>
    </div>
  )
}

function formatBars(bars: number): string {
  return bars === 1 ? '1 bar' : bars + ' bars'
}
