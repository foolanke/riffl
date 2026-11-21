// Keeps something on screen long enough to animate out.
// open = true: mounted (its CSS "in" animation plays on mount).
// open = false: still mounted but "closing" (add the class that plays the
// CSS "out" animation), then unmounted after durationMs. Match durationMs to
// the CSS animation.
import { useEffect, useState } from 'react'

export interface Presence {
  mounted: boolean // render it at all
  closing: boolean // playing its "out" animation
}

export function usePresence(open: boolean, durationMs: number): Presence {
  const [mounted, setMounted] = useState(open)

  useEffect(
    function () {
      if (open) {
        setMounted(true)
        return
      }
      const timer = window.setTimeout(function () {
        setMounted(false)
      }, durationMs)
      return function () {
        window.clearTimeout(timer)
      }
    },
    [open, durationMs],
  )

  return { mounted: mounted || open, closing: !open }
}
