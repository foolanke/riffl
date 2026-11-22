// Settings > Melody > "Show keyboard": the piano overlay over the camera
// (design.md 5.19). The human asked for it to be optional and off by
// default, since it covers a lot of the camera. Saved per browser, like
// the other page-only options. UI state only, no engine involved.
import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'sounds.showPiano'
let showPiano = loadShowPiano()
const listeners = new Set<() => void>()

export function getShowPiano(): boolean {
  return showPiano
}

export function setShowPiano(on: boolean): void {
  showPiano = on
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    // Storage unavailable: the choice just lasts until reload.
  }
  for (const listener of listeners) {
    listener()
  }
}

function subscribeToShowPiano(listener: () => void): () => void {
  listeners.add(listener)
  return function unsubscribe() {
    listeners.delete(listener)
  }
}

export function useShowPiano(): boolean {
  return useSyncExternalStore(subscribeToShowPiano, getShowPiano)
}

function loadShowPiano(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}
