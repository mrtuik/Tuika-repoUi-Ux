/**
 * Web photo search.
 *  - Google: Programmable Search "searchType=image" (needs a free API key + search engine id, 100 queries/day free).
 *  - Fallback without any key: Openverse (openly licensed photos, no key needed).
 * In the Android app CapacitorHttp is enabled, so fetch() goes through the native stack and is not blocked by CORS
 * (needed to download images from arbitrary sites). In a plain browser some hosts will refuse; we fall back to the thumbnail.
 */
import { readImage } from './files'

export interface ImgHit {
  id: string
  thumb: string
  full: string
  title: string
  w?: number
  h?: number
  credit?: string
}
export interface GoogleCfg {
  key: string
  cx: string
}
export type Provider = 'google' | 'openverse'
export interface SearchPage {
  items: ImgHit[]
  more: boolean
  provider: Provider
}

const PER_PAGE_G = 10
const PER_PAGE_O = 24

export async function searchImages(q: string, page: number, cfg: GoogleCfg | null, signal?: AbortSignal): Promise<SearchPage> {
  const term = q.trim()
  if (cfg?.key && cfg?.cx) {
    const start = (page - 1) * PER_PAGE_G + 1
    if (start > 91) return { items: [], more: false, provider: 'google' }
    const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(cfg.key)}&cx=${encodeURIComponent(cfg.cx)}&q=${encodeURIComponent(term)}&searchType=image&num=${PER_PAGE_G}&start=${start}&safe=active`
    const r = await fetch(url, { signal })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j?.error?.message ? `Google: ${j.error.message}` : `Google search failed (${r.status})`)
    const items: ImgHit[] = (j.items ?? [])
      .filter((i: any) => typeof i?.link === 'string' && /^https?:/i.test(i.link))
      .map((i: any, n: number) => ({
        id: `g${start + n}:${i.link}`,
        thumb: i.image?.thumbnailLink || i.link,
        full: i.link,
        title: String(i.title ?? 'Photo'),
        w: i.image?.width,
        h: i.image?.height,
        credit: i.displayLink,
      }))
    return { items, more: items.length === PER_PAGE_G && start + PER_PAGE_G <= 91, provider: 'google' }
  }
  const r = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(term)}&page=${page}&page_size=${PER_PAGE_O}&mature=false`, { signal })
  if (!r.ok) throw new Error(r.status === 429 ? 'Too many searches right now. Try again in a minute.' : `Search failed (${r.status})`)
  const j: any = await r.json()
  const items: ImgHit[] = (j.results ?? []).map((i: any) => ({
    id: `o:${i.id}`,
    thumb: i.thumbnail || i.url,
    full: i.url,
    title: String(i.title || 'Photo'),
    w: i.width,
    h: i.height,
    credit: [i.creator, i.license ? `CC ${String(i.license).toUpperCase()}` : ''].filter(Boolean).join(' - '),
  }))
  return { items, more: page < (j.page_count ?? 1), provider: 'openverse' }
}

async function fetchBlob(url: string, ms: number): Promise<Blob> {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), ms)
  try {
    const r = await fetch(url, { signal: c.signal })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const b = await r.blob()
    if (b.size < 200) throw new Error('Empty image')
    return b
  } finally {
    clearTimeout(t)
  }
}

/** Downloads the photo (full size first, then the thumbnail) and returns it embedded in the project. */
export async function importPhoto(hit: ImgHit): Promise<{ src: string; w: number; h: number; name: string }> {
  let blob: Blob | null = null
  for (const [url, ms] of [[hit.full, 15000], [hit.thumb, 10000]] as [string, number][]) {
    try {
      blob = await fetchBlob(url, ms)
      break
    } catch {
      /* try next */
    }
  }
  if (!blob) throw new Error(navigator.onLine ? 'This site blocked the download. Try another photo.' : 'You are offline.')
  const type = /^image\/(png|jpeg|webp|gif)$/.test(blob.type) ? blob.type : 'image/jpeg'
  const file = new File([blob], 'photo', { type })
  const img = await readImage(file)
  return { ...img, name: hit.title.slice(0, 40) }
}
