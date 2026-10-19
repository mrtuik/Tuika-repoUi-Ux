import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp, Clipboard, Copy, CopyPlus, Lock, MoreHorizontal, SlidersHorizontal, Trash2, Unlock } from 'lucide-react'
import { useEditor, selectedEls } from '../../state/editor'
import { useUI } from '../../state/ui'
import { stageHandle } from './handle'

interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Canva-style mini toolbar floating above the selected element: duplicate, delete, more. */
export default function FloatBar({ view, size, busy }: { view: { x: number; y: number; s: number }; size: { w: number; h: number }; busy: boolean }) {
  const els = useEditor((s) => selectedEls(s))
  const sel = useEditor((s) => s.sel)
  const doc = useEditor((s) => s.doc)
  const hasClip = useEditor((s) => !!s.clip)
  const [box, setBox] = useState<Box | null>(null)
  const [menu, setMenu] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [bw, setBw] = useState(150)

  useEffect(() => {
    const st = stageHandle.stage
    if (!st || els.length === 0 || busy) {
      if (!busy) setBox(null)
      return
    }
    let x1 = Infinity
    let y1 = Infinity
    let x2 = -Infinity
    let y2 = -Infinity
    for (const e of els) {
      if (e.locked || !e.visible) continue
      const n = st.findOne('#' + e.id)
      if (!n) continue
      const r = n.getClientRect({ skipShadow: true, skipStroke: true })
      x1 = Math.min(x1, r.x)
      y1 = Math.min(y1, r.y)
      x2 = Math.max(x2, r.x + r.width)
      y2 = Math.max(y2, r.y + r.height)
    }
    setBox(Number.isFinite(x1) ? { x: x1, y: y1, w: x2 - x1, h: y2 - y1 } : null)
  }, [els.length, sel, doc, view, busy, size.w, size.h])

  useEffect(() => setMenu(false), [sel.elIds.join(',')])
  useLayoutEffect(() => {
    if (ref.current) setBw(ref.current.offsetWidth)
  }, [box === null, els.length])

  if (!box || busy || els.length === 0) return null
  const st = useEditor.getState()
  const H = 48
  const above = box.y - H - 10 >= 6
  const top = above ? box.y - H - 10 : Math.min(size.h - H - 8, box.y + box.h + 64)
  const left = Math.min(Math.max(box.x + box.w / 2 - bw / 2, 8), Math.max(8, size.w - bw - 8))
  const single = els.length === 1
  const locked = single && els[0].locked
  const menuH = (single ? 8 : 7) * 44 + 14
  const menuTop = top + H + 6 + menuH <= size.h - 6 ? top + H + 6 : Math.max(6, top - menuH - 6)
  const run = (fn: () => void) => () => {
    setMenu(false)
    fn()
  }

  return (
    <>
      <div ref={ref} className="floatbar" style={{ left, top }} role="toolbar" aria-label="Element actions" onPointerDown={(e) => e.stopPropagation()}>
        <button aria-label="Duplicate" title="Duplicate" onClick={run(() => st.duplicateSel())}>
          <CopyPlus size={20} strokeWidth={1.75} />
        </button>
        <button aria-label="Delete" title="Delete" onClick={run(() => st.removeSel())}>
          <Trash2 size={20} strokeWidth={1.75} />
        </button>
        <button aria-label="More" title="More" aria-expanded={menu} onClick={() => setMenu(!menu)}>
          <MoreHorizontal size={20} strokeWidth={1.75} />
        </button>
      </div>
      {menu && (
        <div className="fb-menu" style={{ left: Math.min(Math.max(left, 8), Math.max(8, size.w - 206)), top: menuTop, maxHeight: size.h - 12, overflowY: 'auto' }} role="menu" onPointerDown={(e) => e.stopPropagation()}>
          <button role="menuitem" onClick={run(() => st.copy())}>
            <Copy size={17} /> Copy
          </button>
          <button role="menuitem" disabled={!hasClip} onClick={run(() => st.paste())}>
            <Clipboard size={17} /> Paste
          </button>
          <button role="menuitem" onClick={run(() => st.reorder('up'))}>
            <ChevronUp size={17} /> Bring forward
          </button>
          <button role="menuitem" onClick={run(() => st.reorder('down'))}>
            <ChevronDown size={17} /> Send backward
          </button>
          <button role="menuitem" onClick={run(() => st.reorder('front'))}>
            <ArrowUpToLine size={17} /> Bring to front
          </button>
          <button role="menuitem" onClick={run(() => st.reorder('back'))}>
            <ArrowDownToLine size={17} /> Send to back
          </button>
          {single && (
            <button role="menuitem" onClick={run(() => st.patchSel({ locked: !locked }))}>
              {locked ? <Unlock size={17} /> : <Lock size={17} />} {locked ? 'Unlock' : 'Lock'}
            </button>
          )}
          <button role="menuitem" onClick={run(() => (window.innerWidth < 900 ? useUI.getState().setCtx('all') : useUI.getState().setSheet('props')))}>
            <SlidersHorizontal size={17} /> All settings
          </button>
        </div>
      )}
    </>
  )
}
