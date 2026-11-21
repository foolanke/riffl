// Camera lag check settings (SPEC 3.8, step 28): run, re-run and see the result.
import { useSyncExternalStore } from 'react'
import {
  getCameraLagCheckState,
  runCameraLagCheck,
  subscribeToCameraLagCheck,
} from '../audio/cameraLagCheck.ts'
import type { CameraLagCheckStatus } from '../audio/cameraLagCheck.ts'

const STATUS_TEXT: Record<CameraLagCheckStatus, string> = {
  idle: '',
  listen: 'Listen to the first 4 clicks...',
  pinch: 'PINCH thumb to index on every click now (open your hand between pinches)',
  processing: 'Measuring...',
}

export function CameraLagCheckPanel() {
  const check = useSyncExternalStore(subscribeToCameraLagCheck, getCameraLagCheckState)

  return (
    <fieldset>
      <legend>Camera lag check (once per laptop, for melody)</legend>
      <p>
        Saved camera lag:{' '}
        {check.savedLagMs === null ? 'not measured yet (using 0 ms)' : check.savedLagMs + ' ms'}
      </p>
      {check.savedLagMs !== null && check.pinchesUsed > 0 ? (
        <p>
          Last run: {check.pinchesUsed} pinches, spread ±{check.spreadMs} ms
          {check.previousLagMs !== null
            ? ` (run before: ${check.previousLagMs} ms, difference ${Math.abs(check.savedLagMs - check.previousLagMs)} ms)`
            : ''}
        </p>
      ) : null}
      <button onClick={runCameraLagCheck} disabled={check.status !== 'idle'}>
        {check.savedLagMs === null ? 'Run camera lag check' : 'Re-run camera lag check'}
      </button>{' '}
      (camera on; about 12 seconds: 4 clicks to listen, then pinch along to 16 clicks)
      <p>{STATUS_TEXT[check.status]}</p>
      {check.message ? <p>{check.message}</p> : null}
    </fieldset>
  )
}
