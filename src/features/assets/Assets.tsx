import { useEffect, useMemo, useRef, useState } from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { icons as lucideIcons, Clock, Heart, ImagePlus, ScanLine, Search, Plus, Trash2, X } from 'lucide-react'
import { useEditor } from '../../state/editor'
import { useUI } from '../../state/ui'
import type { AssetTab } from '../../state/ui'
import { getPref, setPref } from '../../database/db'
import { uid } from '../../engine/doc'
import { pickFile, readImage } from '../../services/files'
import { sanitizeSvg } from '../../services/svg'
import { ColorField, Seg } from '../inspector/controls'

const ICON_NAMES = Object.keys(lucideIcons)
const toKebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

function lucideSvg(name: string): string | null {
  const C = (lucideIcons as any)[name]
  if (!C) return null
  return sanitizeSvg(renderToStaticMarkup(createElement(C, { size: 256, color: 'currentColor', strokeWidth: 2 })))
}

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v)
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms)
    return () => clearTimeout(t)
  }, [v, ms])
  return d
}

export default function Assets() {
  const tab = useUI((s) => s.assetTab)
  const setTab = useUI((s) => s.setAssetTab)
  return (
    <div className="assets">
      <Seg<AssetTab>
        label="Asset source"
        value={tab}
        onChange={setTab}
        options={[
          { v: 'icons', label: 'Icons' },
          { v: 'online', label: 'Online' },
          { v: 'library', label: 'Library' },
          { v: 'images', label: 'Images' },
        ]}
      />
      {tab === 'icons' && <LocalIcons />}
      {tab === 'online' && <OnlineIcons />}
      {tab === 'library' && <Library />}
      {tab === 'images' && <Images />}
    </div>
  )
}

function insertIcon(svg: string, name: string, color: string, size: number) {
  useEditor.getState().addEl('icon', { name, svg, fill: color, w: size, h: size })
  useUI.getState().say(`${name} added`)
}

function addToLibrary(name: string, svg: string, source: string) {
  useEditor.getState().commit((d) => {
    if (!d.assets.some((a) => a.svg === svg)) d.assets.push({ id: uid(), name, kind: 'icon', svg, source })
  })
  useUI.getState().say('Saved to project library')
}

function IconOptions({ color, setColor, size, setSize }: { color: string; setColor: (c: string) => void; size: number; setSize: (n: number) => void }) {
  const palette = useEditor((s) => s.doc?.palette ?? [])
  return (
    <div className="icon-opts">
      <ColorField value={color} onChange={setColor} swatches={palette} />
      <div className="chips" role="group" aria-label="Icon size">
        {[24, 32, 48, 64, 96].map((n) => (
          <button key={n} className={'chipbtn' + (size === n ? ' on' : '')} aria-pressed={size === n} onClick={() => setSize(n)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

function SearchBox({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <label className="search card">
      <Search size={18} />
      <input aria-label={label} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      {value && (
        <button className="clearx" aria-label="Clear search" onClick={(e) => { e.preventDefault(); onChange('') }}>
          <X size={14} />
        </button>
      )}
    </label>
  )
}

function LocalIcons() {
  const [q, setQ] = useState('')
  const [color, setColor] = useState('#171717')
  const [size, setSize] = useState(48)
  const [favs, setFavs] = useState<string[]>([])
  const [recent, setRecent] = useState<string[]>([])
  const [onlyFav, setOnlyFav] = useState(false)
  useEffect(() => {
    void getPref<string[]>('icon-favs', []).then(setFavs)
    void getPref<string[]>('icon-recent', []).then(setRecent)
  }, [])
  const dq = useDebounced(q, 120)
  const results = useMemo(() => {
    const t = toKebab(dq.trim().replace(/\s+/g, '-'))
    let all = ICON_NAMES
    if (onlyFav) all = all.filter((n) => favs.includes(n))
    if (!t) return all.slice(0, 90)
    return all.filter((n) => toKebab(n).includes(t)).slice(0, 120)
  }, [dq, onlyFav, favs])

  const use = (name: string) => {
    const svg = lucideSvg(name)
    if (!svg) return
    insertIcon(svg, name, color, size)
    const r = [name, ...recent.filter((x) => x !== name)].slice(0, 16)
    setRecent(r)
    void setPref('icon-recent', r)
  }
  const fav = (name: string) => {
    const f = favs.includes(name) ? favs.filter((x) => x !== name) : [...favs, name]
    setFavs(f)
    void setPref('icon-favs', f)
  }
  const lib = (n: string) => {
    const s = lucideSvg(n)
    if (s) addToLibrary(n, s, 'Lucide')
  }

  return (
    <>
      <div className="searchbar">
        <SearchBox label="Search icons" placeholder={`Search ${ICON_NAMES.length} icons`} value={q} onChange={setQ} />
        <button className={'ic sq' + (onlyFav ? ' on' : '')} aria-label="Show favorites only" aria-pressed={onlyFav} onClick={() => setOnlyFav(!onlyFav)}>
          <Heart size={16} fill={onlyFav ? 'currentColor' : 'none'} />
        </button>
      </div>
      <IconOptions color={color} setColor={setColor} size={size} setSize={setSize} />
      {recent.length > 0 && !q && !onlyFav && (
        <>
          <div className="sec-row">
            <div className="group-label">Recent</div>
            <button className="linkbtn" onClick={() => { setRecent([]); void setPref('icon-recent', []) }}>
              Clear all
            </button>
          </div>
          <div className="icon-grid">
            {recent.slice(0, 8).map((n) => (
              <IconCell key={n} name={n} fav={favs.includes(n)} onUse={() => use(n)} onFav={() => fav(n)} onLib={() => lib(n)} />
            ))}
          </div>
        </>
      )}
      <div className="group-label">{q ? `Results for "${q}"` : onlyFav ? 'Favorites' : 'All icons'}</div>
      <div className="icon-grid">
        {results.map((n) => (
          <IconCell key={n} name={n} fav={favs.includes(n)} onUse={() => use(n)} onFav={() => fav(n)} onLib={() => lib(n)} />
        ))}
      </div>
      {results.length === 0 && <div className="empty small">No icons match "{q}"</div>}
      <div className="hint">Lucide icons (ISC license). Works offline. Tap to insert.</div>
    </>
  )
}

function IconCell({ name, fav, onUse, onFav, onLib }: { name: string; fav: boolean; onUse: () => void; onFav: () => void; onLib: () => void }) {
  const C = (lucideIcons as any)[name]
  return (
    <div className="icell">
      <button className="icon-btn" aria-label={`Insert ${name}`} title={name} onClick={onUse}>
        {C && createElement(C, { size: 22 })}
      </button>
      <div className="icell-actions">
        <button aria-label={fav ? `Unfavorite ${name}` : `Favorite ${name}`} aria-pressed={fav} onClick={onFav}>
          <Heart size={12} fill={fav ? 'currentColor' : 'none'} />
        </button>
        <button aria-label={`Save ${name} to library`} onClick={onLib}>
          <Plus size={12} />
        </button>
      </div>
    </div>
  )
}

// Online: Iconify public API (documented, CORS enabled). Licenses differ per icon set.
interface Remote {
  id: string
  prefix: string
  name: string
}

function OnlineIcons() {
  const [q, setQ] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle')
  const [err, setErr] = useState('')
  const [items, setItems] = useState<Remote[]>([])
  const [color, setColor] = useState('#171717')
  const [size, setSize] = useState(48)
  const [tick, setTick] = useState(0)
  const [terms, setTerms] = useState<string[]>([])
  const dq = useDebounced(q, 400)
  useEffect(() => {
    void getPref<string[]>('online-recent', []).then(setTerms)
  }, [])
  const saveTerms = (t: string[]) => {
    setTerms(t)
    void setPref('online-recent', t)
  }
  const ctl = useRef<AbortController | null>(null)

  useEffect(() => {
    ctl.current?.abort()
    const term = dq.trim()
    if (term.length < 2) {
      setState('idle')
      setItems([])
      return
    }
    const c = new AbortController()
    ctl.current = c
    setState('loading')
    fetch(`https://api.iconify.design/search?query=${encodeURIComponent(term)}&limit=48`, { signal: c.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Search failed (${r.status})`)
        return r.json()
      })
      .then((j) => {
        const list: Remote[] = (j.icons ?? [])
          .filter((i: unknown) => typeof i === 'string' && /^[a-z0-9-]+:[a-z0-9-]+$/i.test(i as string))
          .map((i: string) => {
            const [prefix, name] = i.split(':')
            return { id: i, prefix, name }
          })
        setItems(list)
        setState('done')
        if (list.length > 0) {
          const t = term.toLowerCase()
          setTerms((prev) => {
            const next = [t, ...prev.filter((x) => x !== t)].slice(0, 8)
            void setPref('online-recent', next)
            return next
          })
        }
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return
        setErr(navigator.onLine ? String(e.message ?? e) : 'You are offline. Built-in icons still work.')
        setState('error')
      })
    return () => c.abort()
  }, [dq, tick])

  const importIcon = async (it: Remote) => {
    try {
      const r = await fetch(`https://api.iconify.design/${it.prefix}/${it.name}.svg`)
      if (!r.ok) throw new Error('Download failed')
      const svg = sanitizeSvg(await r.text())
      if (!svg) throw new Error('Icon file was rejected (invalid or unsafe SVG)')
      insertIcon(svg, it.name, color, size)
      addToLibrary(it.name, svg, `Iconify:${it.prefix}`)
    } catch (e: any) {
      useUI.getState().say(e?.message ?? 'Import failed')
    }
  }

  return (
    <>
      <SearchBox label="Search online icons" placeholder="Search online icons" value={q} onChange={setQ} />
      <IconOptions color={color} setColor={setColor} size={size} setSize={setSize} />
      {q.trim() === '' && (
        <>
          <div className="sec-row">
            <div className="group-label">Recent searches</div>
            {terms.length > 0 && (
              <button className="linkbtn" onClick={() => saveTerms([])}>
                Clear all
              </button>
            )}
          </div>
          {terms.length === 0 && <div className="empty small">Nothing yet. Search for an icon below or pick a suggestion.</div>}
          <div className="rlist">
            {terms.map((t) => (
              <div className="rrow" key={t}>
                <button className="rmain" onClick={() => setQ(t)}>
                  <span className="rtile">
                    <Clock size={18} />
                  </span>
                  <span className="rtext">
                    <strong>{t}</strong>
                    <small>Search icons online</small>
                  </span>
                </button>
                <button className="ic small" aria-label={`Remove ${t}`} onClick={() => saveTerms(terms.filter((x) => x !== t))}>
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="group-label">Suggestions</div>
          <div className="chips wrap">
            {['arrow', 'user', 'home', 'settings', 'cart', 'heart', 'bell', 'camera', 'search'].map((t) => (
              <button key={t} className="pill" onClick={() => setQ(t)}>
                {t}
              </button>
            ))}
          </div>
        </>
      )}
      {q.trim() !== '' && state === 'idle' && <div className="empty small">Type at least 2 letters to search the web.</div>}
      {state === 'loading' && <div className="empty small">Searching...</div>}
      {state === 'error' && (
        <div className="warn">
          {err}{' '}
          <button className="mini" onClick={() => setTick(tick + 1)}>
            Retry
          </button>
        </div>
      )}
      {state === 'done' && items.length === 0 && <div className="empty small">No results for "{dq}"</div>}
      <div className="icon-grid online">
        {items.map((it) => (
          <div className="icell" key={it.id}>
            <button className="icon-btn" aria-label={`Insert ${it.name} from ${it.prefix}`} title={`${it.id} (SVG)`} onClick={() => void importIcon(it)}>
              <img alt={it.name} width={24} height={24} loading="lazy" src={`https://api.iconify.design/${it.prefix}/${it.name}.svg`} />
            </button>
            <div className="icell-actions single">{it.prefix}</div>
          </div>
        ))}
      </div>
      <div className="hint">Source: api.iconify.design. Only your search text is sent. Licenses differ per icon set (set id shown under each icon): check before shipping.</div>
    </>
  )
}

function Library() {
  const doc = useEditor((s) => s.doc)!
  const [color, setColor] = useState('#171717')
  const [size, setSize] = useState(48)
  return (
    <>
      <IconOptions color={color} setColor={setColor} size={size} setSize={setSize} />
      {doc.assets.length === 0 && <div className="empty small">Your project library is empty. Save icons here to reuse them.</div>}
      <div className="icon-grid">
        {doc.assets.map((a) => (
          <div className="icell" key={a.id}>
            <button
              className="icon-btn"
              aria-label={`Insert ${a.name}`}
              title={a.name}
              onClick={() => (a.kind === 'icon' && a.svg ? insertIcon(a.svg, a.name, color, size) : a.src && useEditor.getState().addEl('image', { name: a.name, src: a.src, w: 160, h: 160 }))}
            >
              {a.kind === 'icon' && a.svg ? <img alt="" width={24} height={24} src={'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(a.svg.replace(/currentColor/g, '#171717'))} /> : <img alt="" width={24} height={24} src={a.src} />}
            </button>
            <div className="icell-actions">
              <button aria-label={`Remove ${a.name} from library`} onClick={() => useEditor.getState().commit((d) => void (d.assets = d.assets.filter((x) => x.id !== a.id)))}>
                <X size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function Images() {
  const [busy, setBusy] = useState(false)
  const say = useUI.getState().say
  const addImage = async (reference: boolean) => {
    const f = await pickFile('image/png,image/jpeg,image/webp,image/gif')
    if (!f) return
    setBusy(true)
    try {
      const img = await readImage(f)
      const st = useEditor.getState()
      if (reference) {
        const w = 360
        const h = Math.round((img.h / img.w) * w)
        const id = st.addArtboard(`${img.name} (trace)`, w, h)
        if (id) {
          st.addEl('image', { name: 'Reference (locked)', src: img.src, x: 0, y: 0, w, h, locked: true, opacity: 0.6 }, id)
          st.select(id, [])
          say('Reference added and locked. Trace it with shapes and text.')
        }
      } else {
        const w = Math.min(240, img.w)
        st.addEl('image', { name: img.name, src: img.src, w, h: Math.round((img.h / img.w) * w) })
      }
    } catch (e: any) {
      say(e?.message ?? 'Could not import image')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="stack-col">
      <button className="big" disabled={busy} onClick={() => void addImage(false)}>
        <ImagePlus size={18} /> Add image from device
      </button>
      <button className="big" disabled={busy} onClick={() => void addImage(true)}>
        <ScanLine size={18} /> Screenshot as trace reference
      </button>
      <div className="hint">The screenshot goes on a locked layer at its original ratio. Rebuild it with editable shapes, text and icons. Automatic detection (OCR) is not included.</div>
    </div>
  )
}
