import { useCallback, useEffect, useMemo, useState } from 'react'
import { Copy, Download, FolderOpen, LayoutGrid, List, Pencil, Plus, Search, Settings as Cog, Trash2, Upload } from 'lucide-react'
import type { Doc, ProjectMeta } from '../../engine/types'
import { DEVICE_PRESETS } from '../../engine/types'
import { loginTemplate, newDoc, parseProject, serializeProject, statusBarEls, uid } from '../../engine/doc'
import { deleteProject, friendlyDbError, getPref, listProjects, loadDoc, saveDoc, setPref } from '../../database/db'
import { saveText, pickFile } from '../../services/files'
import { useBackHandler } from '../../services/back'

type Sort = 'updated' | 'name' | 'created'

interface Props {
  onOpen: (doc: Doc, warnings: string[]) => void
  theme: string
  setTheme: (t: string) => void
}

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return new Date(t).toLocaleDateString()
}

export default function Home({ onOpen, theme, setTheme }: Props) {
  const [items, setItems] = useState<ProjectMeta[]>([])
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('updated')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [dialog, setDialog] = useState<null | 'new' | 'settings'>(null)
  const [msg, setMsg] = useState('')
  const [usage, setUsage] = useState('')
  const [lastBackup, setLastBackup] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    try {
      setItems(await listProjects())
    } catch (e) {
      setMsg(friendlyDbError(e))
    }
    try {
      const est = await navigator.storage?.estimate?.()
      if (est?.usage != null) setUsage(`${(est.usage / 1048576).toFixed(1)} MB used${est.quota ? ` of ${Math.round(est.quota / 1048576)} MB` : ''}`)
    } catch {
      /* estimate unsupported */
    }
    setLastBackup(await getPref<number | null>('last-backup', null))
  }, [])
  useEffect(() => {
    void refresh()
  }, [refresh])

  const closeDialog = useCallback(() => setDialog(null), [])
  useBackHandler(dialog !== null, closeDialog)

  const shown = useMemo(() => {
    const f = items.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
    return f.sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'created' ? b.createdAt - a.createdAt : b.updatedAt - a.updatedAt))
  }, [items, q, sort])

  const open = async (id: string) => {
    try {
      const r = await loadDoc(id)
      onOpen(r.doc, r.warnings)
    } catch (e: any) {
      setMsg(e?.message ?? 'Could not open project')
    }
  }

  const rename = async (p: ProjectMeta) => {
    const n = window.prompt('Rename project', p.name)
    if (!n?.trim()) return
    const { doc } = await loadDoc(p.id)
    await saveDoc({ ...doc, name: n.trim(), updatedAt: Date.now() })
    void refresh()
  }
  const duplicate = async (p: ProjectMeta) => {
    try {
      const { doc } = await loadDoc(p.id)
      const now = Date.now()
      await saveDoc({ ...doc, id: uid(), name: `${doc.name} copy`, createdAt: now, updatedAt: now }, p.thumb)
      void refresh()
    } catch (e) {
      setMsg(friendlyDbError(e))
    }
  }
  const exportOne = async (p: ProjectMeta) => {
    const { doc } = await loadDoc(p.id)
    await saveText(`${p.name.replace(/[^a-z0-9-_]+/gi, '_')}.tuika.json`, serializeProject(doc), 'application/json')
    const t = Date.now()
    await setPref('last-backup', t)
    setLastBackup(t)
  }
  const remove = async (p: ProjectMeta) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone. Tip: export a backup first.`)) return
    await deleteProject(p.id)
    void refresh()
  }
  const importBackup = async () => {
    const f = await pickFile('.json,application/json')
    if (!f) return
    try {
      if (f.size > 100 * 1024 * 1024) throw new Error('File is too large')
      const { doc, warnings } = parseProject(await f.text())
      const now = Date.now()
      const fresh = { ...doc, id: uid(), name: items.some((i) => i.name === doc.name) ? `${doc.name} (restored)` : doc.name, createdAt: now, updatedAt: now }
      await saveDoc(fresh)
      await refresh()
      setMsg(warnings.length ? `Imported with ${warnings.length} note(s): ${warnings.slice(0, 3).join(' | ')}` : 'Project imported')
    } catch (e: any) {
      setMsg(`Import failed: ${e?.message ?? e}`)
    }
  }

  return (
    <div className="home">
      <header className="hhead">
        <h1>Tuika UI/UX</h1>
        <button className="ic" aria-label="Import project backup" onClick={() => void importBackup()}>
          <Upload size={20} />
        </button>
        <button className="ic" aria-label="Settings" onClick={() => setDialog('settings')}>
          <Cog size={20} />
        </button>
      </header>
      <div className="hbar">
        <label className="search">
          <Search size={16} />
          <input aria-label="Search projects" placeholder="Search projects" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select aria-label="Sort projects" className="txt" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="updated">Last modified</option>
          <option value="name">Name</option>
          <option value="created">Created</option>
        </select>
        <button className="ic" aria-label={view === 'grid' ? 'List view' : 'Grid view'} onClick={() => setView(view === 'grid' ? 'list' : 'grid')}>
          {view === 'grid' ? <List size={18} /> : <LayoutGrid size={18} />}
        </button>
      </div>
      {msg && (
        <div className="warn" role="alert" onClick={() => setMsg('')}>
          {msg}
        </div>
      )}
      <main className={'plist ' + view}>
        {shown.length === 0 && (
          <div className="empty">
            {items.length === 0 ? (
              <>
                <strong>No projects yet</strong>
                <p>Create your first project: pick a device size, add shapes, text and icons, link screens and preview the prototype.</p>
                <button className="big primary" onClick={() => setDialog('new')}>
                  <Plus size={18} /> New project
                </button>
              </>
            ) : (
              'No projects match your search'
            )}
          </div>
        )}
        {shown.map((p) => (
          <article className="pcard" key={p.id}>
            <button className="pthumb" aria-label={`Open ${p.name}`} onClick={() => void open(p.id)}>
              {p.thumb ? <img alt="" src={p.thumb} /> : <FolderOpen size={28} />}
            </button>
            <div className="pinfo">
              <div className="pn">{p.name}</div>
              <div className="pm">
                {p.artboards} screen{p.artboards > 1 ? 's' : ''} - {ago(p.updatedAt)}
              </div>
              <div className="pact">
                <button className="ic" aria-label={`Rename ${p.name}`} onClick={() => void rename(p)}>
                  <Pencil size={15} />
                </button>
                <button className="ic" aria-label={`Duplicate ${p.name}`} onClick={() => void duplicate(p)}>
                  <Copy size={15} />
                </button>
                <button className="ic" aria-label={`Export backup of ${p.name}`} onClick={() => void exportOne(p)}>
                  <Download size={15} />
                </button>
                <button className="ic" aria-label={`Delete ${p.name}`} onClick={() => void remove(p)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </main>
      <footer className="hfoot">
        <span>
          {usage || 'Local storage'} {lastBackup ? `- last backup ${ago(lastBackup)}` : '- no backup exported yet'}
        </span>
      </footer>
      {items.length > 0 && (
        <button className="fab" aria-label="New project" onClick={() => setDialog('new')}>
          <Plus size={24} />
        </button>
      )}
      {dialog === 'new' && <NewProject onClose={closeDialog} onCreate={(d) => onOpen(d, [])} />}
      {dialog === 'settings' && (
        <Modal title="Settings" onClose={closeDialog}>
          <div className="prow">
            <div className="plabel">Theme</div>
            <div className="pctl">
              {['light', 'dark', 'system'].map((t) => (
                <button
                  key={t}
                  className={'mini' + (theme === t ? ' on' : '')}
                  onClick={() => {
                    setTheme(t)
                    void setPref('theme', t)
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="hint">
            <p>Projects are stored on this device (IndexedDB). Nothing is uploaded. Online icon search sends only your search text to api.iconify.design.</p>
            <p>Not in this version: automatic screenshot-to-layers detection, groups/auto-layout, reusable components with overrides, rulers/guides, JPEG/PNG import of SVG files.</p>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <strong>{title}</strong>
          <button className="mini" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

function NewProject({ onClose, onCreate }: { onClose: () => void; onCreate: (d: Doc) => void }) {
  const [name, setName] = useState('Untitled project')
  const [preset, setPreset] = useState('android-m')
  const p = DEVICE_PRESETS.find((d) => d.id === preset)!
  const [w, setW] = useState(p.w)
  const [h, setH] = useState(p.h)
  const [land, setLand] = useState(false)
  const [bg, setBg] = useState('#FFFFFF')
  const [count, setCount] = useState(1)
  const [bars, setBars] = useState(false)
  const [tpl, setTpl] = useState<'blank' | 'login'>('blank')
  const [err, setErr] = useState('')

  const pick = (id: string) => {
    setPreset(id)
    const d = DEVICE_PRESETS.find((x) => x.id === id)!
    if (id !== 'custom') {
      setW(d.w)
      setH(d.h)
    }
  }

  const create = async () => {
    const a = Math.round(Math.min(8000, Math.max(100, w)))
    const b = Math.round(Math.min(8000, Math.max(100, h)))
    const fw = land ? Math.max(a, b) : Math.min(a, b)
    const fh = land ? Math.min(a, b) : Math.max(a, b)
    const doc = newDoc(name.trim() || 'Untitled project', fw, fh, bg, count)
    for (const ab of doc.artboards) {
      if (bars) ab.els.push(...statusBarEls(ab.w, ab.h, true))
      if (tpl === 'login') loginTemplate(ab)
    }
    try {
      await saveDoc(doc)
      onCreate(doc)
    } catch (e) {
      setErr(friendlyDbError(e))
    }
  }

  return (
    <Modal title="New project" onClose={onClose}>
      <div className="props">
        <div className="prow stack">
          <div className="plabel">Name</div>
          <input className="txt wide" aria-label="Project name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="prow">
          <div className="plabel">Device</div>
          <select className="txt" aria-label="Device preset" value={preset} onChange={(e) => pick(e.target.value)}>
            {DEVICE_PRESETS.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.id !== 'custom' ? ` (${d.w}x${d.h})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="prow">
          <div className="plabel">Size</div>
          <input className="txt small" aria-label="Width" inputMode="numeric" value={w} onChange={(e) => { setW(Number(e.target.value) || 0); setPreset('custom') }} />
          <span>x</span>
          <input className="txt small" aria-label="Height" inputMode="numeric" value={h} onChange={(e) => { setH(Number(e.target.value) || 0); setPreset('custom') }} />
        </div>
        <div className="prow">
          <div className="plabel">Orientation</div>
          <button className={'mini' + (!land ? ' on' : '')} onClick={() => setLand(false)}>
            Portrait
          </button>
          <button className={'mini' + (land ? ' on' : '')} onClick={() => setLand(true)}>
            Landscape
          </button>
        </div>
        <div className="prow">
          <div className="plabel">Background</div>
          <input type="color" aria-label="Background color" value={bg} onChange={(e) => setBg(e.target.value.toUpperCase())} />
        </div>
        <div className="prow">
          <div className="plabel">Screens</div>
          <input className="txt small" aria-label="Initial artboard count" inputMode="numeric" value={count} onChange={(e) => setCount(Math.min(12, Math.max(1, Number(e.target.value) || 1)))} />
        </div>
        <div className="prow">
          <div className="plabel">Template</div>
          <button className={'mini' + (tpl === 'blank' ? ' on' : '')} onClick={() => setTpl('blank')}>
            Blank
          </button>
          <button className={'mini' + (tpl === 'login' ? ' on' : '')} onClick={() => setTpl('login')}>
            Login screen
          </button>
        </div>
        <label className="prow check">
          <input type="checkbox" checked={bars} onChange={(e) => setBars(e.target.checked)} /> Add status bar and navigation bar shapes
        </label>
        {err && <div className="warn">{err}</div>}
        <button className="big primary" onClick={() => void create()}>
          Create project
        </button>
      </div>
    </Modal>
  )
}
