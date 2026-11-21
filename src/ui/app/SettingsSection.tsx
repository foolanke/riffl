// Settings (SPEC 1.4, 2.1, 2.2, step 10-11, 16, 18): every setting that the
// designed page has no place for yet (design.md 10, Q7). Tempo and metronome
// on/off stay in the metronome strip.
//
// Not designed, so it is built from existing parts: a collapsible card like a
// collapsed layer card (5.9), compact rows like the metronome strip (5.4)
// with BPM-chip selects, the toggle switch, and outline buttons (5.5, 5.6).
// Collapsed by default so the sidebar doesn't overflow.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { amplitudeToDecibels } from '../../audio/hitDetection.ts'
import {
  getHitThresholdDb,
  getMicPeak,
  getSensitivity,
  isMicOn,
  onLiveHit,
  setSensitivity,
  startMic,
} from '../../audio/mic.ts'
import {
  getRecorderState,
  setMuteLayersWhileRecording,
  setTakeSpeed,
  subscribeToRecorder,
  TAKE_SPEEDS,
} from '../../audio/recorder.ts'
import {
  COUNT_IN_OPTIONS,
  KEYS,
  LOOP_BAR_OPTIONS,
  TIME_SIGNATURES,
  updateSettings,
} from '../../project/projectStore.ts'
import type { CountInBars, LoopBars, TimeSignature } from '../../project/projectStore.ts'
import { loadProjectFile, startNewProject } from '../../project/saveLoad.ts'
import { useProject } from '../hooks.ts'
import { ICONS } from './icons.ts'
import uploadIcon from './icons/icon-upload.svg'

const METER_MIN_DB = -60 // left edge of the meter; 0 dBFS is the right edge
const METER_FALL_PER_FRAME = 0.9 // so short peaks stay visible a moment
const HIT_FLASH_MS = 120
const NEW_PROJECT_CONFIRM_MS = 3000 // the "sure?" state resets after this

export function SettingsSection() {
  const [open, setOpen] = useState(false)

  return (
    <div className={'layer-card settings' + (open ? '' : ' is-collapsed')}>
      <button
        className="layer-card-header"
        type="button"
        aria-expanded={open}
        onClick={(event) => {
          setOpen(!open)
          event.currentTarget.blur() // so Space records instead of pressing this
        }}
      >
        <span className="text-item">Settings</span>
        <span className="layer-card-spacer" />
        <img src={open ? ICONS.chevronDown : ICONS.chevronRight} alt="" />
      </button>

      {open ? <SettingsBody /> : null}
    </div>
  )
}

// Only mounted while open, so the mic meter's animation frame loop only runs then.
function SettingsBody() {
  const settings = useProject().settings
  const recorder = useSyncExternalStore(subscribeToRecorder, getRecorderState)
  const takeRunning = recorder.status !== 'idle'

  return (
    <div className="settings-body">
      {/* Project setup (SPEC 2.1). Changing these mid-take would break the take. */}
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

      <div className="settings-divider" />

      {/* Recording options (SPEC 2.2, step 16). */}
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
      <SettingsRow label="Click volume" fill>
        <input
          className="settings-range"
          type="range"
          min={0}
          max={100}
          step={1}
          aria-label="Metronome volume"
          value={Math.round(settings.metronomeVolume * 100)}
          onChange={(event) => updateSettings({ metronomeVolume: Number(event.target.value) / 100 })}
          onPointerUp={(event) => event.currentTarget.blur()} // so Space records instead of moving this
        />
        <span className="settings-value text-label color-muted">{Math.round(settings.metronomeVolume * 100)}</span>
      </SettingsRow>
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
        <button
          className={'toggle-switch' + (recorder.muteLayersWhileRecording ? ' is-on' : '')}
          type="button"
          role="switch"
          aria-checked={recorder.muteLayersWhileRecording}
          aria-label="Mute other layers while recording"
          onClick={(event) => {
            setMuteLayersWhileRecording(!recorder.muteLayersWhileRecording)
            event.currentTarget.blur() // so Space records instead of pressing this
          }}
        >
          <span className="toggle-switch-knob" />
        </button>
      </SettingsRow>

      <div className="settings-divider" />

      <MicSettings />

      <div className="settings-divider" />

      <ProjectFileSettings disabled={takeRunning} />
    </div>
  )
}

interface SettingsRowProps {
  label: string
  title?: string
  fill?: boolean // the control takes the rule's place and fills the row
  children: ReactNode
}

// LABEL ──── control, like the metronome strip without its border.
function SettingsRow(props: SettingsRowProps) {
  return (
    <div className="settings-row" title={props.title}>
      <span className="text-label">{props.label}</span>
      {props.fill ? null : <div className="metronome-rule" />}
      {props.children}
    </div>
  )
}

interface ChipSelectProps {
  label: string
  value: string
  disabled: boolean
  options: { value: string; text: string }[]
  onChange: (value: string) => void
}

// A native select in the BPM chip's look (5.4).
function ChipSelect(props: ChipSelectProps) {
  return (
    <div className={'bpm-chip' + (props.disabled ? ' is-disabled' : '')}>
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
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.text.toUpperCase()}
          </option>
        ))}
      </select>
      <img src={ICONS.chevronDown} alt="" />
    </div>
  )
}

function formatBars(bars: number): string {
  return bars === 1 ? '1 bar' : bars + ' bars'
}

// Mic level meter with the hit threshold, live hit flash and sensitivity
// (SPEC 1.4, steps 10-11). Same engine calls as the test page's MicPanel.
function MicSettings() {
  const [micOn, setMicOn] = useState(isMicOn())
  const [errorText, setErrorText] = useState('')
  const [sensitivity, setSensitivityState] = useState(getSensitivity())
  const meterFillRef = useRef<HTMLDivElement>(null)
  const thresholdRef = useRef<HTMLDivElement>(null)
  const flashRef = useRef<HTMLDivElement>(null)

  async function handleEnableMic() {
    try {
      await startMic()
      setMicOn(true)
      setErrorText('')
    } catch (error) {
      console.error(error)
      setErrorText('Mic not available: ' + String(error))
    }
  }

  // Flash on every live hit, straight on the DOM (no re-render per hit).
  useEffect(function () {
    let flashTimer: number | undefined
    const unsubscribe = onLiveHit(function () {
      if (flashRef.current) {
        flashRef.current.classList.add('is-hit')
      }
      window.clearTimeout(flashTimer)
      flashTimer = window.setTimeout(function () {
        if (flashRef.current) {
          flashRef.current.classList.remove('is-hit')
        }
      }, HIT_FLASH_MS)
    })
    return function () {
      unsubscribe()
      window.clearTimeout(flashTimer)
    }
  }, [])

  // Meter: drawn every frame straight on the DOM, no React re-render.
  useEffect(function () {
    let frameId = 0
    let shownPeak = 0
    let micWasOn = isMicOn()
    function drawMeter() {
      // Recording can switch the mic on too; hide the button once it is on.
      const micNowOn = isMicOn()
      if (micNowOn !== micWasOn) {
        micWasOn = micNowOn
        setMicOn(micNowOn)
      }
      shownPeak = Math.max(getMicPeak(), shownPeak * METER_FALL_PER_FRAME)
      if (meterFillRef.current) {
        meterFillRef.current.style.width = decibelsToMeterPercent(amplitudeToDecibels(shownPeak)) + '%'
      }
      if (thresholdRef.current) {
        thresholdRef.current.style.left = decibelsToMeterPercent(getHitThresholdDb()) + '%'
      }
      frameId = requestAnimationFrame(drawMeter)
    }
    frameId = requestAnimationFrame(drawMeter)
    return function () {
      cancelAnimationFrame(frameId)
    }
  }, [])

  return (
    <>
      <div className="settings-row" title="Mic level. The marker is the hit threshold; the dot flashes on each hit.">
        <span className="text-label">Mic</span>
        <div className="mic-meter">
          <div className="mic-meter-fill" ref={meterFillRef} />
          <div className="mic-meter-threshold" ref={thresholdRef} />
        </div>
        <div className="mic-hit-dot" ref={flashRef} />
      </div>
      <SettingsRow label="Sensitivity" fill>
        <input
          className="settings-range"
          type="range"
          min={0}
          max={100}
          step={1}
          aria-label="Hit sensitivity"
          value={sensitivity}
          onChange={(event) => {
            const value = Number(event.target.value)
            setSensitivity(value)
            setSensitivityState(value)
          }}
          onPointerUp={(event) => event.currentTarget.blur()} // so Space records instead of moving this
        />
        <span className="settings-value text-label color-muted">{sensitivity}</span>
      </SettingsRow>
      {micOn ? null : (
        <button
          className="button-outline settings-button text-item"
          type="button"
          onClick={(event) => {
            handleEnableMic()
            event.currentTarget.blur()
          }}
        >
          Enable mic
        </button>
      )}
      {errorText ? <p className="settings-note text-label color-muted">{errorText}</p> : null}
    </>
  )
}

function decibelsToMeterPercent(db: number): number {
  const percent = ((db - METER_MIN_DB) / -METER_MIN_DB) * 100
  return Math.min(100, Math.max(0, percent))
}

// Load a project file and start a new project (SPEC step 18). Download stays
// in the sidebar footer.
function ProjectFileSettings(props: { disabled: boolean }) {
  const [message, setMessage] = useState('')
  const [confirmingNew, setConfirmingNew] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // "Sure? Click again" falls back to normal after a few seconds.
  useEffect(
    function () {
      if (!confirmingNew) {
        return
      }
      const timer = window.setTimeout(function () {
        setConfirmingNew(false)
      }, NEW_PROJECT_CONFIRM_MS)
      return function () {
        window.clearTimeout(timer)
      }
    },
    [confirmingNew],
  )

  async function handleFileChosen(file: File | undefined) {
    if (!file) {
      return
    }
    try {
      await loadProjectFile(file)
      setMessage('Loaded ' + file.name)
    } catch (error) {
      setMessage('Could not load that file: ' + String(error))
    }
  }

  function handleNewProject() {
    // Two clicks instead of a browser dialog, so the demo never shows one.
    if (!confirmingNew) {
      setConfirmingNew(true)
      return
    }
    setConfirmingNew(false)
    startNewProject()
    setMessage('New project started.')
  }

  return (
    <>
      <input
        ref={fileInputRef}
        className="settings-file-input"
        type="file"
        accept=".json,application/json"
        onChange={(event) => {
          handleFileChosen(event.target.files?.[0])
          event.target.value = '' // so the same file can be loaded again
        }}
      />
      <button
        className="button-outline settings-button text-item"
        type="button"
        disabled={props.disabled}
        onClick={(event) => {
          setConfirmingNew(false)
          if (fileInputRef.current) {
            fileInputRef.current.click()
          }
          event.currentTarget.blur()
        }}
      >
        <img src={uploadIcon} alt="" />
        Load
      </button>
      <button
        className="button-outline settings-button text-item"
        type="button"
        disabled={props.disabled}
        onClick={(event) => {
          handleNewProject()
          event.currentTarget.blur()
        }}
      >
        {confirmingNew ? 'Sure? Click again' : 'New project'}
      </button>
      {message ? <p className="settings-note text-label color-muted">{message}</p> : null}
    </>
  )
}
