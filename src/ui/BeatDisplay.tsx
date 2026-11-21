// Current bar and beat, a flash on every beat, and loop progress (SPEC step 4).
import { useEffect, useRef, useState } from 'react'
import { getLoopProgress, onBeat } from '../audio/clock.ts'
import type { BeatInfo } from '../audio/clock.ts'

const FLASH_MS = 100

export function BeatDisplay() {
  const [beat, setBeat] = useState<BeatInfo | null>(null)
  const [flashOn, setFlashOn] = useState(false)
  const progressFillRef = useRef<HTMLDivElement>(null)

  // Beat text and flash: the clock calls us exactly when each beat is heard.
  useEffect(function () {
    let flashTimer: number | undefined
    const unsubscribe = onBeat(function (info) {
      setBeat(info)
      window.clearTimeout(flashTimer)
      if (info) {
        setFlashOn(true)
        flashTimer = window.setTimeout(function () {
          setFlashOn(false)
        }, FLASH_MS)
      } else {
        setFlashOn(false)
      }
    })
    return function () {
      unsubscribe()
      window.clearTimeout(flashTimer)
    }
  }, [])

  // Progress bar: updated every animation frame straight on the DOM node,
  // so it doesn't re-render React 60 times a second.
  useEffect(function () {
    let frameId = 0
    function drawProgress() {
      if (progressFillRef.current) {
        progressFillRef.current.style.width = getLoopProgress() * 100 + '%'
      }
      frameId = requestAnimationFrame(drawProgress)
    }
    frameId = requestAnimationFrame(drawProgress)
    return function () {
      cancelAnimationFrame(frameId)
    }
  }, [])

  let beatText = 'Stopped'
  if (beat && beat.isCountIn) {
    beatText = `Count-in: bar ${beat.bar} of ${beat.barsTotal}, beat ${beat.beat} of ${beat.beatsPerBar}`
  } else if (beat) {
    beatText = `Bar ${beat.bar} of ${beat.barsTotal}, beat ${beat.beat} of ${beat.beatsPerBar}`
  }

  // Beat 1 flashes red, other beats grey, count-in orange.
  let flashColor = 'grey'
  if (beat && beat.isCountIn) {
    flashColor = 'orange'
  } else if (beat && beat.beat === 1) {
    flashColor = 'red'
  }

  return (
    <div>
      <p>{beatText}</p>
      <div
        style={{
          width: 60,
          height: 60,
          border: '1px solid black',
          background: flashOn ? flashColor : 'white',
        }}
      />
      <p>Loop progress:</p>
      <div style={{ width: 300, height: 16, border: '1px solid black' }}>
        <div ref={progressFillRef} style={{ width: '0%', height: '100%', background: 'black' }} />
      </div>
    </div>
  )
}
