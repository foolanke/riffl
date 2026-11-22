// React hooks for engine state the designed page reads in many places.
// The engine modules own the state; these only subscribe (SPEC 0.1).
import { useSyncExternalStore } from 'react'
import { getCameraLagCheckState, subscribeToCameraLagCheck } from '../../../audio/cameraLagCheck.ts'
import { getLagCheckState, subscribeToLagCheck } from '../../../audio/lagCheck.ts'
import { getRecorderState, subscribeToRecorder } from '../../../audio/recorder.ts'

export function useRecorder() {
  return useSyncExternalStore(subscribeToRecorder, getRecorderState)
}

export function useMicLagCheck() {
  return useSyncExternalStore(subscribeToLagCheck, getLagCheckState)
}

export function useCameraLagCheck() {
  return useSyncExternalStore(subscribeToCameraLagCheck, getCameraLagCheckState)
}

// A take and a lag check both use the clock and mic, so never run both at once.
// Plain function (not a hook) so click handlers can check the latest state.
export function isCalibrating(): boolean {
  return getLagCheckState().status !== 'idle' || getCameraLagCheckState().status !== 'idle'
}
