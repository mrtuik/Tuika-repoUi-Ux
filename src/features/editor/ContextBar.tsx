import { AlignLeft, Check, Crop as CropIcon, Droplets, Group as GroupIcon, Keyboard, Ungroup as UngroupIcon, Layers as LayersIcon, Link2, Move, SlidersHorizontal, Sparkles, SquareDashed, Type } from 'lucide-react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useEditor, selectedEls } from '../../state/editor'
import { useUI } from '../../state/ui'
import type { CtxPanel } from '../../state/ui'
import type { El } from '../../engine/types'
import { gradCss } from '../../engine/gradient'
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

function Dot({ color, bg }: { color: string; bg?: string }) {
  return <span className="ctx-dot" style={{ background: bg ?? color }} />
}

interface Item {
  id: string
  label: string
  icon: ReactNode
  panel?: CtxPanel // opens that option panel
  run?: () => void // or runs an action
}

export function itemsFor(els: El[]): Item[] {
  const e = els[0]
  const multi = els.length > 1
  const out: Item[] = []
  const P = (panel: CtxPanel, label: string, icon: ReactNode) => out.push({ id: panel + label, panel, label, icon })
  const hasFill = els.every((x) => x.type !== 'line' && x.type !== 'arrow' && x.type !== 'image')
  const st = () => useEditor.getState()
  if (!multi && e.type === 'text') {
    P('edit', 'Edit', <Keyboard size={22} strokeWidth={1.75} />)
    P('font', 'Font', <Type size={22} strokeWidth={1.75} />)
  }
  if (!multi && e.type === 'image') out.push({ id: 'crop', label: 'Crop', icon: <CropIcon size={22} strokeWidth={1.75} />, run: () => useUI.getState().setCropOpen(true) })
  if (hasFill) P('colour', 'Colour', <Dot color={e.fill} bg={!multi && e.fillGradient ? gradCss(e.fillGradient) : undefined} />)
  if (!multi && e.type === 'text') P('format', 'Style', <AlignLeft size={22} strokeWidth={1.75} />)
  if (!multi && (e.type === 'line' || e.type === 'arrow')) P('stroke', 'Line', <Dot color={e.stroke} />)
  if (!multi && (e.type === 'rect' || e.type === 'ellipse')) P('stroke', 'Border', <SquareDashed size={22} strokeWidth={1.75} />)
  if (!multi && (e.type === 'rect' || e.type === 'image')) P('corners', e.type === 'image' ? 'Shape' : 'Corners', <CornerIcon />)
  if (multi && !els.every((x) => x.groupId && x.groupId === e.groupId)) out.push({ id: 'group', label: 'Group', icon: <GroupIcon size={22} strokeWidth={1.75} />, run: () => st().group() })
  if (els.some((x) => x.groupId)) out.push({ id: 'ungroup', label: 'Ungroup', icon: <UngroupIcon size={22} strokeWidth={1.75} />, run: () => st().ungroup() })
  P('opacity', 'Opacity', <Droplets size={22} strokeWidth={1.75} />)
  if (!multi && e.type !== 'line' && e.type !== 'arrow') P('shadow', 'Shadow', <Sparkles size={22} strokeWidth={1.75} />)
  P('position', 'Position', <Move size={22} strokeWidth={1.75} />)
  if (!multi) P('link', 'Link', <Link2 size={22} strokeWidth={1.75} />)
  P('arrange', 'Arrange', <LayersIcon size={22} strokeWidth={1.75} />)
  P('all', 'All', <SlidersHorizontal size={22} strokeWidth={1.75} />)
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
    useUI.getState().setMulti(false)
    setCtx(null)
  }
  return (
    <div className="ctxbar" role="toolbar" aria-label="Element options">
      <div className="ctx-items">
        {items.map((it) => (
          <button
            key={it.id}
            className={'ctx-item' + (it.panel && ctx === it.panel ? ' on' : '')}
            aria-pressed={it.panel ? ctx === it.panel : undefined}
            onClick={() => (it.run ? it.run() : setCtx(ctx === it.panel ? null : (it.panel as CtxPanel)))}
          >
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
  const ok = !!ctx && els.length > 0 && itemsFor(els).some((i) => i.panel === ctx)
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
