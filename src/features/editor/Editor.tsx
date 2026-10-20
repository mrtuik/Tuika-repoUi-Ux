import { useCallback, useEffect, useRef, useState } from 'react'
import type { ComponentType } from 'react'
import { AiEditIcon, LayerIcon, UploadIcon } from './icons'
import { ArrowLeft, Download, Frame, Grid3x3, Layers as LayersIcon, Maximize, MoreHorizontal, MousePointer2, Play, Redo2, Shapes as ShapesIcon, Paintbrush, Square, Type, Undo2, ClipboardPaste, Pencil, CopyPlus } from 'lucide-react'
import { useEditor } from '../../state/editor'
import { useUI } from '../../state/ui'
import type { Sheet } from '../../state/ui'
import { useSave, flushSave } from '../../database/persistence'
import { useBackHandler } from '../../services/back'
import CanvasView, { makeThumbnail } from '../canvas/CanvasView'
import Inspector from '../inspector/Inspector'
import Layers from '../layers/Layers'
import Elements from '../assets/Elements'
import BottomSheet from './BottomSheet'
import { ContextBar, ContextSheet } from './ContextBar'
import CropModal from './CropModal'
import ExportPanel from './ExportPanel'
import AskAI from '../ai/AskAI'
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

const TITLES: Record<Exclude<Sheet, null>, string> = { props: 'Properties', layers: 'Layers', assets: 'Elements', export: 'Export', more: 'More' }

const SHORT: Record<string, string> = { sel: 'Select', elements: 'Elements', text: 'Text', frame: 'Screen', layers: 'Layers', props: 'Style', upload: 'Upload' }

function MoreMenu() {
  const st = useEditor.getState()
  const doc = useEditor((s) => s.doc)!
  const sel = useEditor((s) => s.sel)
  const hasClip = useEditor((s) => !!s.clip)
  const grid = useUI((s) => s.grid)
  const toggleGrid = useUI((s) => s.toggleGrid)
  const close = () => useUI.getState().setSheet(null)
  const items = [
    { I: Download, t: 'Export', run: () => useUI.getState().setSheet('export') },
    { I: Frame, t: 'Add artboard', run: () => st.addArtboard() },
    { I: CopyPlus, t: 'Duplicate current artboard', run: () => sel.abId && st.duplicateArtboard(sel.abId) },
    { I: Maximize, t: 'Fit screen to view', run: () => window.dispatchEvent(new Event('tuika-fit')) },
    { I: Grid3x3, t: grid ? 'Hide 8px grid' : 'Show 8px grid', run: toggleGrid },
    { I: Pencil, t: 'Rename project', run: () => { const n = window.prompt('Project name', doc.name); if (n && n.trim()) st.rename(n.trim()) } },
    { I: ClipboardPaste, t: 'Paste', run: () => st.paste(), off: !hasClip },
  ]
  return (
    <div className="props">
      <section className="psec flush">
        {items.map(({ I, t, run, off }) => (
          <button key={t} className="menu-item" disabled={off} onClick={() => { close(); run() }}>
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
  const selKey = useEditor((s) => s.sel.elIds.join(','))
  const save = useSave()
  const { sheet, setSheet, preview, setPreview, toast, ctx, setCtx, openElements, cropOpen, picker, elemPage, aiOpen } = useUI()
  const closeCrop = useCallback(() => useUI.getState().setCropOpen(false), [])
  const cancelPick = useCallback(() => useUI.getState().cancelPick(), [])
  const busyModal = cropOpen || !!picker
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
  const closeCtx = useCallback(() => setCtx(null), [setCtx])
  const deselect = useCallback(() => {
    const t = useEditor.getState()
    t.select(t.sel.abId, [])
  }, [])
  const hasSel = selCount > 0
  // the element toolbar stays visible under the Layers list, so picking a layer shows its options right away
  const barOn = !wide && hasSel && (sheet === null || sheet === 'layers')
  const ctxOpen = barOn && ctx !== null
  useBackHandler(preview, closePreview)
  useBackHandler(!preview && !aiOpen && !wide && sheet !== null && !busyModal, closeSheet)
  useBackHandler(!preview && !aiOpen && ctxOpen && !busyModal, closeCtx)
  useBackHandler(!preview && !aiOpen && barOn && sheet === null && !ctxOpen && !busyModal, deselect)
  useBackHandler(!preview && !aiOpen && cropOpen, closeCrop)
  useBackHandler(!preview && !aiOpen && !cropOpen && !!picker, cancelPick)
  useBackHandler(!preview && !aiOpen && (sheet === null || wide) && !barOn && !busyModal, () => void exit())

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

  const toggle = (s: Exclude<Sheet, null>) => setSheet(sheet === s ? null : s)

  // adding or picking an element closes the Elements sheet (like Canva) and shows that element's toolbar
  const lastSel = useRef(selKey)
  useEffect(() => {
    if (selKey && selKey !== lastSel.current && useUI.getState().sheet === 'assets') setSheet(null)
    if (!selKey) setCtx(null)
    lastSel.current = selKey
  }, [selKey, setSheet, setCtx])
  const content = (s: Exclude<Sheet, null>) =>
    s === 'props' ? <Inspector /> : s === 'layers' ? <Layers /> : s === 'assets' ? <Elements /> : s === 'export' ? <ExportPanel /> : <MoreMenu />

  useEffect(() => {
    document.querySelector('.dock .dk.on')?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [sheet])

  const statusText = save.status === 'saving' ? 'Saving...' : save.status === 'error' ? 'Save failed' : save.status === 'saved' ? 'All changes saved' : 'Local project'

  const dock: { id: string; label: string; I: ComponentType<any>; run: () => void; on?: boolean; dot?: boolean }[] = [
    { id: 'sel', label: 'Select', I: MousePointer2, run: () => { st.select(useEditor.getState().sel.abId, []); setSheet(null) }, on: sheet === null },
    { id: 'elements', label: 'Elements', I: ShapesIcon, run: () => (sheet === 'assets' && elemPage !== 'upload' ? setSheet(null) : openElements('home')), on: sheet === 'assets' && elemPage !== 'upload' },
    { id: 'upload', label: 'Upload', I: UploadIcon, run: () => (sheet === 'assets' && elemPage === 'upload' ? setSheet(null) : openElements('upload')), on: sheet === 'assets' && elemPage === 'upload' },
    { id: 'text', label: 'Add text', I: Type, run: () => { setSheet(null); st.addEl('text'); setCtx('edit') } },
    { id: 'frame', label: 'Add screen', I: Frame, run: () => { setSheet(null); const id = st.addArtboard(); if (id) window.dispatchEvent(new CustomEvent('tuika-focus', { detail: id })) } },
    { id: 'layers', label: 'Layers', I: LayerIcon, run: () => toggle('layers'), on: sheet === 'layers' },
    { id: 'props', label: 'Properties', I: Paintbrush, run: () => toggle('props'), on: sheet === 'props' },
    { id: 'ai', label: 'Ask AI', I: AiEditIcon, run: () => useUI.getState().setAiOpen(true) },
  ]

  return (
    <div className={'editor' + (wide ? ' wide' : '')}>
      <header className="ehead">
        <button className="ic" aria-label="Back to projects" onClick={() => void exit()}>
          <ArrowLeft size={18} />
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
          <Undo2 size={17} />
        </button>
        <button className="ic" aria-label="Redo" disabled={!canRedo} onClick={() => st.redo()}>
          <Redo2 size={17} />
        </button>
        <button className="ic" aria-label="Preview prototype" onClick={() => setPreview(true)}>
          <Play size={17} />
        </button>
        <button className="ic" aria-label="More actions" onClick={() => toggle('more')}>
          <MoreHorizontal size={18} />
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
        <BottomSheet key={sheet} title={TITLES[sheet]} onClose={closeSheet} vh={sheet === 'assets' ? 62 : 46} tall={86} header={sheet !== 'assets'}>
          {content(sheet)}
        </BottomSheet>
      )}
      {ctxOpen && <ContextSheet />}

      <div className="dock-wrap">
        {barOn ? (
          <ContextBar />
        ) : (
          <nav className="dock" aria-label="Tools">
            {dock.map(({ id, label, I, run, on, dot }, i) => (
              <span key={id} className="dk-item">
                {(i === 4 || i === 5 || i === 7) && <span className="dk-sep" aria-hidden />}
                <button className={'dk' + (on ? ' on' : '') + (dot ? ' dot' : '')} aria-label={label} title={label} aria-pressed={on} onClick={run}>
                  <I size={18} strokeWidth={1.6} />
                  {on && <span className="dk-label">{SHORT[id]}</span>}
                </button>
              </span>
            ))}
          </nav>
        )}
      </div>

      {cropOpen && <CropModal />}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {preview && <Preview />}
      {aiOpen && <AskAI />}
    </div>
  )
}

