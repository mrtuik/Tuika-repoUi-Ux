import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useEditor } from '../../state/editor'
import { useUI } from '../../state/ui'
import { getPref, setPref } from '../../database/db'
import { importPhoto, searchImages } from '../../services/imageSearch'
import type { GoogleCfg, ImgHit, Provider } from '../../services/imageSearch'
import { SearchBox, useDebounced } from './Assets'

export async function addPhoto(hit: ImgHit) {
  const img = await importPhoto(hit)
  const w = Math.min(240, img.w)
  const name = hit.credit ? `${img.name} (${hit.credit})`.slice(0, 80) : img.name
  useEditor.getState().addEl('image', { name, src: img.src, w, h: Math.round((img.h / img.w) * w) })
}

export function usePhotoSearch(q: string, enabled = true) {
  const [cfg, setCfg] = useState<GoogleCfg | null | undefined>(undefined)
  const [items, setItems] = useState<ImgHit[]>([])
  const [page, setPage] = useState(1)
  const [more, setMore] = useState(false)
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle')
  const [err, setErr] = useState('')
  const [provider, setProvider] = useState<Provider | null>(null)
  const [tick, setTick] = useState(0)
  const dq = useDebounced(q, 500)
  const ctl = useRef<AbortController | null>(null)

  useEffect(() => {
    void getPref<GoogleCfg | null>('google-img-cfg', null).then((c) => setCfg(c && c.key && c.cx ? c : null))
  }, [])

  const run = (p: number, append: boolean) => {
    ctl.current?.abort()
    const c = new AbortController()
    ctl.current = c
    setState('loading')
    searchImages(dq, p, cfg ?? null, c.signal)
      .then((r) => {
        setItems((prev) => (append ? [...prev, ...r.items.filter((i) => !prev.some((x) => x.id === i.id))] : r.items))
        setMore(r.more)
        setProvider(r.provider)
        setPage(p)
        setState('done')
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return
        setErr(navigator.onLine ? String(e?.message ?? e) : 'You are offline.')
        setState('error')
      })
  }

  useEffect(() => {
    if (!enabled || cfg === undefined) return
    const term = dq.trim()
    if (term.length < 2) {
      ctl.current?.abort()
      setItems([])
      setState('idle')
      return
    }
    run(1, false)
    return () => ctl.current?.abort()
  }, [dq, cfg, tick, enabled])

  return { cfg, setCfg, items, more, state, err, provider, retry: () => setTick((t) => t + 1), loadMore: () => run(page + 1, true) }
}

export function PhotoTile({ hit, busy, onPick }: { hit: ImgHit; busy: boolean; onPick: () => void }) {
  return (
    <button className="ptile" aria-label={`Add photo: ${hit.title}`} onClick={onPick} disabled={busy}>
      <img alt="" loading="lazy" referrerPolicy="no-referrer" src={hit.thumb} />
      {busy && (
        <span className="ptile-busy">
          <Loader2 size={20} className="spin" />
        </span>
      )}
    </button>
  )
}

export function usePick() {
  const [busy, setBusy] = useState<string | null>(null)
  const pick = async (hit: ImgHit) => {
    if (busy) return
    setBusy(hit.id)
    try {
      await addPhoto(hit)
    } catch (e: any) {
      useUI.getState().say(e?.message ?? 'Could not add photo')
    } finally {
      setBusy(null)
    }
  }
  return { busy, pick }
}

function GoogleSetup({ cfg, setCfg }: { cfg: GoogleCfg | null | undefined; setCfg: (c: GoogleCfg | null) => void }) {
  const [key, setKey] = useState(cfg?.key ?? '')
  const [cx, setCx] = useState(cfg?.cx ?? '')
  const save = () => {
    const c = key.trim() && cx.trim() ? { key: key.trim(), cx: cx.trim() } : null
    setCfg(c)
    void setPref('google-img-cfg', c)
    useUI.getState().say(c ? 'Google image search is on' : 'Google image search turned off')
  }
  return (
    <details className="gsetup">
      <summary>{cfg ? 'Google image search is on' : 'Use Google image search'}</summary>
      <p className="hint flush">
        Google needs your own free key (100 searches a day). In Google Cloud turn on "Custom Search API" and create an API key, then create a Programmable Search Engine with image search on and "Search the entire web", and paste its Search engine ID here. Without a key, photos come from Openverse (free-license photos).
      </p>
      <input className="txt wide" aria-label="Google API key" placeholder="API key" value={key} onChange={(e) => setKey(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      <input className="txt wide" aria-label="Search engine ID" placeholder="Search engine ID (cx)" value={cx} onChange={(e) => setCx(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      <div className="btnrow">
        <button className="mini" onClick={save}>
          Save
        </button>
        {cfg && (
          <button
            className="mini"
            onClick={() => {
              setKey('')
              setCx('')
              setCfg(null)
              void setPref('google-img-cfg', null)
            }}
          >
            Remove key
          </button>
        )}
      </div>
    </details>
  )
}

export function Photos({ q, setQ }: { q: string; setQ: (v: string) => void }) {
  const s = usePhotoSearch(q)
  const { busy, pick } = usePick()
  return (
    <>
      <SearchBox label="Search photos" placeholder="Search photos on the web" value={q} onChange={setQ} />
      {q.trim().length < 2 && (
        <>
          <div className="group-label">Try searching</div>
          <div className="chips wrap">
            {['mountain', 'coffee', 'office', 'food', 'nature', 'city', 'texture', 'portrait', 'abstract'].map((t) => (
              <button key={t} className="pill" onClick={() => setQ(t)}>
                {t}
              </button>
            ))}
          </div>
        </>
      )}
      {s.state === 'loading' && s.items.length === 0 && (
        <div className="empty small">
          <Loader2 size={18} className="spin" /> Searching...
        </div>
      )}
      {s.state === 'error' && (
        <div className="warn">
          {s.err}{' '}
          <button className="mini" onClick={s.retry}>
            Retry
          </button>
        </div>
      )}
      {s.state === 'done' && s.items.length === 0 && <div className="empty small">No photos found for "{q}"</div>}
      <div className="photo-grid">
        {s.items.map((it) => (
          <PhotoTile key={it.id} hit={it} busy={busy === it.id} onPick={() => void pick(it)} />
        ))}
      </div>
      {s.more && (
        <button className="big" disabled={s.state === 'loading'} onClick={s.loadMore}>
          {s.state === 'loading' ? 'Loading...' : 'Load more'}
        </button>
      )}
      <GoogleSetup cfg={s.cfg} setCfg={s.setCfg} />
      <div className="hint">
        {s.provider === 'google'
          ? 'Results from Google Images. Tapping a photo downloads it into your project. Check the source site\'s license before publishing.'
          : 'Results from Openverse (openly licensed photos). The creator is saved in the layer name. Some licenses need credit.'}
      </div>
    </>
  )
}
