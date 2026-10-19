import type { Gradient } from './types'

/** CSS preview of a gradient (our angle 0 = left to right, 90 = top to bottom). */
export function gradCss(g: Gradient): string {
  const stops = g.stops.map((s) => `${s.color} ${Math.round(s.pos * 100)}%`).join(', ')
  return g.type === 'radial' ? `radial-gradient(circle, ${stops})` : `linear-gradient(${g.angle + 90}deg, ${stops})`
}
