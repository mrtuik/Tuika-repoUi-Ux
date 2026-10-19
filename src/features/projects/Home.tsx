import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, Copy, Download, LayoutGrid, List, Pencil, Plus, Search, Settings as Cog, Trash2, Upload, X } from 'lucide-react'
import type { Doc, ProjectMeta } from '../../engine/types'
import { DEVICE_PRESETS } from '../../engine/types'
import { loginTemplate, newDoc, parseProject, serializeProject, statusBarEls, uid } from '../../engine/doc'
import { deleteProject, friendlyDbError, listProjects, loadDoc, saveDoc, setPref } from '../../database/db'
import { saveText, pickFile } from '../../services/files'
import { useBackHandler } from '../../services/back'
import { LogoMark } from '../brand/Logo'
import { ColorField, Field, Num, Section, Seg, Stepper, Toggle } from '../inspector/controls'

type Sort = 'updated' | 'name' | 'created'

interface Props {
  onOpen: (doc: Doc, warnings: string[]) => void
  theme: string
  setTheme: (t: string) => void
}

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'Just now'
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
  const [menu, setMenu] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setItems(await listProjects())
    } catch (e) {
      setMsg(friendlyDbError(e))
    }
  }, [])
  useEffect(() => {
    void refresh()
  }, [refresh])

  const closeDialog = useCallback(() => setDialog(null), [])
  const closeMenu = useCallback(() => setMenu(null), [])
  useBackHandler(dialog !== null, closeDialog)
  useBackHandler(menu !== null && dialog === null, closeMenu)

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
      await saveDoc({ ...doc, id: uid(), name: items.some((i) => i.name === doc.name) ? `${doc.name} (restored)` : doc.name, createdAt: now, updatedAt: now })
      await refresh()
      setMsg(warnings.length ? `Imported with ${warnings.length} note(s): ${warnings.slice(0, 3).join(' | ')}` : 'Project imported')
    } catch (e: any) {
      setMsg(`Import failed: ${e?.message ?? e}`)
    }
  }

  const recent = shown.slice(0, 1)[0]

  return (
    <div className="home">
      <header className="hhead">
        <div className="brand">
          <LogoMark variant="tile" size={40} />
          <div>
            <h1>Tuika</h1>
            <p>UI/UX design studio</p>
          </div>
        </div>
        <button className="ic ring" aria-label="Import project backup" onClick={() => void importBackup()}>
          <Upload size={17} />
        </button>
        <button className="ic ring" aria-label="Settings" onClick={() => setDialog('settings')}>
          <Cog size={17} />
        </button>
      </header>

      {msg && (
        <div className="warn mx" role="alert">
          <span>{msg}</span>
          <button className="ic small" aria-label="Dismiss message" onClick={() => setMsg('')}>
            <X size={14} />
          </button>
        </div>
      )}

      <main className="hmain">
        {items.length === 0 ? (
          <div className="hero">
            <LogoMark variant="tile" size={64} />
            <h2>Design your first app screen</h2>
            <p>Pick a device size, add shapes, text and icons, link screens together and preview the prototype. Everything is saved on this phone.</p>
            <div className="welcome-menu">
              <button className="welcome-item primary" onClick={() => setDialog('new')}>
                <Plus size={18} />
                <span>New project</span>
                <ChevronRight size={16} />
              </button>
              <button className="welcome-item" onClick={() => void importBackup()}>
                <Upload size={18} />
                <span>Restore from backup</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          <>
            <button className="newcard" onClick={() => setDialog('new')}>
              <span className="plus">
                <Plus size={18} />
              </span>
              <span>
                <strong>New project</strong>
                <small>Phone, tablet or custom size</small>
              </span>
              <ChevronRight size={16} />
            </button>

            <div className="hbar">
              <label className="search">
                <Search size={15} />
                <input aria-label="Search projects" placeholder="Search projects" value={q} onChange={(e) => setQ(e.target.value)} />
                {q && (
                  <button className="ic small" aria-label="Clear search" onClick={() => setQ('')}>
                    <X size={14} />
                  </button>
                )}
              </label>
              <button className="ic sq" aria-label={view === 'grid' ? 'Switch to list view' : 'Switch to grid view'} onClick={() => setView(view === 'grid' ? 'list' : 'grid')}>
                {view === 'grid' ? <List size={17} /> : <LayoutGrid size={17} />}
              </button>
            </div>
            <Seg<Sort>
              label="Sort projects"
              value={sort}
              onChange={setSort}
              options={[
                { v: 'updated', label: 'Recent' },
                { v: 'name', label: 'Name' },
                { v: 'created', label: 'Created' },
              ]}
            />

            {shown.length === 0 && <div className="empty">No projects match "{q}"</div>}
            {recent && !q && sort === 'updated' && <div className="group-label">Continue where you left off</div>}
            <div className={'plist ' + view}>
              {shown.map((p) => (
                <article className="pcard" key={p.id}>
                  <button className="pthumb" aria-label={`Open ${p.name}`} onClick={() => void open(p.id)}>
                    {p.thumb ? <img alt="" src={p.thumb} /> : <span className="ph">{p.name.slice(0, 1).toUpperCase()}</span>}
                  </button>
                  <div className="pinfo">
                    <div className="pn">{p.name}</div>
                    <div className="pm">
                      {p.artboards} screen{p.artboards > 1 ? 's' : ''} - {ago(p.updatedAt)}
                    </div>
                    <div className="pact">
                      <button aria-label={`Rename ${p.name}`} title="Rename" onClick={() => void rename(p)}>
                        <Pencil size={16} />
                      </button>
                      <button aria-label={`Duplicate ${p.name}`} title="Duplicate" onClick={() => void duplicate(p)}>
                        <Copy size={16} />
                      </button>
                      <button aria-label={`Export backup of ${p.name}`} title="Export backup" onClick={() => void exportOne(p)}>
                        <Download size={16} />
                      </button>
                      <button aria-label={`Delete ${p.name}`} title="Delete" onClick={() => void remove(p)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </main>

      {dialog === 'new' && <NewProject onClose={closeDialog} onCreate={(d) => onOpen(d, [])} />}
      {dialog === 'settings' && (
        <Sheet title="Settings" onClose={closeDialog}>
          <Section title="Appearance">
            <Seg
              label="Theme"
              value={theme}
              onChange={(t) => {
                setTheme(t)
                void setPref('theme', t)
              }}
              options={[
                { v: 'light', label: 'Light' },
                { v: 'dark', label: 'Dark' },
                { v: 'system', label: 'System' },
              ]}
            />
          </Section>
          <Section title="Privacy">
            <p className="hint flush">Projects are stored on this device (IndexedDB). Nothing is uploaded. Online icon search sends only your search text to api.iconify.design.</p>
          </Section>
          <Section title="Not in this version">
            <p className="hint flush">Automatic screenshot-to-layers detection, groups and auto-layout, reusable components, rulers and guides, image cropping.</p>
          </Section>
        </Sheet>
      )}
    </div>
  )
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="grab" aria-hidden />
        <div className="sheet-head">
          <strong>{title}</strong>
          <button className="ic fill" aria-label="Close" onClick={onClose}>
            <X size={17} />
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
    <Sheet title="New project" onClose={onClose}>
      <div className="props">
        <Section title="Project">
          <Field label="Name">
            <input className="txt wide" aria-label="Project name" value={name} onChange={(e) => setName(e.target.value)} onFocus={(e) => e.target.select()} />
          </Field>
        </Section>

        <Section title="Frame">
          <Field label="Device">
            <select className="txt wide" aria-label="Device preset" value={preset} onChange={(e) => pick(e.target.value)}>
              {DEVICE_PRESETS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.id !== 'custom' ? ` (${d.w} x ${d.h})` : ''}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid2">
            <Field label="Width">
              <Num label="Width" value={w} min={100} max={8000} suffix="W" onChange={(v) => { setW(Math.round(v)); setPreset('custom') }} />
            </Field>
            <Field label="Height">
              <Num label="Height" value={h} min={100} max={8000} suffix="H" onChange={(v) => { setH(Math.round(v)); setPreset('custom') }} />
            </Field>
          </div>
          <Field label="Orientation">
            <Seg
              label="Orientation"
              value={land ? 'l' : 'p'}
              onChange={(v) => setLand(v === 'l')}
              options={[
                { v: 'p', label: 'Portrait' },
                { v: 'l', label: 'Landscape' },
              ]}
            />
          </Field>
          <div className="field inline">
            <span className="flabel">Screens</span>
            <Stepper label="screens" value={count} min={1} max={12} onChange={setCount} />
          </div>
        </Section>

        <Section title="Background">
          <ColorField value={bg} onChange={setBg} swatches={['#FFFFFF', '#F5F5F5', '#171717', '#E5E5E5']} />
        </Section>

        <Section title="Start from">
          <div className="tplrow">
            <button className={'tpl' + (tpl === 'blank' ? ' on' : '')} aria-pressed={tpl === 'blank'} onClick={() => setTpl('blank')}>
              <span className="tpl-art blank" />
              Blank
            </button>
            <button className={'tpl' + (tpl === 'login' ? ' on' : '')} aria-pressed={tpl === 'login'} onClick={() => setTpl('login')}>
              <span className="tpl-art login">
                <i />
                <i />
                <i />
                <b />
              </span>
              Login screen
            </button>
          </div>
          <div className="field inline">
            <span className="flabel">Status and navigation bars</span>
            <Toggle label="Add status bar and navigation bar shapes" on={bars} onChange={setBars} />
          </div>
        </Section>

        {err && <div className="warn">{err}</div>}
        <button className="big primary" onClick={() => void create()}>
          Create project
        </button>
      </div>
    </Sheet>
  )
}
