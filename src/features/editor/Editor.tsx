import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Circle, Download, Eye, Image as ImageIcon, Layers as LayersIcon, Minus, MoreHorizontal, MousePointer2, MoveRight, Redo2, Shapes, SlidersHorizontal, Square, Type, Undo2, X, Frame } from 'lucide-react'
import { useEditor } from '../../state/editor'
import { useUI } from '../../state/ui'
import type { Sheet } from '../../state/ui'
import { useSave, flushSave } from '../../database/persistence'
import { useBackHandler } from '../../services/back'
import CanvasView, { makeThumbnail } from '../canvas/CanvasView'
import Inspector from '../inspector/Inspector'
import Layers from '../layers/Layers'
import Assets from '../assets/Assets'
import ExportPanel from './ExportPanel'
import Preview from '../prototype/Preview'

function useWide() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth >= 900 : false)
  useEffect(() => {
    const h = () => setW(window.innerWidth >= 900)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return w
}

const TITLES: Record<Exclude<Sheet, null>, string> = { props: 'Properties', layers: 'Layers', assets: 'Icons & images', export: 'Export', more: 'More' }

function MoreMenu() {
  const st = useEditor.getState()
  const doc = useEditor((s) => s.doc)!
  const sel = useEditor((s) => s.sel)
  const ui = useUI()
  return (
    <div className="props">
      <button className="big" onClick={() => st.addArtboard()}>
        Add artboard
      </button>
      <button className="big" onClick={() => sel.abId && st.duplicateArtboard(sel.abId)}>
        Duplicate current artboard
      </button>
      <button className="big" onClick={() => window.dispatchEvent(new Event('tuika-fit'))}>
        Fit all artboards to screen
      </button>
      <button className="big" onClick={ui.toggleGrid}>
        {ui.grid ? 'Hide grid' : 'Show 8px grid'}
      </button>
      <button
        className="big"
        onClick={() => {
          const n = window.prompt('Project name', doc.name)
          if (n && n.trim()) st.rename(n.trim())
        }}
      >
        Rename project
      </button>
      <button className="big" onClick={() => st.paste()} disabled={!useEditor.getState().clip}>
        Paste
      </button>
    </div>
  )
}

export default function Editor({ onExit }: { onExit: () => void }) {
  const doc = useEditor((s) => s.doc)!
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const selCount = useEditor((s) => s.sel.elIds.length)
  const save = useSave()
  const { sheet, setSheet, preview, setPreview, toast } = useUI()
  const wide = useWide()
  const st = useEditor.getState()

  const exit = useCallback(async () => {
    await flushSave(makeThumbnail, true)
    setSheet(null)
    setPreview(false)
    onExit()
  }, [onExit, setSheet, setPreview])

  const closeSheet = useCallback(() => setSheet(null), [setSheet])
  const closePreview = useCallback(() => setPreview(false), [setPreview])
  useBackHandler(preview, closePreview)
  useBackHandler(!preview && sheet !== null && !wide, closeSheet)
  useBackHandler(!preview && (sheet === null || wide), () => void exit())

  // keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const mod = e.ctrlKey || e.metaKey
      const s = useEditor.getState()
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? s.redo() : s.undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        s.redo()
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        s.duplicateSel()
      } else if (mod && e.key.toLowerCase() === 'c') s.copy()
      else if (mod && e.key.toLowerCase() === 'x') s.cut()
      else if (mod && e.key.toLowerCase() === 'v') s.paste()
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        s.removeSel()
      } else if (e.key.startsWith('Arrow') && s.sel.elIds.length) {
        e.preventDefault()
        const k = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -k : e.key === 'ArrowRight' ? k : 0
        const dy = e.key === 'ArrowUp' ? -k : e.key === 'ArrowDown' ? k : 0
        const ab = s.doc?.artboards.find((a) => a.id === s.sel.abId)
        if (ab)
          s.commit((d) => {
            for (const el of d.artboards.find((a) => a.id === ab.id)!.els) if (s.sel.elIds.includes(el.id)) {
              el.x += dx
              el.y += dy
            }
          }, 'nudge')
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // flush when the app goes to background
  useEffect(() => {
    const h = () => document.visibilityState === 'hidden' && void flushSave(makeThumbnail)
    document.addEventListener('visibilitychange', h)
    return () => document.removeEventListener('visibilitychange', h)
  }, [])

  const toggle = (s: Exclude<Sheet, null>) => setSheet(sheet === s ? null : s)
  const content = (s: Exclude<Sheet, null>) =>
    s === 'props' ? <Inspector /> : s === 'layers' ? <Layers /> : s === 'assets' ? <Assets /> : s === 'export' ? <ExportPanel /> : <MoreMenu />

  const tools: { id: string; label: string; I: typeof Square; run: () => void; on?: boolean }[] = [
    { id: 'sel', label: 'Select', I: MousePointer2, run: () => st.select(useEditor.getState().sel.abId, []) },
    { id: 'text', label: 'Text', I: Type, run: () => st.addEl('text') },
    { id: 'rect', label: 'Rectangle', I: Square, run: () => st.addEl('rect') },
    { id: 'ell', label: 'Ellipse', I: Circle, run: () => st.addEl('ellipse') },
    { id: 'line', label: 'Line', I: Minus, run: () => st.addEl('line') },
    { id: 'arrow', label: 'Arrow', I: MoveRight, run: () => st.addEl('arrow') },
    { id: 'icons', label: 'Icons', I: Shapes, run: () => toggle('assets'), on: sheet === 'assets' },
    { id: 'img', label: 'Image', I: ImageIcon, run: () => toggle('assets') },
    { id: 'frame', label: 'Artboard', I: Frame, run: () => st.addArtboard() },
    { id: 'layers', label: 'Layers', I: LayersIcon, run: () => toggle('layers'), on: sheet === 'layers' },
    { id: 'props', label: 'Properties', I: SlidersHorizontal, run: () => toggle('props'), on: sheet === 'props' },
  ]

  const statusText = save.status === 'saving' ? 'Saving...' : save.status === 'error' ? 'Save failed' : save.status === 'saved' ? 'Saved' : ''

  return (
    <div className={'editor' + (wide ? ' wide' : '')}>
      <header className="ehead">
        <button className="ic" aria-label="Back to projects" onClick={() => void exit()}>
          <ArrowLeft size={20} />
        </button>
        <button
          className="pname"
          aria-label="Rename project"
          onClick={() => {
            const n = window.prompt('Project name', doc.name)
            if (n && n.trim()) st.rename(n.trim())
          }}
        >
          {doc.name}
        </button>
        <span className={'savestat ' + save.status} role="status" title={save.msg}>
          {statusText}
        </span>
        <button className="ic" aria-label="Undo" disabled={!canUndo} onClick={() => st.undo()}>
          <Undo2 size={20} />
        </button>
        <button className="ic" aria-label="Redo" disabled={!canRedo} onClick={() => st.redo()}>
          <Redo2 size={20} />
        </button>
        <button className="ic" aria-label="Preview prototype" onClick={() => setPreview(true)}>
          <Eye size={20} />
        </button>
        <button className="ic" aria-label="Export" onClick={() => toggle('export')}>
          <Download size={20} />
        </button>
        <button className="ic" aria-label="More actions" onClick={() => toggle('more')}>
          <MoreHorizontal size={20} />
        </button>
      </header>
      {save.status === 'error' && (
        <div className="warn bar">
          {save.msg}{' '}
          <button className="mini" onClick={() => void flushSave(undefined, true)}>
            Retry
          </button>
        </div>
      )}

      <div className="ebody">
        <div className="canvas-col">
          <CanvasView />
        </div>
        {wide && (
          <aside className="side">
            <div className="side-tabs">
              {(['props', 'layers', 'assets', 'export'] as const).map((s) => (
                <button key={s} className={'chip' + ((sheet ?? 'props') === s ? ' on' : '')} onClick={() => setSheet(s)}>
                  {TITLES[s]}
                </button>
              ))}
            </div>
            <div className="side-body">{content(sheet && sheet !== 'more' ? sheet : 'props')}</div>
          </aside>
        )}
      </div>

      {!wide && sheet && (
        <section className="sheet" aria-label={TITLES[sheet]}>
          <div className="sheet-head">
            <strong>{TITLES[sheet]}</strong>
            <button className="ic" aria-label="Close panel" onClick={closeSheet}>
              <X size={18} />
            </button>
          </div>
          <div className="sheet-body">{content(sheet)}</div>
        </section>
      )}

      <nav className="toolbar" aria-label="Tools">
        {tools.map(({ id, label, I, run, on }) => (
          <button key={id} className={'tool' + (on ? ' on' : '') + (id === 'props' && selCount > 0 ? ' dot' : '')} aria-label={label} onClick={run}>
            <I size={20} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {preview && <Preview />}
    </div>
  )
}
