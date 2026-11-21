// Lag check settings (SPEC 2.5): run, re-run and see the saved result.
import { useSyncExternalStore } from 'react'
import { getLagCheckState, runLagCheck, subscribeToLagCheck } from '../audio/lagCheck.ts'
import type { LagCheckStatus } from '../audio/lagCheck.ts'

const STATUS_TEXT: Record<LagCheckStatus, string> = {
  idle: '',
  listen: 'Listen to the first 4 clicks...',
  tap: 'TAP the desk on every click now',
  processing: 'Measuring...',
}

export function LagCheckPanel() {
  const lagCheck = useSyncExternalStore(subscribeToLagCheck, getLagCheckState)

  return (
    <fieldset>
      <legend>Lag check (once per laptop)</legend>
      <p>
        Saved lag:{' '}
        {lagCheck.savedLagMs === null ? 'not measured yet (using 0 ms)' : lagCheck.savedLagMs + ' ms'}
      </p>
      {lagCheck.savedLagMs !== null && lagCheck.tapsUsed > 0 ? (
        <p>
          Last run: {lagCheck.tapsUsed} taps, spread ±{lagCheck.spreadMs} ms
          {lagCheck.previousLagMs !== null
            ? ` (run before: ${lagCheck.previousLagMs} ms, difference ${Math.abs(lagCheck.savedLagMs - lagCheck.previousLagMs)} ms)`
            : ''}
        </p>
      ) : null}
      <button onClick={runLagCheck} disabled={lagCheck.status !== 'idle'}>
        {lagCheck.savedLagMs === null ? 'Run lag check' : 'Re-run lag check'}
      </button>{' '}
      (about 12 seconds: 4 clicks to listen, then tap along to 16 clicks)
      <p>{STATUS_TEXT[lagCheck.status]}</p>
      {lagCheck.message ? <p>{lagCheck.message}</p> : null}
    </fieldset>
  )
}
