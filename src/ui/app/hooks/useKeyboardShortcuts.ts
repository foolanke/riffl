// Keyboard shortcuts (SPEC 0.6): Space records the active layer, Z undo,
// 1-9 mute, M metronome. The listener is set up once and calls the latest
// onRecord through a ref, so it never goes stale.
import { useEffect, useRef } from 'react'
import { getRecorderState } from '../../../audio/recorder.ts'
import { getProject, toggleLayerMutedByIndex, undoLastTake, updateSettings } from '../../../project/projectStore.ts'

export function useKeyboardShortcuts(enabled: boolean, onRecord: () => void): void {
  const onRecordRef = useRef(onRecord)
  onRecordRef.current = onRecord

  useEffect(
    function () {
      if (!enabled) {
        return
      }
      function handleKeyDown(event: KeyboardEvent) {
        if (event.key === ' ') {
          // Stop Space from scrolling or pressing whatever has focus.
          event.preventDefault()
          if (!event.repeat) {
            onRecordRef.current()
          }
          return
        }
        if (event.repeat) {
          return
        }
        if (event.key === 'm' || event.key === 'M') {
          updateSettings({ metronomeOn: !getProject().settings.metronomeOn })
        }
        if (/^[1-9]$/.test(event.key)) {
          toggleLayerMutedByIndex(Number(event.key) - 1)
        }
        // Undo only between takes, never while one is being recorded.
        if ((event.key === 'z' || event.key === 'Z') && getRecorderState().status === 'idle') {
          undoLastTake()
        }
      }
      // Buttons fire on Space key-up, so block that too.
      function handleKeyUp(event: KeyboardEvent) {
        if (event.key === ' ') {
          event.preventDefault()
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('keyup', handleKeyUp)
      return function () {
        window.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('keyup', handleKeyUp)
      }
    },
    [enabled],
  )
}
