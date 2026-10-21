/**
 * Makes AI-generated screens safe to use: measures every text with the same engine the canvas uses (Konva),
 * then pushes things down so a text that turned out taller than the model assumed never sits on top of the
 * element below it.
 */
import type { El } from '../engine/types'
import { ensureFont, primaryFamily } from './fonts'

export interface Dev {
  w: number
  h: number
}

const r1 = (n: number) => Math.round(n * 10) / 10

let KonvaMod: any = null
async function konva() {
  if (KonvaMod) return KonvaMod
  try {
    KonvaMod = (await import('konva')).default
  } catch {
    KonvaMod = null
  }
  return KonvaMod
}

function measure(K: any, el: El, size: number): number | null {
  if (!K) return null
  try {
    const t = new K.Text({
      width: el.w,
      text: el.text ?? '',
      fontSize: size,
      fontFamily: el.fontFamily,
      fontStyle: (el.italic ? 'italic ' : '') + String(el.fontWeight ?? 400),
      lineHeight: el.lineHeight,
      letterSpacing: el.letterSpacing,
      align: el.align,
    })
    t._setTextData?.()
    const h = t.height()
    t.destroy()
    return h > 0 ? Math.ceil(h * 10) / 10 : null
  } catch {
    return null
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((res) => setTimeout(() => res(fallback), ms))])
}

/** Loads the fonts the texts use, then sets each text's real height (and keeps it inside the screen / maxLines). */
export async function fitTexts(els: El[], dev: Dev): Promise<void> {
  const texts = els.filter((e) => e.type === 'text')
  if (!texts.length) return
  // fonts first, otherwise the measure uses a fallback font and comes out wrong
  const jobs: Promise<unknown>[] = []
  const seen = new Set<string>()
  for (const e of texts) {
    const key = `${primaryFamily(e.fontFamily)}|${e.fontWeight ?? 400}`
    if (seen.has(key)) continue
    seen.add(key)
    jobs.push(
      withTimeout(
        ensureFont(e.fontFamily, e.fontWeight, e.text).then(() => (document as any).fonts?.load?.(`${e.fontWeight ?? 400} 16px "${primaryFamily(e.fontFamily)}"`, 'Aa')),
        6000,
        null,
      ).catch(() => null),
    )
  }
  await Promise.all(jobs)
  const K = await konva()
  for (const e of texts) {
    const max = (e as any).__maxLines as number | undefined
    delete (e as any).__maxLines
    // keep the box inside the screen
    if (e.x + e.w > dev.w - 4 && e.x < dev.w - 24) e.w = r1(Math.max(24, dev.w - 4 - e.x))
    const base = e.fontSize ?? 16
    const lh = e.lineHeight ?? 1.25
    let size = base
    let h = measure(K, e, size)
    if (h == null) continue
    if (max && max > 0) {
      let lines = Math.round(h / (size * lh))
      // too many lines: shrink a little (never below 80%) before giving up
      while (lines > max && size > base * 0.8) {
        size = Math.round((size - 0.5) * 2) / 2
        const nh = measure(K, e, size)
        if (nh == null) break
        h = nh
        lines = Math.round(h / (size * lh))
      }
    }
    e.fontSize = size
    e.h = h
  }
}

/**
 * Pushes content down when a text is taller than the space the model left for it.
 * Containers (cards/buttons) that span the push line grow instead of moving; elements pinned to the bottom
 * (nav bar, composer, primary button) stay where they are.
 */
export function resolveOverlaps(els: El[], dev: Dev): void {
  const pinTop = Math.max(dev.h * 0.82, dev.h - 150)
  const pinned = (e: El) => e.y >= pinTop
  const full = (e: El) => e.h >= dev.h * 0.85 && e.w >= dev.w * 0.85
  const linear = (e: El) => e.type === 'line' || e.type === 'arrow'
  const hov = (a: El, b: El) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)

  for (let guard = 0; guard < 60; guard++) {
    let fixed = false
    const texts = els.filter((e) => e.type === 'text' && !pinned(e) && e.visible !== false).sort((a, b) => a.y - b.y)
    for (const T of texts) {
      const first = (T.fontSize ?? 16) * (T.lineHeight ?? 1.25)
      const bottom = T.y + T.h
      const hit = els.filter(
        (E) => E !== T && !pinned(E) && !linear(E) && E.visible !== false && E.y >= T.y + first * 0.6 && E.y < bottom - 3 && hov(E, T) > 2,
      )
      if (!hit.length) continue
      const line = Math.min(...hit.map((c) => c.y))
      const delta = Math.ceil(bottom + 6 - line)
      if (delta <= 0) continue
      for (const K of els) {
        if (K === T || pinned(K)) continue
        if (K.y >= line - 0.5) K.y = r1(K.y + delta)
        else if ((K.type === 'rect' || K.type === 'ellipse') && K.y + K.h > line + 0.5 && !full(K) && hov(K, T) > 2) K.h = r1(K.h + delta)
      }
      fixed = true
      break
    }
    if (!fixed) break
  }
}
