// Live pinch notes (SPEC 3.6) follow the active card: on for a melody layer,
// playing its instrument, off otherwise, so hands near drum objects never set
// off notes. instrument = the active melody card's instrument, or null.
import { useEffect } from 'react'
import type { InstrumentName } from '../../../audio/instruments.ts'
import { selectInstrument, setLiveMelodyOn } from '../../../audio/liveMelody.ts'

export function useLiveNotesForCard(instrument: InstrumentName | null): void {
  useEffect(
    function () {
      if (instrument !== null) {
        selectInstrument(instrument)
        setLiveMelodyOn(true)
      } else {
        setLiveMelodyOn(false)
      }
    },
    [instrument],
  )
}
