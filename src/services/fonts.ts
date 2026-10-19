/**
 * Google Fonts on demand. The stylesheet comes from fonts.googleapis.com (the browser then downloads only the glyph
 * subsets a text needs, e.g. the Bengali subset), the CSS is cached in IndexedDB so a known font still resolves offline
 * as long as the WebView's HTTP cache has the font files. No API key needed.
 */
import { getPref, setPref } from '../database/db'

export type FontCat = 'sans' | 'serif' | 'display' | 'hand' | 'mono' | 'bn' | 'intl'
export interface GFont {
  name: string
  cat: FontCat
}

const L = (cat: FontCat, names: string): GFont[] => names.split('|').map((name) => ({ name, cat }))

export const GOOGLE_FONTS: GFont[] = [
  ...L('bn', 'Hind Siliguri|Noto Sans Bengali|Noto Serif Bengali|Anek Bangla|Baloo Da 2|Tiro Bangla|Galada|Atma|Mina'),
  ...L(
    'sans',
    'Roboto|Open Sans|Montserrat|Lato|Poppins|Inter|Raleway|Nunito|Nunito Sans|Rubik|Ubuntu|Work Sans|DM Sans|Manrope|Space Grotesk|Quicksand|Mulish|Karla|Barlow|Barlow Condensed|Josefin Sans|Fira Sans|PT Sans|Noto Sans|Source Sans 3|Cabin|Archivo|Heebo|Hind|Kanit|Prompt|Sarabun|Mukta|Titillium Web|Exo 2|Outfit|Sora|Lexend|Plus Jakarta Sans|Urbanist|Figtree|Epilogue|Jost|Red Hat Display|IBM Plex Sans|Oxygen|Asap|Catamaran|Overpass|Questrial|Signika|Assistant|Maven Pro|Varela Round|Public Sans|Be Vietnam Pro|Albert Sans|Onest|Geologica|Instrument Sans|Bricolage Grotesque|Inter Tight|Roboto Condensed|Noto Sans Display',
  ),
  ...L(
    'serif',
    'Playfair Display|Merriweather|Lora|Libre Baskerville|Crimson Text|EB Garamond|Cormorant Garamond|PT Serif|Noto Serif|Source Serif 4|Bitter|Arvo|Zilla Slab|Spectral|DM Serif Display|DM Serif Text|Cinzel|Frank Ruhl Libre|Vollkorn|Gelasio|Libre Caslon Text|Roboto Slab|Old Standard TT|Prata|Domine',
  ),
  ...L(
    'display',
    'Bebas Neue|Anton|Oswald|Lobster|Righteous|Abril Fatface|Fredoka|Baloo 2|Bangers|Orbitron|Press Start 2P|Syne|Alfa Slab One|Archivo Black|Black Ops One|Monoton|Staatliches|Passion One|Russo One|Chango|Titan One|Lilita One|Rubik Mono One|Fugaz One|Unbounded|Big Shoulders Display',
  ),
  ...L('hand', 'Pacifico|Dancing Script|Caveat|Satisfy|Permanent Marker|Shadows Into Light|Indie Flower|Great Vibes|Sacramento|Kaushan Script|Amatic SC|Patrick Hand|Courgette|Yellowtail|Handlee|Gloria Hallelujah|Rock Salt|Reenie Beanie|Homemade Apple'),
  ...L('mono', 'JetBrains Mono|Roboto Mono|Space Mono|Fira Code|Source Code Pro|Inconsolata|IBM Plex Mono|DM Mono|Ubuntu Mono|Courier Prime'),
  ...L('intl', 'Noto Sans Devanagari|Noto Sans Arabic|Cairo|Tajawal|Noto Sans JP|Noto Sans KR|Noto Sans SC|Noto Sans Thai|Noto Sans Tamil'),
]

export const CAT_LABEL: Record<FontCat, string> = { sans: 'Sans', serif: 'Serif', display: 'Display', hand: 'Handwriting', mono: 'Mono', bn: 'Bangla', intl: 'Other scripts' }

/** Bundled with the app, no network needed. */
export const BUNDLED = new Set(['Inter', 'Poppins', 'Playfair Display', 'JetBrains Mono'])
const GENERIC = new Set(['system-ui', 'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'])

export function primaryFamily(ff?: string): string {
  const first = (ff ?? '').split(',')[0]?.trim().replace(/^['"]|['"]$/g, '') ?? ''
  return first || 'Inter'
}

export function familyValue(name: string): string {
  const cat = GOOGLE_FONTS.find((f) => f.name === name)?.cat
  const tail = cat === 'serif' ? 'serif' : cat === 'mono' ? 'monospace' : cat === 'hand' ? 'cursive' : 'system-ui, sans-serif'
  return `'${name}', ${tail}`
}

const ready = new Map<string, Promise<boolean>>()
const done = new Set<string>(BUNDLED)
export const isLoaded = (name: string) => done.has(name)

async function fetchCss(name: string): Promise<string> {
  const fam = encodeURIComponent(name).replace(/%20/g, '+')
  // not every family has every weight: ask for the most, then fewer, then the default
  for (const q of [':wght@300;400;500;600;700;800', ':wght@400;700', '']) {
    const c = new AbortController()
    const t = setTimeout(() => c.abort(), 9000)
    try {
      const r = await fetch(`https://fonts.googleapis.com/css2?family=${fam}${q}&display=swap`, { signal: c.signal })
      if (r.ok) {
        const css = await r.text()
        if (css.includes('@font-face')) return css
      }
    } catch {
      /* try next */
    } finally {
      clearTimeout(t)
    }
  }
  throw new Error('font unavailable')
}

function injectCss(name: string, css: string) {
  if (document.querySelector(`style[data-gfont="${CSS.escape(name)}"]`)) return
  const el = document.createElement('style')
  el.dataset.gfont = name
  el.textContent = css
  document.head.appendChild(el)
}

export function loadGoogleFont(name: string): Promise<boolean> {
  if (BUNDLED.has(name) || GENERIC.has(name)) return Promise.resolve(true)
  const hit = ready.get(name)
  if (hit) return hit
  const p = (async () => {
    let css = await getPref<string>(`gfont:${name}`, '')
    if (!css) {
      css = await fetchCss(name)
      void setPref(`gfont:${name}`, css)
    }
    injectCss(name, css)
    done.add(name)
    return true
  })().catch(() => {
    ready.delete(name) // allow a retry later (e.g. when back online)
    return false
  })
  ready.set(name, p)
  return p
}

/** Makes sure a text element's font is usable on the canvas. Resolves true when something was loaded (caller should re-measure). */
export async function ensureFont(fontFamily?: string, weight = 400, text = ''): Promise<boolean> {
  const fam = primaryFamily(fontFamily)
  if (GENERIC.has(fam)) return false
  const ok = await loadGoogleFont(fam)
  if (!ok) return false
  try {
    await document.fonts.load(`${weight} 16px "${fam}"`, text || 'Aa')
  } catch {
    /* ignore */
  }
  return true
}
