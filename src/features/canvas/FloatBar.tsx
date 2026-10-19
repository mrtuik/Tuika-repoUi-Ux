import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowUpToLine, BoxSelect, Brush, ChevronDown, ChevronUp, Clipboard, Copy, CopyPlus, Crop, Group, Lock, MoreHorizontal, Paintbrush, SlidersHorizontal, Trash2, Unlock, Ungroup } from 'lucide-react'
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
  const hasStyle = useEditor((s) => !!s.styleClip)
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
  const anyGroup = els.some((x) => x.groupId)
  const items: { k: string; I: typeof Copy; t: string; run: () => void; off?: boolean }[] = [
    { k: 'copy', I: Copy, t: 'Copy', run: () => st.copy() },
    { k: 'paste', I: Clipboard, t: 'Paste', run: () => st.paste(), off: !hasClip },
    { k: 'cs', I: Paintbrush, t: 'Copy style', run: () => st.copyStyle() },
    { k: 'ps', I: Brush, t: 'Paste style', run: () => st.pasteStyle(), off: !hasStyle },
    ...(els.length > 1 ? [{ k: 'grp', I: Group, t: 'Group', run: () => st.group() }] : []),
    ...(anyGroup ? [{ k: 'ung', I: Ungroup, t: 'Ungroup', run: () => st.ungroup() }] : []),
    ...(single && els[0].type === 'image' ? [{ k: 'crop', I: Crop, t: 'Crop image', run: () => useUI.getState().setCropOpen(true) }] : []),
    { k: 'all', I: BoxSelect, t: 'Select all', run: () => st.selectAll() },
    { k: 'up', I: ChevronUp, t: 'Bring forward', run: () => st.reorder('up') },
    { k: 'down', I: ChevronDown, t: 'Send backward', run: () => st.reorder('down') },
    { k: 'front', I: ArrowUpToLine, t: 'Bring to front', run: () => st.reorder('front') },
    { k: 'back', I: ArrowDownToLine, t: 'Send to back', run: () => st.reorder('back') },
    ...(single ? [{ k: 'lock', I: locked ? Unlock : Lock, t: locked ? 'Unlock' : 'Lock', run: () => st.patchSel({ locked: !locked }) }] : []),
    { k: 'set', I: SlidersHorizontal, t: 'All settings', run: () => {
      const ui = useUI.getState()
      if (window.innerWidth < 900) {
        ui.setSheet(null)
        ui.setCtx('all')
      } else ui.setSheet('props')
    } },
  ]
  const menuH = items.length * 44 + 14
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
          {items.map(({ k, I, t, run: fn, off }) => (
            <button key={k} role="menuitem" disabled={off} onClick={run(fn)}>
              <I size={17} /> {t}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
