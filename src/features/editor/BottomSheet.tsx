import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const px = (vh: number) => Math.round((typeof window === 'undefined' ? 800 : window.innerHeight) * (vh / 100))

/**
 * Canva-style bottom sheet. Drag the handle up to open it fully, down to close it.
 * `fit` = height follows the content (used by the small option panels), otherwise it has a fixed height with two stops.
 */
export default function BottomSheet({
  title,
  onClose,
  children,
  vh = 46,
  tall = 86,
  fit = false,
  header = true,
  className = '',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  vh?: number
  tall?: number
  fit?: boolean
  header?: boolean
  className?: string
}) {
  const [h, setH] = useState<number | null>(null)
  const [dy, setDy] = useState(0)
  const drag = useRef<{ y: number; h: number; t: number } | null>(null)
  const base = px(vh)
  const top = px(tall)
  const cur = h ?? base

  const down = (e: React.PointerEvent) => {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { y: e.clientY, h: cur, t: Date.now() }
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const delta = d.y - e.clientY
    if (fit) setDy(Math.max(0, -delta))
    else setH(clamp(d.h + delta, 100, top))
  }
  const up = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    const delta = d.y - e.clientY
    if (fit) {
      setDy(0)
      if (-delta > 70) onClose()
      return
    }
    const v = clamp(d.h + delta, 100, top)
    const tap = Math.abs(delta) < 6
    if (tap) setH(cur >= top - 8 ? base : top)
    else if (v < base * 0.6 && delta < 0) onClose()
    else if (delta > 0) setH(top)
    else setH(v > (base + top) / 2 ? top : base)
  }

  return (
    <section
      className={'sheet' + (fit ? ' fit' : '') + (className ? ' ' + className : '')}
      aria-label={title}
      style={fit ? { maxHeight: base, transform: dy ? `translateY(${dy}px)` : undefined, transition: dy ? 'none' : undefined } : { height: cur, transition: drag.current ? 'none' : 'height 0.18s ease' }}
    >
      <div className="grab-zone" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="separator" aria-label="Drag to resize or close">
        <div className="grab" aria-hidden />
      </div>
      {header && (
        <div className="sheet-head">
          <strong>{title}</strong>
          <button className="ic fill" aria-label="Close panel" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
      )}
      <div className="sheet-body">{children}</div>
    </section>
  )
}
