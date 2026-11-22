// Score track (design.md 5.12 Type=Score, 5.14): a melody layer drawn as one
// staff of music. Adapted to SPEC (design.md 10 Q3, Q5, decided by the human):
// - one slot per 16th note over the whole loop (SPEC 1.5 snaps to 16ths),
//   with a barline between bars;
// - notes outside E4-G5 (the designed staff) show only their name;
// - a held note shows at its start; two notes starting together show the lower.
// - sharps and flats (wrist tilt) sit on their natural's line with a
//   ♯ or ♭ beside the head, like printed music.
import { formatPitch, getKeyName, splitPitch } from '../../../audio/instruments.ts'
import type { MelodyLayer, ProjectSettings } from '../../../project/projectStore.ts'
import { getStepsPerBar } from '../../../project/projectStore.ts'
import { ICONS } from '../icons.ts'

const WHITE_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
// White keys counted from C0, so E4 = 30 and G5 = 39.
const E4_INDEX = 4 * 7 + 2
const G5_INDEX = 5 * 7 + 4
const B4_INDEX = 4 * 7 + 6
// Staff geometry (design.md 5.14): bottom line E4 at y 60, 4px per white key.
const BOTTOM_LINE_Y = 60
const PX_PER_STEP = 4
const STEM_HEIGHT = 26

interface ScoreStaffProps {
  layer: MelodyLayer
  settings: ProjectSettings
}

export function ScoreStaff(props: ScoreStaffProps) {
  const stepsPerBar = getStepsPerBar(props.settings.timeSignature)
  const stepsInLoop = props.settings.loopBars * stepsPerBar
  const [topDigit, bottomDigit] = props.settings.timeSignature.split('/')

  // The note to draw at each step (the lower one if several start together).
  const noteAtStep: (string | null)[] = []
  for (let step = 0; step < stepsInLoop; step++) {
    noteAtStep.push(null)
  }
  for (const note of props.layer.notes) {
    if (note.step < 0 || note.step >= stepsInLoop) {
      continue
    }
    const current = noteAtStep[note.step]
    if (current === null || getSemitone(note.pitch) < getSemitone(current)) {
      noteAtStep[note.step] = note.pitch
    }
  }

  const slots = []
  for (let step = 0; step < stepsInLoop; step++) {
    const pitch = noteAtStep[step]
    const startsBar = step > 0 && step % stepsPerBar === 0
    slots.push(
      <div key={step} className={'score-slot' + (startsBar ? ' starts-bar' : '')}>
        <span className={'score-count text-label' + (pitch !== null ? ' has-note' : '')}>
          {getCountLabel(step % stepsPerBar, props.settings.timeSignature)}
        </span>
        {pitch !== null ? <NoteGlyph pitch={pitch} /> : null}
      </div>,
    )
  }

  return (
    <div className="score-staff">
      <div className="score-lines" />
      <div className="score-time-signature">
        <span className="score-digit text-item" style={{ top: 26 }}>
          {topDigit}
        </span>
        <span className="score-digit text-item" style={{ top: 42 }}>
          {bottomDigit}
        </span>
      </div>
      <div className="score-slots">{slots}</div>
      <div className="score-end" />
    </div>
  )
}

// Head, stem and name for one note (design.md 5.14). Notes off the designed
// staff (below E4 or above G5) get only the name.
function NoteGlyph(props: { pitch: string }) {
  const accidental = splitPitch(props.pitch).accidental
  const index = getWhiteKeyIndex(props.pitch)
  const onStaff = index >= E4_INDEX && index <= G5_INDEX
  const centerY = BOTTOM_LINE_Y - PX_PER_STEP * (index - E4_INDEX)
  const stemUp = index < B4_INDEX
  return (
    <>
      {onStaff ? (
        <>
          <img className="score-head" src={ICONS.noteHead} alt="" style={{ top: centerY - 4 }} />
          {accidental !== 0 ? (
            <span className="score-accidental" style={{ top: centerY - 7 }}>
              {accidental === 1 ? '♯' : '♭'}
            </span>
          ) : null}
          <div
            className={'score-stem' + (stemUp ? ' is-up' : ' is-down')}
            style={{ top: stemUp ? centerY - STEM_HEIGHT : centerY }}
          />
        </>
      ) : null}
      <span className="score-name text-label color-muted">{formatPitch(props.pitch)}</span>
    </>
  )
}

// Staff position: the white key of the note's natural (F#4 sits on F4).
function getWhiteKeyIndex(pitch: string): number {
  const natural = splitPitch(pitch).natural
  return Number(natural.slice(1)) * 7 + WHITE_LETTERS.indexOf(natural[0])
}

// How high a note really sounds, for picking the lower of two notes.
function getSemitone(pitch: string): number {
  const key = getKeyName(pitch)
  const isBlack = key[1] === '#'
  const octave = Number(key.slice(isBlack ? 2 : 1))
  const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
  return octave * 12 + SEMITONES[key[0]] + (isBlack ? 1 : 0)
}

// Count for a 16th step within its bar: "1 e & a 2 e & a ..." in 4/4 and 3/4.
// 6/8 counts eighths: "1 & 2 & ... 6 &".
function getCountLabel(stepInBar: number, timeSignature: string): string {
  if (timeSignature === '6/8') {
    return stepInBar % 2 === 0 ? String(stepInBar / 2 + 1) : '&'
  }
  const sixteenth = stepInBar % 4
  if (sixteenth === 0) {
    return String(stepInBar / 4 + 1)
  }
  return ['', 'e', '&', 'a'][sixteenth]
}
