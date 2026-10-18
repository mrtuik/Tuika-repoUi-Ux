import { useEffect, useMemo, useRef, useState } from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { icons as lucideIcons } from 'lucide-react'
import { Heart, ImagePlus, ScanLine } from 'lucide-react'
import { useEditor } from '../../state/editor'
import { useUI } from '../../state/ui'
import { getPref, setPref } from '../../database/db'
import { uid } from '../../engine/doc'
import { pickFile, readImage } from '../../services/files'
import { sanitizeSvg } from '../../services/svg'

type Tab = 'icons' | 'online' | 'library' | 'images'
const ICON_NAMES = Object.keys(lucideIcons)

const toKebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

function lucideSvg(name: string): string | null {
  const C = (lucideIcons as any)[name]
  if (!C) return null
  const markup = renderToStaticMarkup(createElement(C, { size: 256, color: 'currentColor', strokeWidth: 2 }))
  return sanitizeSvg(markup)
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
  const [tab, setTab] = useState<Tab>('icons')
  return (
    <div className="assets">
      <div className="artboard-tabs" role="tablist">
        {(['icons', 'online', 'library', 'images'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={'chip' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>
            {t === 'icons' ? 'Icons' : t === 'online' ? 'Online' : t === 'library' ? 'Library' : 'Images'}
          </button>
        ))}
      </div>
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
  return (
    <div className="layer-tools">
      <label className="inline">
        Color <input type="color" aria-label="Icon color" value={color} onChange={(e) => setColor(e.target.value)} />
      </label>
      <label className="inline">
        Size <input className="txt small" inputMode="numeric" aria-label="Icon size" value={size} onChange={(e) => setSize(Math.max(8, Math.min(512, Number(e.target.value) || 48)))} />
      </label>
    </div>
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

  return (
    <>
      <div className="layer-tools">
        <input className="txt" aria-label="Search icons" placeholder={`Search ${ICON_NAMES.length} icons (works offline)`} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={'mini' + (onlyFav ? ' on' : '')} aria-pressed={onlyFav} onClick={() => setOnlyFav(!onlyFav)}>
          Favorites
        </button>
      </div>
      <IconOptions color={color} setColor={setColor} size={size} setSize={setSize} />
      {recent.length > 0 && !q && !onlyFav && (
        <div className="recent">
          <div className="hint">Recent</div>
          <div className="icon-grid">
            {recent.slice(0, 8).map((n) => (
              <IconCell key={n} name={n} fav={favs.includes(n)} onUse={() => use(n)} onFav={() => fav(n)} onLib={() => lucideSvg(n) && addToLibrary(n, lucideSvg(n)!, 'Lucide')} />
            ))}
          </div>
        </div>
      )}
      <div className="icon-grid">
        {results.map((n) => (
          <IconCell key={n} name={n} fav={favs.includes(n)} onUse={() => use(n)} onFav={() => fav(n)} onLib={() => lucideSvg(n) && addToLibrary(n, lucideSvg(n)!, 'Lucide')} />
        ))}
      </div>
      {results.length === 0 && <div className="empty small">No icons match "{q}"</div>}
      <div className="hint">Lucide icons, ISC license. Tap to insert. Heart = favorite, + = save to project library.</div>
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
          <Heart size={11} fill={fav ? 'currentColor' : 'none'} />
        </button>
        <button aria-label={`Save ${name} to library`} onClick={onLib}>
          +
        </button>
      </div>
    </div>
  )
}

// ---- Online: Iconify public API (documented, CORS enabled). Results are discovery links; license varies per icon set. ----
interface Remote {
  id: string // prefix:name
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
  const dq = useDebounced(q, 400)
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
        const list: Remote[] = (j.icons ?? []).filter((i: unknown) => typeof i === 'string' && /^[a-z0-9-]+:[a-z0-9-]+$/i.test(i as string)).map((i: string) => {
          const [prefix, name] = i.split(':')
          return { id: i, prefix, name }
        })
        setItems(list)
        setState('done')
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return
        setErr(navigator.onLine ? String(e.message ?? e) : 'You are offline. Built-in icons still work.')
        setState('error')
      })
    return () => c.abort()
  }, [dq, tick])

  const importIcon = async (it: Remote, add: 'insert' | 'library') => {
    try {
      const r = await fetch(`https://api.iconify.design/${it.prefix}/${it.name}.svg`)
      if (!r.ok) throw new Error('Download failed')
      const text = await r.text()
      const svg = sanitizeSvg(text)
      if (!svg) throw new Error('Icon file was rejected (invalid or unsafe SVG)')
      if (add === 'insert') insertIcon(svg, it.name, color, size)
      addToLibrary(it.name, svg, `Iconify:${it.prefix}`)
    } catch (e: any) {
      useUI.getState().say(e?.message ?? 'Import failed')
    }
  }

  return (
    <>
      <div className="layer-tools">
        <input className="txt" aria-label="Search online icons" placeholder="Search online (Iconify)" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <IconOptions color={color} setColor={setColor} size={size} setSize={setSize} />
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
            <button className="icon-btn" aria-label={`Insert ${it.name} from ${it.prefix}`} title={`${it.id} (SVG)`} onClick={() => void importIcon(it, 'insert')}>
              <img alt={it.name} width={24} height={24} loading="lazy" src={`https://api.iconify.design/${it.prefix}/${it.name}.svg`} />
            </button>
            <div className="icell-actions single">{it.prefix}</div>
          </div>
        ))}
      </div>
      <div className="hint">Source: api.iconify.design. Your search text is sent to that service. Licenses differ per icon set (shown under each icon as the set id): check the set's license before shipping a design.</div>
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
      {doc.assets.length === 0 && <div className="empty small">Project library is empty. Save icons or images here to reuse them.</div>}
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
            <div className="icell-actions single">
              <button aria-label={`Remove ${a.name} from library`} onClick={() => useEditor.getState().commit((d) => void (d.assets = d.assets.filter((x) => x.id !== a.id)))}>
                x
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
        // Screenshot reference: new artboard that matches the screenshot's aspect ratio, original kept as a LOCKED layer.
        const w = 360
        const h = Math.round((img.h / img.w) * w)
        const id = st.addArtboard(`${img.name} (trace)`, w, h)
        if (id) {
          st.addEl('image', { name: 'Reference (locked)', src: img.src, x: 0, y: 0, w, h, locked: true, opacity: 0.6 }, id)
          st.select(id, [])
          say('Reference added and locked. Trace it with shapes and text; hide it from Layers when done.')
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
        <ScanLine size={18} /> Import screenshot as trace reference
      </button>
      <div className="hint">
        Screenshot import is a manual tracing workflow: the screenshot goes on a locked layer at its original aspect ratio and you rebuild it with editable shapes, text and icons. Automatic text/UI detection (OCR) is not included in this build.
      </div>
    </div>
  )
}

