import { useEffect } from 'react'

// Stack of "close me" handlers. The Android back button runs the top one.
const stack: (() => void)[] = []

export function useBackHandler(active: boolean, fn: () => void) {
  useEffect(() => {
    if (!active) return
    stack.push(fn)
    return () => {
      const i = stack.lastIndexOf(fn)
      if (i >= 0) stack.splice(i, 1)
    }
  }, [active, fn])
}

/** Returns true if something consumed the back press. */
export function runBack(): boolean {
  const fn = stack[stack.length - 1]
  if (!fn) return false
  fn()
  return true
}
