import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Circle, Download, Frame, Grid3x3, ImagePlus, Layers as LayersIcon, Maximize, MoreHorizontal, MousePointer2, MoveRight, Minus, Play, Redo2, Shapes as ShapesIcon, Paintbrush, Smile, Square, Type, Undo2, X, ClipboardPaste, Pencil, CopyPlus } from 'lucide-react'
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

const TITLES: Record<Exclude<Sheet, null>, string> = { props: 'Properties', layers: 'Layers', assets: 'Assets', export: 'Export', more: 'More' }

const SHORT: Record<string, string> = { sel: 'Select', text: 'Text', shape: 'Shapes', icons: 'Icons', img: 'Image', frame: 'Screen', layers: 'Layers', props: 'Style' }

function MoreMenu() {
  const st = useEditor.getState()
  const doc = useEditor((s) => s.doc)!
  const sel = useEditor((s) => s.sel)
  const hasClip = useEditor((s) => !!s.clip)
  const grid = useUI((s) => s.grid)
  const toggleGrid = useUI((s) => s.toggleGrid)
  const close = () => useUI.getState().setSheet(null)
  const items = [
    { I: Frame, t: 'Add artboard', run: () => st.addArtboard() },
    { I: CopyPlus, t: 'Duplicate current artboard', run: () => sel.abId && st.duplicateArtboard(sel.abId) },
    { I: Maximize, t: 'Fit all artboards to screen', run: () => window.dispatchEvent(new Event('tuika-fit')) },
    { I: Grid3x3, t: grid ? 'Hide 8px grid' : 'Show 8px grid', run: toggleGrid },
    { I: Pencil, t: 'Rename project', run: () => { const n = window.prompt('Project name', doc.name); if (n && n.trim()) st.rename(n.trim()) } },
    { I: ClipboardPaste, t: 'Paste', run: () => st.paste(), off: !hasClip },
  ]
  return (
    <div className="props">
      <section className="psec flush">
        {items.map(({ I, t, run, off }) => (
          <button key={t} className="menu-item" disabled={off} onClick={() => { run(); close() }}>
            <I size={18} /> {t}
          </button>
        ))}
      </section>
    </div>
  )
}

export default function Editor({ onExit }: { onExit: () => void }) {
  const doc = useEditor((s) => s.doc)!
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const selCount = useEditor((s) => s.sel.elIds.length)
  const save = useSave()
  const { sheet, setSheet, preview, setPreview, toast, setAssetTab } = useUI()
  const wide = useWide()
  const [shapeMenu, setShapeMenu] = useState(false)
  const st = useEditor.getState()

  const exit = useCallback(async () => {
    await flushSave(makeThumbnail, true)
    setSheet(null)
    setPreview(false)
    onExit()
  }, [onExit, setSheet, setPreview])

  const closeSheet = useCallback(() => setSheet(null), [setSheet])
  const closePreview = useCallback(() => setPreview(false), [setPreview])
  const closeShape = useCallback(() => setShapeMenu(false), [])
  useBackHandler(preview, closePreview)
  useBackHandler(!preview && shapeMenu, closeShape)
  useBackHandler(!preview && !shapeMenu && sheet !== null && !wide, closeSheet)
  useBackHandler(!preview && !shapeMenu && (sheet === null || wide), () => void exit())

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
            for (const el of d.artboards.find((a) => a.id === ab.id)!.els)
              if (s.sel.elIds.includes(el.id)) {
                el.x += dx
                el.y += dy
              }
          }, 'nudge')
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  useEffect(() => {
    const h = () => document.visibilityState === 'hidden' && void flushSave(makeThumbnail)
    document.addEventListener('visibilitychange', h)
    return () => document.removeEventListener('visibilitychange', h)
  }, [])

  const toggle = (s: Exclude<Sheet, null>) => {
    setShapeMenu(false)
    setSheet(sheet === s ? null : s)
  }
  const openAssets = (tab: 'icons' | 'images') => {
    setShapeMenu(false)
    setAssetTab(tab)
    setSheet('assets')
  }
  const content = (s: Exclude<Sheet, null>) =>
    s === 'props' ? <Inspector /> : s === 'layers' ? <Layers /> : s === 'assets' ? <Assets /> : s === 'export' ? <ExportPanel /> : <MoreMenu />

  useEffect(() => {
    document.querySelector('.dock .dk.on')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [sheet, shapeMenu])

  const statusText = save.status === 'saving' ? 'Saving...' : save.status === 'error' ? 'Save failed' : save.status === 'saved' ? 'All changes saved' : 'Local project'

  const dock: { id: string; label: string; I: typeof Square; run: () => void; on?: boolean; dot?: boolean }[] = [
    { id: 'sel', label: 'Select', I: MousePointer2, run: () => { setShapeMenu(false); st.select(useEditor.getState().sel.abId, []); setSheet(null) }, on: sheet === null && !shapeMenu },
    { id: 'text', label: 'Add text', I: Type, run: () => { setShapeMenu(false); st.addEl('text') } },
    { id: 'shape', label: 'Add shape', I: ShapesIcon, run: () => setShapeMenu((v) => !v), on: shapeMenu },
    { id: 'icons', label: 'Icons', I: Smile, run: () => openAssets('icons'), on: sheet === 'assets' },
    { id: 'img', label: 'Add image', I: ImagePlus, run: () => openAssets('images') },
    { id: 'frame', label: 'Add artboard', I: Frame, run: () => { setShapeMenu(false); const id = st.addArtboard(); if (id) window.dispatchEvent(new CustomEvent('tuika-focus', { detail: id })) } },
    { id: 'layers', label: 'Layers', I: LayersIcon, run: () => toggle('layers'), on: sheet === 'layers' },
    { id: 'props', label: 'Properties', I: Paintbrush, run: () => toggle('props'), on: sheet === 'props', dot: selCount > 0 && sheet !== 'props' },
  ]

  const shapes = [
    { t: 'Rectangle', I: Square, run: () => st.addEl('rect') },
    { t: 'Ellipse', I: Circle, run: () => st.addEl('ellipse') },
    { t: 'Line', I: Minus, run: () => st.addEl('line') },
    { t: 'Arrow', I: MoveRight, run: () => st.addEl('arrow') },
  ]

  return (
    <div className={'editor' + (wide ? ' wide' : '')}>
      <header className="ehead">
        <button className="ic" aria-label="Back to projects" onClick={() => void exit()}>
          <ArrowLeft size={20} />
        </button>
        <button
          className="ptitle-btn"
          aria-label="Rename project"
          onClick={() => {
            const n = window.prompt('Project name', doc.name)
            if (n && n.trim()) st.rename(n.trim())
          }}
        >
          <span className="pname">{doc.name}</span>
          <span className={'savestat ' + save.status} role="status" title={save.msg}>
            {statusText}
          </span>
        </button>
        <button className="ic" aria-label="Undo" disabled={!canUndo} onClick={() => st.undo()}>
          <Undo2 size={19} />
        </button>
        <button className="ic" aria-label="Redo" disabled={!canRedo} onClick={() => st.redo()}>
          <Redo2 size={19} />
        </button>
        <button className="ic" aria-label="Preview prototype" onClick={() => setPreview(true)}>
          <Play size={19} />
        </button>
        <button className="ic dark" aria-label="Export" onClick={() => toggle('export')}>
          <Download size={18} />
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
                <button key={s} className={'chip' + ((sheet && sheet !== 'more' ? sheet : 'props') === s ? ' on' : '')} onClick={() => setSheet(s)}>
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
          <div className="grab" aria-hidden />
          <div className="sheet-head">
            <strong>{TITLES[sheet]}</strong>
            <button className="ic fill" aria-label="Close panel" onClick={closeSheet}>
              <X size={17} />
            </button>
          </div>
          <div className="sheet-body">{content(sheet)}</div>
        </section>
      )}

      <div className="dock-wrap">
        {shapeMenu && (
          <div className="shape-menu" role="menu" aria-label="Shapes">
            {shapes.map(({ t, I, run }) => (
              <button
                key={t}
                role="menuitem"
                onClick={() => {
                  run()
                  setShapeMenu(false)
                }}
              >
                <I size={20} />
                <span>{t}</span>
              </button>
            ))}
          </div>
        )}
        <nav className="dock" aria-label="Tools">
          {dock.map(({ id, label, I, run, on, dot }, i) => (
            <span key={id} className="dk-item">
              {(i === 5 || i === 6) && <span className="dk-sep" aria-hidden />}
              <button className={'dk' + (on ? ' on' : '') + (dot ? ' dot' : '')} aria-label={label} title={label} aria-pressed={on} onClick={run}>
                <I size={20} strokeWidth={1.75} />
                {on && <span className="dk-label">{SHORT[id]}</span>}
              </button>
            </span>
          ))}
        </nav>
      </div>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {preview && <Preview />}
    </div>
  )
}

