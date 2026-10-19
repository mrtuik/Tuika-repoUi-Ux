import { AlignCenter, AlignLeft, AlignRight, Bold, Check, Italic, RemoveFormatting, Strikethrough, Underline, Crop as CropIcon, Group as GroupIcon, Keyboard, Ungroup as UngroupIcon, Link2, SquareDashed, Type } from 'lucide-react'
import { LayerIcon, NudgeIcon, OpacityIcon, PositionIcon, ShadowIcon, StyleIcon } from './icons'
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
  nudge: 'Nudge',
  link: 'Prototype link',
  arrange: 'Arrange',
  all: 'All settings',
}

function CornerIcon({ size = 18 }: { size?: number }) {
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
    P('edit', 'Edit', <Keyboard size={18} strokeWidth={1.6} />)
    P('font', 'Font', <Type size={18} strokeWidth={1.6} />)
  }
  if (!multi && e.type === 'image') out.push({ id: 'crop', label: 'Crop', icon: <CropIcon size={18} strokeWidth={1.6} />, run: () => useUI.getState().setCropOpen(true) })
  if (hasFill) P('colour', 'Colour', <Dot color={e.fill} bg={!multi && e.fillGradient ? gradCss(e.fillGradient) : undefined} />)
  if (!multi && e.type === 'text') P('format', 'Style', <AlignLeft size={18} strokeWidth={1.6} />)
  if (!multi && (e.type === 'line' || e.type === 'arrow')) P('stroke', 'Line', <Dot color={e.stroke} />)
  if (!multi && (e.type === 'rect' || e.type === 'ellipse')) P('stroke', 'Border', <SquareDashed size={18} strokeWidth={1.6} />)
  if (!multi && (e.type === 'rect' || e.type === 'image')) P('corners', e.type === 'image' ? 'Shape' : 'Corners', <CornerIcon />)
  if (multi && !els.every((x) => x.groupId && x.groupId === e.groupId)) out.push({ id: 'group', label: 'Group', icon: <GroupIcon size={18} strokeWidth={1.6} />, run: () => st().group() })
  if (els.some((x) => x.groupId)) out.push({ id: 'ungroup', label: 'Ungroup', icon: <UngroupIcon size={18} strokeWidth={1.6} />, run: () => st().ungroup() })
  P('opacity', 'Opacity', <OpacityIcon />)
  if (!multi && e.type !== 'line' && e.type !== 'arrow') P('shadow', 'Shadow', <ShadowIcon />)
  P('position', 'Position', <PositionIcon />)
  P('nudge', 'Nudge', <NudgeIcon />)
  if (!multi) P('link', 'Link', <Link2 size={18} strokeWidth={1.6} />)
  P('arrange', 'Arrange', <LayerIcon />)
  P('all', 'All', <StyleIcon />)
  return out
}

/** Text formatting strip that sits right above the contextual toolbar when one text element is selected. */
function TextBar({ e }: { e: El }) {
  const ctx = useUI((s) => s.ctx)
  const setCtx = useUI((s) => s.setCtx)
  const patch = (p: Partial<El>) => useEditor.getState().patchSel(p)
  const bold = (e.fontWeight ?? 400) >= 600
  const nextAlign = e.align === 'center' ? 'right' : e.align === 'right' ? 'left' : 'center'
  const AlignI = e.align === 'center' ? AlignCenter : e.align === 'right' ? AlignRight : AlignLeft
  const openPanel = (p: CtxPanel) => {
    if (useUI.getState().sheet) useUI.getState().setSheet(null)
    setCtx(ctx === p ? null : p)
  }
  const B = ({ label, on, run, children }: { label: string; on?: boolean; run: () => void; children: ReactNode }) => (
    <button className={'tb-btn' + (on ? ' on' : '')} aria-label={label} title={label} aria-pressed={on} onClick={run}>
      {children}
    </button>
  )
  return (
    <div className="textbar" role="toolbar" aria-label="Text formatting">
      <B label="Font" on={ctx === 'font'} run={() => openPanel('font')}>
        <span className="tb-aa">Aa</span>
      </B>
      <B label="Bold" on={bold} run={() => patch({ fontWeight: bold ? 400 : 700 })}>
        <Bold size={16} strokeWidth={2.2} />
      </B>
      <B label="Italic" on={!!e.italic} run={() => patch({ italic: !e.italic })}>
        <Italic size={16} />
      </B>
      <B label="Underline" on={!!e.underline} run={() => patch({ underline: !e.underline })}>
        <Underline size={16} />
      </B>
      <B label="Strikethrough" on={!!e.strike} run={() => patch({ strike: !e.strike })}>
        <Strikethrough size={16} />
      </B>
      <span className="tb-sep" aria-hidden />
      <B label={'Align ' + (e.align ?? 'left') + ', tap to change'} run={() => patch({ align: nextAlign })}>
        <AlignI size={16} />
      </B>
      <B label="Text colour" on={ctx === 'colour'} run={() => openPanel('colour')}>
        <span className="tb-colour">
          <span style={{ background: e.fill }} />
        </span>
      </B>
      <span className="tb-grow" />
      <B label="Clear styles" run={() => patch({ fontWeight: 400, italic: false, underline: false, strike: false })}>
        <RemoveFormatting size={16} />
      </B>
    </div>
  )
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
  const isText = els.length === 1 && els[0].type === 'text'
  return (
    <div className="ctxwrap">
      {isText && <TextBar e={els[0]} />}
    <div className="ctxbar" role="toolbar" aria-label="Element options">
      <div className="ctx-items">
        {items.map((it) => (
          <button
            key={it.id}
            className={'ctx-item' + (it.panel && ctx === it.panel ? ' on' : '')}
            aria-pressed={it.panel ? ctx === it.panel : undefined}
            onClick={() => {
              if (it.run) return it.run()
              // the Layers list and an option panel never stack: opening an option closes the list
              if (useUI.getState().sheet) useUI.getState().setSheet(null)
              setCtx(ctx === it.panel ? null : (it.panel as CtxPanel))
            }}
          >
            <span className="ctx-ic">{it.icon}</span>
            <span className="ctx-lb">{it.label}</span>
          </button>
        ))}
      </div>
      <button className="ctx-done" aria-label="Done" onClick={done}>
        <Check size={18} />
      </button>
    </div>
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
    <BottomSheet key={ctx} title={CTX_TITLES[ctx]} fit vh={ctx === 'all' ? 64 : ctx === 'nudge' ? 40 : 46} onClose={() => setCtx(null)} className="ctx">
      <Inspector only={ctx} />
    </BottomSheet>
  )
}
