import { AlignLeft, Check, Droplets, Keyboard, Layers as LayersIcon, Link2, Move, SlidersHorizontal, Sparkles, SquareDashed, Type } from 'lucide-react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useEditor, selectedEls } from '../../state/editor'
import { useUI } from '../../state/ui'
import type { CtxPanel } from '../../state/ui'
import type { El } from '../../engine/types'
import Inspector from '../inspector/Inspector'
import BottomSheet from './BottomSheet'

export const CTX_TITLES: Record<CtxPanel, string> = {
  edit: 'Edit text',
  font: 'Font',
  colour: 'Colour',
  format: 'Text style',
  stroke: 'Border',
  corners: 'Corners',
  opacity: 'Transparency',
  shadow: 'Shadow',
  position: 'Position',
  link: 'Prototype link',
  arrange: 'Arrange',
  all: 'All settings',
}

function CornerIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
      <path d="M4 20V13a9 9 0 0 1 9-9h7" />
      <circle cx="20" cy="20" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  )
}

function Dot({ color }: { color: string }) {
  return <span className="ctx-dot" style={{ background: color }} />
}

interface Item {
  id: CtxPanel
  label: string
  icon: ReactNode
}

export function itemsFor(els: El[]): Item[] {
  const e = els[0]
  const multi = els.length > 1
  const I = (n: ReactNode) => n
  const out: Item[] = []
  const hasFill = els.every((x) => x.type !== 'line' && x.type !== 'arrow' && x.type !== 'image')
  if (!multi && e.type === 'text') {
    out.push({ id: 'edit', label: 'Edit', icon: I(<Keyboard size={22} strokeWidth={1.75} />) })
    out.push({ id: 'font', label: 'Font', icon: I(<Type size={22} strokeWidth={1.75} />) })
  }
  if (hasFill) out.push({ id: 'colour', label: 'Colour', icon: <Dot color={e.fill} /> })
  if (!multi && e.type === 'text') out.push({ id: 'format', label: 'Style', icon: <AlignLeft size={22} strokeWidth={1.75} /> })
  if (!multi && (e.type === 'line' || e.type === 'arrow')) out.push({ id: 'stroke', label: 'Line', icon: <Dot color={e.stroke} /> })
  if (!multi && (e.type === 'rect' || e.type === 'ellipse')) out.push({ id: 'stroke', label: 'Border', icon: <SquareDashed size={22} strokeWidth={1.75} /> })
  if (!multi && (e.type === 'rect' || e.type === 'image')) out.push({ id: 'corners', label: 'Corners', icon: <CornerIcon /> })
  out.push({ id: 'opacity', label: 'Opacity', icon: <Droplets size={22} strokeWidth={1.75} /> })
  if (!multi && e.type !== 'line' && e.type !== 'arrow') out.push({ id: 'shadow', label: 'Shadow', icon: <Sparkles size={22} strokeWidth={1.75} /> })
  out.push({ id: 'position', label: 'Position', icon: <Move size={22} strokeWidth={1.75} /> })
  if (!multi) out.push({ id: 'link', label: 'Link', icon: <Link2 size={22} strokeWidth={1.75} /> })
  out.push({ id: 'arrange', label: 'Arrange', icon: <LayersIcon size={22} strokeWidth={1.75} /> })
  out.push({ id: 'all', label: 'All', icon: <SlidersHorizontal size={22} strokeWidth={1.75} /> })
  return out
}

/** Replaces the tool dock while something is selected (like Canva's contextual toolbar). */
export function ContextBar() {
  const els = useEditor((s) => selectedEls(s))
  const ctx = useUI((s) => s.ctx)
  const setCtx = useUI((s) => s.setCtx)
  if (els.length === 0) return null
  const items = itemsFor(els)
  const done = () => {
    const st = useEditor.getState()
    st.select(st.sel.abId, [])
    setCtx(null)
  }
  return (
    <div className="ctxbar" role="toolbar" aria-label="Element options">
      <div className="ctx-items">
        {items.map((it) => (
          <button key={it.id + it.label} className={'ctx-item' + (ctx === it.id ? ' on' : '')} aria-pressed={ctx === it.id} onClick={() => setCtx(ctx === it.id ? null : it.id)}>
            <span className="ctx-ic">{it.icon}</span>
            <span className="ctx-lb">{it.label}</span>
          </button>
        ))}
      </div>
      <button className="ctx-done" aria-label="Done" onClick={done}>
        <Check size={22} />
      </button>
    </div>
  )
}

/** The small option panel that opens above the contextual toolbar. */
export function ContextSheet() {
  const ctx = useUI((s) => s.ctx)
  const setCtx = useUI((s) => s.setCtx)
  const els = useEditor((s) => selectedEls(s))
  const ok = !!ctx && els.length > 0 && itemsFor(els).some((i) => i.id === ctx)
  useEffect(() => {
    if (ctx && !ok) setCtx(null)
  }, [ctx, ok, setCtx])
  if (!ctx || !ok) return null
  return (
    <BottomSheet key={ctx} title={CTX_TITLES[ctx]} fit vh={ctx === 'all' ? 64 : 46} onClose={() => setCtx(null)} className="ctx">
      <Inspector only={ctx} />
    </BottomSheet>
  )
}
