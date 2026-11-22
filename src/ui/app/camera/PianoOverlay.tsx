// Piano overlay (design.md 5.19) while a melody layer is active. The human
// asked for the octaves stacked instead of side by side, so the camera is
// cut into three horizontal bands (top C6, middle C5, bottom C4, the same
// bands the engine uses: melodyGuide.ts setOctaveLayout('rows')), and each
// band shows its own octave (one design.md 5.19 octave block) in its
// bottom-left corner. The keys that are sounding light up, and each new
// note sends out a tap ripple (design.md 5.18) centred on its key.
//
// Keys and ripples are updated every screen frame straight on the DOM,
// reading the engine (liveMelody), so React never re-renders per frame.
import { useEffect, useRef } from 'react'
import { getHeldNotes, getPlayingInstrument } from '../../../audio/liveMelody.ts'
import { applyAccidental, getKeyName, moveByWhiteKeys, splitPitch } from '../../../audio/instruments.ts'
import type { InstrumentName } from '../../../audio/instruments.ts'
import type { HandSide } from '../../../vision/handTracking.ts'
import { ICONS } from '../icons.ts'

// Top band first: the highest octave is at the top.
const OCTAVES = [6, 5, 4]
const WHITE_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
// Black keys sit on the C|D, D|E, F|G, G|A and A|B borders (white key 1, 2, 4, 5, 6).
const BLACK_KEY_BORDERS = [1, 2, 4, 5, 6]
const WHITE_KEY_PERCENT = 100 / 7
const BLACK_KEY_PERCENT = WHITE_KEY_PERCENT * 0.55

// Octave row box sizes (camera.css .piano-row), used to place ripples.
const ROW_BORDER = 1
const ROW_PADDING = 6
// Ripple centre, as a fraction of the keys' height: low over a white key,
// and higher over a black key (black keys are 58% as tall).
const RIPPLE_CENTER = 0.75
const BLACK_RIPPLE_CENTER = 0.3

const SIDES: HandSide[] = ['left', 'right']

export function PianoOverlay() {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(function () {
    // The notes each hand was holding last frame, to spot new notes.
    // A hand can hold several (one per pinched finger).
    const lastPitches: Record<HandSide, Set<string>> = { left: new Set(), right: new Set() }
    let frameId = 0

    function draw() {
      const overlay = overlayRef.current
      if (overlay) {
        const instrument = getPlayingInstrument()
        const lit = new Set<string>()
        for (const side of SIDES) {
          const pitches = new Set<string>()
          for (const note of getHeldNotes(side)) {
            pitches.add(note.pitch)
            for (const keyPitch of getLitKeys(instrument, note.pitch)) {
              lit.add(keyPitch)
            }
            if (!lastPitches[side].has(note.pitch)) {
              addRipple(overlay, note.pitch)
            }
          }
          lastPitches[side] = pitches
        }

        // Sharps and flats (wrist tilt) light the black keys, which the
        // design kept decorative when only white keys could play.
        const keys = overlay.querySelectorAll<HTMLElement>('.piano-white-key, .piano-black-key')
        for (const key of keys) {
          key.classList.toggle('is-active', lit.has(key.dataset.pitch || ''))
        }
      }
      frameId = requestAnimationFrame(draw)
    }
    frameId = requestAnimationFrame(draw)
    return function () {
      cancelAnimationFrame(frameId)
    }
  }, [])

  // The overlay covers the camera (not clipped, so ripples can spill);
  // each octave row sits at the bottom-left of its band (camera.css).
  return (
    <div className="piano-overlay" ref={overlayRef}>
      {OCTAVES.map((octave, row) => (
        <div key={octave} className={'piano-row piano-row-' + row} data-octave={octave}>
          <div className="piano-octave">
            {WHITE_LETTERS.map((letter, index) => (
              <div
                key={letter}
                className="piano-white-key"
                data-pitch={letter + octave}
                style={{ left: index * WHITE_KEY_PERCENT + '%', width: WHITE_KEY_PERCENT + '%' }}
              />
            ))}
            {BLACK_KEY_BORDERS.map((border) => (
              <div
                key={border}
                className="piano-black-key"
                data-pitch={WHITE_LETTERS[border - 1] + '#' + octave}
                style={{
                  left: border * WHITE_KEY_PERCENT - BLACK_KEY_PERCENT / 2 + '%',
                  width: BLACK_KEY_PERCENT + '%',
                }}
              />
            ))}
            <span className="piano-octave-label text-label">C{octave}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// Which keys light for one gesture note (design.md 5.19): the note itself,
// or the whole triad for the chord pad (moved by the accidental, like the
// sound). Bass and 808 sound two octaves down, off the overlay, so they
// light the note that was pinched. Key names use sharps ("A#4"), matching
// the black keys' data-pitch, so a flat lights the same key as its sharp.
function getLitKeys(instrument: InstrumentName, pitch: string): string[] {
  if (instrument === 'chordPad') {
    const parts = splitPitch(pitch)
    const keys: string[] = []
    for (const steps of [0, 2, 4]) {
      keys.push(getKeyName(applyAccidental(moveByWhiteKeys(parts.natural, steps), parts.accidental)))
    }
    return keys
  }
  return [getKeyName(pitch)]
}

// A ripple centred on the key of `pitch`. Notes off the overlay (C7) get none.
function addRipple(overlay: HTMLDivElement, pitch: string) {
  // e.g. "A#4": letter A, sharp, octave 4. Black keys centre on the border
  // to the right of their letter.
  const keyName = getKeyName(pitch)
  const isBlack = keyName[1] === '#'
  const octave = keyName.slice(isBlack ? 2 : 1)
  const keyIndex = WHITE_LETTERS.indexOf(keyName[0])
  const row = overlay.querySelector<HTMLElement>('.piano-row[data-octave="' + octave + '"]')
  if (row === null || keyIndex < 0) {
    return
  }
  // offset* and client* are layout pixels, the same units as the CSS
  // positions, measured from the overlay (which covers the camera).
  const keysLeft = row.offsetLeft + ROW_BORDER + ROW_PADDING
  const keysTop = row.offsetTop + ROW_BORDER + ROW_PADDING
  const keysWidth = row.clientWidth - 2 * ROW_PADDING
  const keysHeight = row.clientHeight - 2 * ROW_PADDING
  const keyWidth = keysWidth / 7
  const keyCenter = isBlack ? keyIndex + 1 : keyIndex + 0.5
  const centerX = keysLeft + keyCenter * keyWidth
  const centerY = keysTop + keysHeight * (isBlack ? BLACK_RIPPLE_CENTER : RIPPLE_CENTER)

  const ripple = document.createElement('img')
  ripple.src = ICONS.tapRipple
  ripple.alt = ''
  ripple.className = 'tap-ripple'
  ripple.style.left = centerX + 'px'
  ripple.style.top = centerY + 'px'
  ripple.addEventListener('animationend', function () {
    ripple.remove()
  })
  overlay.appendChild(ripple)
}
