// React hooks that read engine state. The engine itself has no React in it;
// these just let components re-render when engine state changes.
import { useSyncExternalStore } from 'react'
import { getProject, subscribeToProject } from '../project/projectStore.ts'
import type { Project } from '../project/projectStore.ts'
import { getIsPlaying, subscribeToPlayState } from '../audio/clock.ts'

export function useProject(): Project {
  return useSyncExternalStore(subscribeToProject, getProject)
}

export function useIsPlaying(): boolean {
  return useSyncExternalStore(subscribeToPlayState, getIsPlaying)
}
