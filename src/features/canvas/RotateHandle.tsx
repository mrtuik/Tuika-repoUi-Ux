import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as RPointerEvent } from 'react'
import { RotateCw } from 'lucide-react'
import { useEditor, selectedEls } from '../../state/editor'
import { stageHandle } from './handle'

interface Item {
  id: string
  rot: number
  ccx: number
  ccy: number
  w: number
  h: number
}
interface Drag {
  px: number // pivot, in screen (stage) coords
  py: number
  lx: number // pivot, in the screen's own coords
  ly: number
  a0: number
  items: Item[]
  last: Record<string, { x: number; y: number; rotation: number }>
  rect: DOMRect
}

const D2R = Math.PI / 180
const r1 = (n: number) => Math.round(n * 10) / 10
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

/** Rotate button on the right side of the selection, clear of the copy / delete bar that floats above it. */
export default function RotateHandle({ view, size, busy, onBusy }: { view: { x: number; y: number; s: number }; size: { w: number; h: number }; busy: boolean; onBusy: (v: boolean) => void }) {
  const els = useEditor((s) => selectedEls(s))
  const sel = useEditor((s) => s.sel)
  const doc = useEditor((s) => s.doc)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [turning, setTurning] = useState(false)
  const [deg, setDeg] = useState(0)
  const drag = useRef<Drag | null>(null)

  useEffect(() => {
    if (turning) return
    const st = stageHandle.stage
    const live = els.filter((e) => !e.locked && e.visible)
    if (!st || live.length === 0 || busy) {
      if (!busy) setPos(null)
      return
    }
    let y1 = Infinity
    let x2 = -Infinity
    let y2 = -Infinity
    for (const e of live) {
      const n = st.findOne('#' + e.id)
      if (!n) continue
      const r = n.getClientRect({ skipShadow: true, skipStroke: true })
      y1 = Math.min(y1, r.y)
      x2 = Math.max(x2, r.x + r.width)
      y2 = Math.max(y2, r.y + r.height)
    }
    if (!Number.isFinite(x2)) return setPos(null)
    setPos({ x: clamp(x2 + 34, 30, size.w - 30), y: clamp((y1 + y2) / 2, 30, size.h - 30) })
  }, [els.length, sel, doc, view, busy, turning, size.w, size.h])

  const down = (e: RPointerEvent<HTMLButtonElement>) => {
    const st = stageHandle.stage
    const s = useEditor.getState()
    const ab = s.doc?.artboards.find((a) => a.id === s.sel.abId)
    if (!st || !ab) return
    const live = els.filter((x) => !x.locked && x.visible)
    if (!live.length) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    let x1 = Infinity
    let y1 = Infinity
    let x2 = -Infinity
    let y2 = -Infinity
    for (const el of live) {
      const n = st.findOne('#' + el.id)
      if (!n) continue
      const r = n.getClientRect({ skipShadow: true, skipStroke: true })
      x1 = Math.min(x1, r.x)
      y1 = Math.min(y1, r.y)
      x2 = Math.max(x2, r.x + r.width)
      y2 = Math.max(y2, r.y + r.height)
    }
    const px = (x1 + x2) / 2
    const py = (y1 + y2) / 2
    const k = st.scaleX() || 1
    // pivot inside the artboard
    const lx = (px - st.x()) / k - ab.x
    const ly = (py - st.y()) / k - ab.y
    const rect = st.container().getBoundingClientRect()
    const items: Item[] = live.map((el) => {
      const r = el.rotation * D2R
      return { id: el.id, rot: el.rotation, w: el.w, h: el.h, ccx: el.x + (el.w / 2) * Math.cos(r) - (el.h / 2) * Math.sin(r), ccy: el.y + (el.w / 2) * Math.sin(r) + (el.h / 2) * Math.cos(r) }
    })
    drag.current = { px, py, lx, ly, a0: Math.atan2(e.clientY - rect.top - py, e.clientX - rect.left - px) / D2R, items, last: {}, rect }
    setTurning(true)
    onBusy(true)
  }

  const move = (e: RPointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    const st = stageHandle.stage
    if (!d || !st) return
    let delta = Math.atan2(e.clientY - d.rect.top - d.py, e.clientX - d.rect.left - d.px) / D2R - d.a0
    if (d.items.length === 1) {
      // click into place at 0, 45, 90 ... when close
      const t = d.items[0].rot + delta
      const near = Math.round(t / 45) * 45
      if (Math.abs(t - near) < 3) delta = near - d.items[0].rot
    }
    const c = Math.cos(delta * D2R)
    const sn = Math.sin(delta * D2R)
    for (const it of d.items) {
      const dx = it.ccx - d.lx
      const dy = it.ccy - d.ly
      const cx = d.lx + dx * c - dy * sn
      const cy = d.ly + dx * sn + dy * c
      const rot = it.rot + delta
      const r = rot * D2R
      const x = cx - ((it.w / 2) * Math.cos(r) - (it.h / 2) * Math.sin(r))
      const y = cy - ((it.w / 2) * Math.sin(r) + (it.h / 2) * Math.cos(r))
      d.last[it.id] = { x, y, rotation: rot }
      st.findOne('#' + it.id)?.setAttrs({ x, y, rotation: rot })
    }
    st.getLayers().forEach((l) => l.batchDraw())
    setDeg(Math.round((((d.items[0].rot + delta) % 360) + 360) % 360))
  }

  const up = () => {
    const d = drag.current
    drag.current = null
    setTurning(false)
    onBusy(false)
    if (!d) return
    const s = useEditor.getState()
    const abId = s.sel.abId
    if (Object.keys(d.last).length === 0) return
    s.commit((doc) => {
      const ab = doc.artboards.find((a) => a.id === abId)
      if (!ab) return
      for (const e of ab.els) {
        const p = d.last[e.id]
        if (!p) continue
        e.x = r1(p.x)
        e.y = r1(p.y)
        e.rotation = r1((((p.rotation % 360) + 360) % 360))
      }
    })
  }

  if (!pos || (busy && !turning)) return null
  return (
    <>
      {turning && (
        <div className="rot-deg" style={{ left: pos.x, top: pos.y - 28 }}>
          {deg}°
        </div>
      )}
      <button className="rot-handle" style={{ left: pos.x - 22, top: pos.y - 22 }} aria-label="Rotate" title="Rotate" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <RotateCw size={20} strokeWidth={1.9} />
      </button>
    </>
  )
}
