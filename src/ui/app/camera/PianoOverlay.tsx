// Piano overlay (design.md 5.19) along the bottom of the camera while a
// melody layer is active: the three octaves side by side (C4, C5, C6). The
// octave you play in is picked by the horizontal band your thumb is in
// (top C6, bottom C4, drawn by MelodyGuide), not by these key positions.
// The white keys that are sounding light up, and each new note sends out
// a tap ripple (design.md 5.18) centred on its key.
//
// Keys and ripples are updated every screen frame straight on the DOM,
// reading the engine (liveMelody), so React never re-renders per frame.
import { useEffect, useRef } from 'react'
import { getHeldNotes, getPlayingInstrument } from '../../../audio/liveMelody.ts'
import { getKeyName, getTriad, semitoneToPitch } from '../../../audio/instruments.ts'
import type { InstrumentName } from '../../../audio/instruments.ts'
import type { HandSide } from '../../../vision/handTracking.ts'
import { ICONS } from '../icons.ts'

const OCTAVES = [4, 5, 6]
const WHITE_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
// Black keys sit on the C|D, D|E, F|G, G|A and A|B borders (white key 1, 2, 4, 5, 6).
const BLACK_KEY_BORDERS = [1, 2, 4, 5, 6]
const WHITE_KEY_PERCENT = 100 / 7
const BLACK_KEY_PERCENT = WHITE_KEY_PERCENT * 0.55

// Overlay box sizes from design.md 5.19, used to place ripples.
const OVERLAY_BORDER = 1
const OVERLAY_PADDING = 8
const OCTAVE_GAP = 8
// Ripple centre: low over the keys, as in the mock (scaled to the shorter
// 72px overlay: keys 56px tall from 8px down).
const RIPPLE_CENTER_Y = 50
// Black keys are shorter (58% of the keys' 56px), so their ripple sits higher.
const BLACK_RIPPLE_CENTER_Y = 24

const SIDES: HandSide[] = ['left', 'right']

export function PianoOverlay() {
  const overlayRef = useRef<HTMLDivElement>(null)
  const rippleLayerRef = useRef<HTMLDivElement>(null)

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
              addRipple(overlay, rippleLayerRef.current, note.pitch)
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

  return (
    <>
      <div className="piano-overlay" ref={overlayRef}>
        {OCTAVES.map((octave) => (
          <div key={octave} className="piano-octave">
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
        ))}
      </div>
      {/* Same box as the overlay, but not clipped, so ripples can spill out. */}
      <div className="piano-ripple-layer" ref={rippleLayerRef} />
    </>
  )
}

// Which keys light for one gesture note (design.md 5.19): the note itself,
// or the whole triad for the chord pad (like the sound). Bass and 808 sound two octaves down, off the overlay, so they
// light the note that was pinched. Key names use sharps ("A#4"), matching
// the black keys' data-pitch, so a flat lights the same key as its sharp.
function getLitKeys(instrument: InstrumentName, pitch: string): string[] {
  if (instrument === 'chordPad') {
    // The same triad the chord pad sounds (the key's own chord when the
    // project key is set, see getTriad).
    const keys: string[] = []
    for (const semitone of getTriad(pitch)) {
      keys.push(getKeyName(semitoneToPitch(semitone, false)))
    }
    return keys
  }
  return [getKeyName(pitch)]
}

// A ripple centred on the key of `pitch`. Notes off the overlay (C7) get none.
function addRipple(overlay: HTMLDivElement, layer: HTMLDivElement | null, pitch: string) {
  // e.g. "A#4": letter A, sharp, octave 4. Black keys centre on the border
  // to the right of their letter.
  const keyName = getKeyName(pitch)
  const isBlack = keyName[1] === '#'
  const octaveIndex = OCTAVES.indexOf(Number(keyName.slice(isBlack ? 2 : 1)))
  const keyIndex = WHITE_LETTERS.indexOf(keyName[0])
  if (layer === null || octaveIndex < 0 || keyIndex < 0) {
    return
  }
  // clientWidth is in layout pixels, the same units as the CSS positions.
  const innerWidth = overlay.clientWidth - 2 * OVERLAY_PADDING
  const octaveWidth = (innerWidth - OCTAVE_GAP * (OCTAVES.length - 1)) / OCTAVES.length
  const keyWidth = octaveWidth / 7
  const keyCenter = isBlack ? keyIndex + 1 : keyIndex + 0.5
  const centerX = OVERLAY_BORDER + OVERLAY_PADDING + octaveIndex * (octaveWidth + OCTAVE_GAP) + keyCenter * keyWidth

  const ripple = document.createElement('img')
  ripple.src = ICONS.tapRipple
  ripple.alt = ''
  ripple.className = 'tap-ripple'
  ripple.style.left = centerX + 'px'
  ripple.style.top = (isBlack ? BLACK_RIPPLE_CENTER_Y : RIPPLE_CENTER_Y) + 'px'
  ripple.addEventListener('animationend', function () {
    ripple.remove()
  })
  layer.appendChild(ripple)
}
