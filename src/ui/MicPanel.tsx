// Mic level meter, sensitivity slider and live hit flash (SPEC steps 10-11).
import { useEffect, useRef, useState } from 'react'
import { amplitudeToDecibels } from '../audio/hitDetection.ts'
import {
  getHitThresholdDb,
  getMicPeak,
  getSensitivity,
  isMicOn,
  onLiveHit,
  setSensitivity,
  startMic,
} from '../audio/mic.ts'

const METER_MIN_DB = -60 // left edge of the meter; 0 dBFS is the right edge
const FLASH_MS = 120
const METER_FALL_PER_FRAME = 0.9 // so short peaks stay visible a moment

function decibelsToMeterPercent(db: number): number {
  const percent = ((db - METER_MIN_DB) / -METER_MIN_DB) * 100
  return Math.min(100, Math.max(0, percent))
}

export function MicPanel() {
  const [micOn, setMicOn] = useState(isMicOn())
  const [errorText, setErrorText] = useState('')
  const [sensitivity, setSensitivityState] = useState(getSensitivity())
  const [hitCount, setHitCount] = useState(0)
  const [flashOn, setFlashOn] = useState(false)
  const meterFillRef = useRef<HTMLDivElement>(null)
  const thresholdLineRef = useRef<HTMLDivElement>(null)

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

  function handleSensitivityChange(value: number) {
    setSensitivity(value)
    setSensitivityState(value)
  }

  // Flash and count on every hit the engine detects.
  useEffect(function () {
    let flashTimer: number | undefined
    const unsubscribe = onLiveHit(function () {
      setHitCount((count) => count + 1)
      setFlashOn(true)
      window.clearTimeout(flashTimer)
      flashTimer = window.setTimeout(function () {
        setFlashOn(false)
      }, FLASH_MS)
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
    function drawMeter() {
      // Recording can switch the mic on too; hide the button once it is on.
      if (isMicOn()) {
        setMicOn(true)
      }
      shownPeak = Math.max(getMicPeak(), shownPeak * METER_FALL_PER_FRAME)
      if (meterFillRef.current) {
        const percent = decibelsToMeterPercent(amplitudeToDecibels(shownPeak))
        meterFillRef.current.style.width = percent + '%'
      }
      if (thresholdLineRef.current) {
        thresholdLineRef.current.style.left = decibelsToMeterPercent(getHitThresholdDb()) + '%'
      }
      frameId = requestAnimationFrame(drawMeter)
    }
    frameId = requestAnimationFrame(drawMeter)
    return function () {
      cancelAnimationFrame(frameId)
    }
  }, [])

  return (
    <fieldset>
      <legend>Mic</legend>
      {micOn ? null : <button onClick={handleEnableMic}>Enable mic</button>}
      {errorText ? <p>{errorText}</p> : null}

      <p>Level (red line = hit threshold):</p>
      <div
        style={{ position: 'relative', width: 300, height: 16, border: '1px solid black' }}
      >
        <div ref={meterFillRef} style={{ width: '0%', height: '100%', background: 'green' }} />
        <div
          ref={thresholdLineRef}
          style={{ position: 'absolute', top: 0, width: 2, height: '100%', background: 'red' }}
        />
      </div>

      <p>
        <label>
          Sensitivity: {sensitivity} (threshold {Math.round(getHitThresholdDb())} dB){' '}
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={sensitivity}
            onChange={(event) => handleSensitivityChange(Number(event.target.value))}
          />
        </label>
      </p>

      <p>Hits: {hitCount}</p>
      <div
        style={{
          width: 60,
          height: 60,
          border: '1px solid black',
          background: flashOn ? 'blue' : 'white',
        }}
      />
    </fieldset>
  )
}
