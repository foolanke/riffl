// Mic level meter with the hit threshold, live hit flash and sensitivity
// (SPEC 1.4, steps 10-11). Same engine calls as the test page's MicPanel.
// The meter and flash are drawn straight on the DOM, never by re-rendering.
import { useEffect, useRef, useState } from 'react'
import { amplitudeToDecibels } from '../../../audio/hitDetection.ts'
import {
  getHitThresholdDb,
  getMicPeak,
  getSensitivity,
  isMicOn,
  onLiveHit,
  setSensitivity,
  startMic,
} from '../../../audio/mic.ts'
import { OutlineButton } from '../components/OutlineButton.tsx'
import { SettingsNote, SliderRow } from './SettingsRow.tsx'

const METER_MIN_DB = -60 // left edge of the meter; 0 dBFS is the right edge
const METER_FALL_PER_FRAME = 0.9 // so short peaks stay visible a moment
const HIT_FLASH_MS = 120

export function MicSettings() {
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

  // Flash on every live hit.
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

  // Meter: every screen frame.
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
      <SliderRow
        label="Sensitivity"
        ariaLabel="Hit sensitivity"
        value={sensitivity}
        onChange={(value) => {
          setSensitivity(value)
          setSensitivityState(value)
        }}
      />
      {micOn ? null : (
        <OutlineButton className="settings-button" onClick={handleEnableMic}>
          Enable mic
        </OutlineButton>
      )}
      {errorText ? <SettingsNote text={errorText} /> : null}
    </>
  )
}

function decibelsToMeterPercent(db: number): number {
  const percent = ((db - METER_MIN_DB) / -METER_MIN_DB) * 100
  return Math.min(100, Math.max(0, percent))
}
