import { useEffect, useRef, useState } from 'react'
import { Check, RotateCcw, X } from 'lucide-react'
import { useEditor, selectedEls } from '../../state/editor'
import { useUI } from '../../state/ui'

interface C {
  x: number
  y: number
  w: number
  h: number
}
type Mode = 'move' | 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r'
const MIN = 0.05
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const PRESETS: { id: string; label: string; r: number | 'orig' | null }[] = [
  { id: 'free', label: 'Free', r: null },
  { id: 'orig', label: 'Original', r: 'orig' },
  { id: '1', label: '1:1', r: 1 },
  { id: '45', label: '4:5', r: 4 / 5 },
  { id: '34', label: '3:4', r: 3 / 4 },
  { id: '169', label: '16:9', r: 16 / 9 },
  { id: '916', label: '9:16', r: 9 / 16 },
]

/** Full-screen image crop: drag the frame or its handles; aspect presets; saved as a normalised crop on the image element. */
export default function CropModal() {
  const el = useEditor((s) => selectedEls(s)[0])
  const close = () => useUI.getState().setCropOpen(false)
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const area = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 320, h: 480 })
  const [c, setC] = useState<C>(el?.crop ?? { x: 0, y: 0, w: 1, h: 1 })
  const [preset, setPreset] = useState('free')
  const drag = useRef<{ mode: Mode; px: number; py: number; c0: C } | null>(null)

  useEffect(() => {
    if (!el?.src) return
    const i = new window.Image()
    i.onload = () => setNat({ w: i.naturalWidth, h: i.naturalHeight })
    i.src = el.src
  }, [el?.src])

  useEffect(() => {
    const a = area.current
    if (!a) return
    const ro = new ResizeObserver(() => setBox({ w: a.clientWidth, h: a.clientHeight }))
    ro.observe(a)
    setBox({ w: a.clientWidth, h: a.clientHeight })
    return () => ro.disconnect()
  }, [])

  if (!el || el.type !== 'image' || !nat) return <div className="crop-modal" />

  const scale = Math.min((box.w - 32) / nat.w, (box.h - 32) / nat.h)
  const dw = nat.w * scale
  const dh = nat.h * scale
  const left = (box.w - dw) / 2
  const top = (box.h - dh) / 2
  const ratio = (): number | null => {
    const p = PRESETS.find((x) => x.id === preset)
    return !p || p.r === null ? null : p.r === 'orig' ? nat.w / nat.h : p.r
  }

  const apply = (id: string) => {
    setPreset(id)
    const p = PRESETS.find((x) => x.id === id)!
    if (p.r === null) return
    const r = p.r === 'orig' ? nat.w / nat.h : p.r
    const k = nat.w / (nat.h * r) // h = w * k
    let w = 1
    let h = k
    if (h > 1) {
      h = 1
      w = 1 / k
    }
    const cx = c.x + c.w / 2
    const cy = c.y + c.h / 2
    setC({ w, h, x: clamp(cx - w / 2, 0, 1 - w), y: clamp(cy - h / 2, 0, 1 - h) })
  }

  const down = (mode: Mode) => (e: React.PointerEvent) => {
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { mode, px: e.clientX, py: e.clientY, c0: c }
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.px) / dw
    const dy = (e.clientY - d.py) / dh
    const c0 = d.c0
    if (d.mode === 'move') return setC({ ...c0, x: clamp(c0.x + dx, 0, 1 - c0.w), y: clamp(c0.y + dy, 0, 1 - c0.h) })
    const r = ratio()
    const hasL = d.mode.includes('l')
    const hasR = d.mode.includes('r')
    const hasT = d.mode.includes('t')
    const hasB = d.mode.includes('b')
    if (r && d.mode.length === 2) {
      const k = nat.w / (nat.h * r)
      const ax = hasL ? c0.x + c0.w : c0.x
      const ay = hasT ? c0.y + c0.h : c0.y
      const availW = hasL ? ax : 1 - ax
      const availH = hasT ? ay : 1 - ay
      const w = clamp(c0.w + (hasR ? dx : -dx), MIN, Math.max(MIN, Math.min(availW, availH / k)))
      const h = w * k
      return setC({ w, h, x: hasL ? ax - w : ax, y: hasT ? ay - h : ay })
    }
    if (r) return // edge handles are hidden while an aspect is locked
    let l = c0.x
    let rr = c0.x + c0.w
    let t = c0.y
    let b = c0.y + c0.h
    if (hasL) l = clamp(c0.x + dx, 0, rr - MIN)
    if (hasR) rr = clamp(c0.x + c0.w + dx, l + MIN, 1)
    if (hasT) t = clamp(c0.y + dy, 0, b - MIN)
    if (hasB) b = clamp(c0.y + c0.h + dy, t + MIN, 1)
    setC({ x: l, y: t, w: rr - l, h: b - t })
  }
  const up = () => {
    drag.current = null
  }

  const done = () => {
    const full = c.x < 0.002 && c.y < 0.002 && c.w > 0.996 && c.h > 0.996
    const px = (c.w * nat.w) / (c.h * nat.h)
    useEditor.getState().patchSel({ crop: full ? undefined : { ...c }, h: Math.max(8, Math.round((el.w / px) * 10) / 10) })
    close()
  }
  const locked = ratio() !== null
  const handles: Mode[] = locked ? ['tl', 'tr', 'bl', 'br'] : ['tl', 'tr', 'bl', 'br', 't', 'b', 'l', 'r']

  return (
    <div className="crop-modal" role="dialog" aria-label="Crop image">
      <div className="crop-head">
        <button className="ic fill" aria-label="Cancel crop" onClick={close}>
          <X size={18} />
        </button>
        <strong>Crop</strong>
        <button className="ic fill" aria-label="Reset crop" onClick={() => { setC({ x: 0, y: 0, w: 1, h: 1 }); setPreset('free') }}>
          <RotateCcw size={17} />
        </button>
        <button className="crop-done" aria-label="Apply crop" onClick={done}>
          <Check size={20} />
        </button>
      </div>
      <div className="crop-area" ref={area} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <img src={el.src} alt="" draggable={false} style={{ left, top, width: dw, height: dh }} />
        <div className="crop-box" onPointerDown={down('move')} style={{ left: left + c.x * dw, top: top + c.y * dh, width: c.w * dw, height: c.h * dh }}>
          {handles.map((m) => (
            <span key={m} className={'ch ch-' + m} onPointerDown={down(m)} />
          ))}
        </div>
      </div>
      <div className="crop-presets" role="group" aria-label="Aspect ratio">
        {PRESETS.map((p) => (
          <button key={p.id} className={'chipbtn' + (preset === p.id ? ' on' : '')} aria-pressed={preset === p.id} onClick={() => apply(p.id)}>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
