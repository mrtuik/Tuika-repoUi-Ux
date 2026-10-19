import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Bookmark, Globe, ImagePlus, Shapes as ShapesIcon, Smile, Upload, Image as ImageIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEditor } from '../../state/editor'
import { useUI } from '../../state/ui'
import type { ElemPage } from '../../state/ui'
import { getPref, setPref } from '../../database/db'
import type { El } from '../../engine/types'
import { ICON_NAMES, Images, Library, LocalIcons, OnlineIcons, SearchBox, insertIcon, lucideSvg, toKebab, useDebounced } from './Assets'
import { Photos, PhotoTile, usePhotoSearch, usePick } from './PhotoSearch'
import { icons as lucideIcons } from 'lucide-react'
import { createElement } from 'react'

interface ShapeDef {
  id: string
  t: string
  svg: ReactNode
  add: () => void
}

const SH = {
  type: 'ellipse' as const,
}
const add = (type: El['type'], patch: Partial<El> = {}) => () => void useEditor.getState().addEl(type, patch)

const SHAPES: ShapeDef[] = [
  { id: 'rect', t: 'Rectangle', svg: <rect x="8" y="14" width="40" height="28" />, add: add('rect', { radius: 0 }) },
  { id: 'rounded', t: 'Rounded', svg: <rect x="8" y="14" width="40" height="28" rx="10" />, add: add('rect', { radius: 24 }) },
  { id: 'pill', t: 'Pill', svg: <rect x="6" y="18" width="44" height="20" rx="10" />, add: add('rect', { w: 180, h: 56, radius: 28 }) },
  { id: 'circle', t: 'Circle', svg: <circle cx="28" cy="28" r="20" />, add: add(SH.type, { w: 120, h: 120 }) },
  { id: 'ellipse', t: 'Ellipse', svg: <ellipse cx="28" cy="28" rx="22" ry="14" />, add: add(SH.type, { w: 180, h: 110 }) },
  { id: 'line', t: 'Line', svg: <rect x="6" y="26" width="44" height="4" rx="2" />, add: add('line') },
  {
    id: 'arrow',
    t: 'Arrow',
    svg: (
      <>
        <rect x="6" y="26" width="38" height="4" rx="2" />
        <path d="M36 17l14 11-14 11z" />
      </>
    ),
    add: add('arrow'),
  },
  {
    id: 'card',
    t: 'Card',
    svg: <rect x="7" y="12" width="42" height="32" rx="8" fill="none" stroke="currentColor" strokeWidth="3" />,
    add: add('rect', { w: 320, h: 160, radius: 20, fill: '#FFFFFF', strokeOn: true, stroke: '#E5E5E5', strokeWidth: 1, shadow: { enabled: true, x: 0, y: 8, blur: 24, color: '#000000', opacity: 0.16 } }),
  },
  { id: 'button', t: 'Button', svg: <rect x="6" y="19" width="44" height="18" rx="9" />, add: add('rect', { w: 200, h: 52, radius: 26 }) },
]

function ShapeTile({ s, onAdd }: { s: ShapeDef; onAdd: () => void }) {
  return (
    <button className="shp" aria-label={`Add ${s.t}`} onClick={onAdd}>
      <svg viewBox="0 0 56 56" width="56" height="56" fill="currentColor" aria-hidden>
        {s.svg}
      </svg>
      <span>{s.t}</span>
    </button>
  )
}

const CATS: { page: Exclude<ElemPage, 'home'>; t: string; I: typeof Smile }[] = [
  { page: 'shapes', t: 'Shapes', I: ShapesIcon },
  { page: 'icons', t: 'Icons', I: Smile },
  { page: 'photos', t: 'Photos', I: ImageIcon },
  { page: 'online', t: 'Online icons', I: Globe },
  { page: 'upload', t: 'Upload', I: Upload },
  { page: 'library', t: 'Library', I: Bookmark },
]
const TITLE: Record<ElemPage, string> = { home: 'Elements', shapes: 'Shapes', icons: 'Icons', photos: 'Photos', online: 'Online icons', upload: 'Upload', library: 'Library' }

export default function Elements() {
  const page = useUI((s) => s.elemPage)
  const setPage = useUI((s) => s.setElemPage)
  const [q, setQ] = useState('')
  const [shapeRecent, setShapeRecent] = useState<string[]>([])
  const [iconRecent, setIconRecent] = useState<string[]>([])

  useEffect(() => {
    void getPref<string[]>('shape-recent', []).then(setShapeRecent)
    void getPref<string[]>('icon-recent', []).then(setIconRecent)
  }, [page])

  const addShape = (s: ShapeDef) => {
    s.add()
    const r = [s.id, ...shapeRecent.filter((x) => x !== s.id)].slice(0, 8)
    setShapeRecent(r)
    void setPref('shape-recent', r)
  }
  const addIcon = (name: string) => {
    const svg = lucideSvg(name)
    if (!svg) return
    insertIcon(svg, name, '#171717', 48)
    const r = [name, ...iconRecent.filter((x) => x !== name)].slice(0, 16)
    setIconRecent(r)
    void setPref('icon-recent', r)
  }

  const dq = useDebounced(q, 150)
  const term = dq.trim().toLowerCase()
  const shapeHits = useMemo(() => (term ? SHAPES.filter((s) => s.t.toLowerCase().includes(term) || s.id.includes(term)) : []), [term])
  const iconHits = useMemo(() => {
    if (!term) return []
    const t = toKebab(term.replace(/\s+/g, '-'))
    return ICON_NAMES.filter((n) => toKebab(n).includes(t)).slice(0, 12)
  }, [term])
  const photos = usePhotoSearch(q, page === 'home' && q.trim().length >= 2)
  const { busy, pick } = usePick()

  const goPhotos = () => setPage('photos')

  if (page !== 'home') {
    return (
      <div className="assets">
        <div className="el-top">
          <button className="ic fill" aria-label="Back to Elements" onClick={() => setPage('home')}>
            <ArrowLeft size={18} />
          </button>
          <strong>{TITLE[page]}</strong>
        </div>
        {page === 'shapes' && (
          <div className="shape-grid">
            {SHAPES.map((s) => (
              <ShapeTile key={s.id} s={s} onAdd={() => addShape(s)} />
            ))}
          </div>
        )}
        {page === 'icons' && <LocalIcons />}
        {page === 'online' && <OnlineIcons />}
        {page === 'photos' && <Photos q={q} setQ={setQ} />}
        {page === 'upload' && <Images />}
        {page === 'library' && <Library />}
      </div>
    )
  }

  const recents = [
    ...shapeRecent.map((id) => SHAPES.find((s) => s.id === id)).filter(Boolean).map((s) => ({ k: 's:' + s!.id, node: <ShapeTile s={s!} onAdd={() => addShape(s!)} /> })),
    ...iconRecent.slice(0, 8).map((n) => ({
      k: 'i:' + n,
      node: (
        <button className="rec-icon" aria-label={`Add ${n}`} title={n} onClick={() => addIcon(n)}>
          {createElement((lucideIcons as any)[n] ?? ImagePlus, { size: 26 })}
        </button>
      ),
    })),
  ]

  return (
    <div className="assets">
      <SearchBox label="Search elements" placeholder="Search elements" value={q} onChange={setQ} />

      {!term ? (
        <>
          {recents.length > 0 && (
            <>
              <div className="el-h">Recently used</div>
              <div className="hrow">
                {recents.map((r) => (
                  <div key={r.k} className="hitem">
                    {r.node}
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="el-h">Browse categories</div>
          <div className="cat-grid">
            {CATS.map(({ page: p, t, I }) => (
              <button key={p} className="cat" onClick={() => setPage(p)}>
                <span className="cat-tile">
                  <I size={28} strokeWidth={1.6} />
                </span>
                <span>{t}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          {shapeHits.length > 0 && (
            <>
              <div className="el-h">Shapes</div>
              <div className="hrow">
                {shapeHits.map((s) => (
                  <div key={s.id} className="hitem">
                    <ShapeTile s={s} onAdd={() => addShape(s)} />
                  </div>
                ))}
              </div>
            </>
          )}
          {iconHits.length > 0 && (
            <>
              <div className="sec-row">
                <div className="el-h">Icons</div>
                <button className="linkbtn" onClick={() => setPage('icons')}>
                  See all
                </button>
              </div>
              <div className="icon-grid">
                {iconHits.map((n) => (
                  <div className="icell" key={n}>
                    <button className="icon-btn" aria-label={`Add ${n}`} title={n} onClick={() => addIcon(n)}>
                      {createElement((lucideIcons as any)[n], { size: 22 })}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="sec-row">
            <div className="el-h">Photos</div>
            <button className="linkbtn" onClick={goPhotos}>
              See all
            </button>
          </div>
          {photos.state === 'loading' && photos.items.length === 0 && <div className="empty small">Searching...</div>}
          {photos.state === 'error' && <div className="empty small">{photos.err}</div>}
          {photos.state === 'done' && photos.items.length === 0 && <div className="empty small">No photos found</div>}
          {term.length >= 2 && photos.items.length > 0 && (
            <div className="hrow photos">
              {photos.items.slice(0, 10).map((it) => (
                <div key={it.id} className="hitem">
                  <PhotoTile hit={it} busy={busy === it.id} onPick={() => void pick(it)} />
                </div>
              ))}
            </div>
          )}
          {shapeHits.length === 0 && iconHits.length === 0 && photos.state !== 'loading' && photos.items.length === 0 && photos.state !== 'error' && <div className="empty small">Nothing found for "{q}"</div>}
        </>
      )}
    </div>
  )
}
