import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Search } from 'lucide-react'
import { getPref, setPref } from '../../database/db'
import { useUI } from '../../state/ui'
import { BUNDLED, CAT_LABEL, GOOGLE_FONTS, familyValue, isLoaded, loadGoogleFont, primaryFamily } from '../../services/fonts'
import type { FontCat } from '../../services/fonts'

const CHIPS: { v: FontCat | 'all'; label: string }[] = [
  { v: 'all', label: 'All' },
  { v: 'bn', label: 'Bangla' },
  { v: 'sans', label: 'Sans' },
  { v: 'serif', label: 'Serif' },
  { v: 'display', label: 'Display' },
  { v: 'hand', label: 'Handwriting' },
  { v: 'mono', label: 'Mono' },
  { v: 'intl', label: 'Other' },
]

/** Search + pick from system fonts and ~190 Google Fonts (loaded on demand). */
export default function FontPicker({ value, onPick }: { value?: string; onPick: (family: string) => void }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<FontCat | 'all'>('all')
  const [recent, setRecent] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [, bump] = useState(0)
  const current = primaryFamily(value)

  useEffect(() => {
    void getPref<string[]>('font-recent', []).then(setRecent)
  }, [])

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    const sys = [{ name: 'System', cat: 'sans' as FontCat }]
    return [...sys, ...GOOGLE_FONTS].filter((f) => (cat === 'all' || f.cat === cat) && (!t || f.name.toLowerCase().includes(t)))
  }, [q, cat])

  const pick = async (name: string) => {
    if (busy) return
    if (name === 'System') return onPick('system-ui, sans-serif')
    setBusy(name)
    const ok = await loadGoogleFont(name)
    setBusy(null)
    if (!ok) {
      useUI.getState().say(navigator.onLine ? `Could not load ${name}` : 'You are offline. This font is not downloaded yet.')
      return
    }
    onPick(familyValue(name))
    const r = [name, ...recent.filter((x) => x !== name)].slice(0, 8)
    setRecent(r)
    void setPref('font-recent', r)
    bump((n) => n + 1)
  }

  const row = (name: string, catLabel?: string) => (
    <button key={name} className={'frow' + (current === name || (name === 'System' && /^system-ui/.test(value ?? '')) ? ' on' : '')} onClick={() => void pick(name)} aria-label={`Use font ${name}`}>
      <span className="fname" style={isLoaded(name) ? { fontFamily: familyValue(name) } : undefined}>
        {name}
      </span>
      <span className="fcat">{catLabel}</span>
      {busy === name ? <Loader2 size={16} className="spin" /> : current === name ? <Check size={16} /> : <span style={{ width: 16 }} />}
    </button>
  )

  return (
    <div className="fontpick">
      <label className="search card">
        <Search size={18} />
        <input aria-label="Search fonts" placeholder={`Search ${GOOGLE_FONTS.length}+ fonts`} value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="chips" role="group" aria-label="Font category">
        {CHIPS.map((c) => (
          <button key={c.v} className={'chipbtn' + (cat === c.v ? ' on' : '')} aria-pressed={cat === c.v} onClick={() => setCat(c.v)}>
            {c.label}
          </button>
        ))}
      </div>
      {!q && cat === 'all' && recent.length > 0 && (
        <>
          <div className="group-label">Recently used</div>
          <div className="fontlist short">{recent.map((n) => row(n))}</div>
        </>
      )}
      <div className="group-label">{q ? `Results for "${q}"` : cat === 'all' ? 'All fonts' : CAT_LABEL[cat]}</div>
      <div className="fontlist">
        {list.map((f) => row(f.name, BUNDLED.has(f.name) ? 'Built in' : f.name === 'System' ? '' : CAT_LABEL[f.cat]))}
        {list.length === 0 && <div className="empty small">No font matches "{q}"</div>}
      </div>
      <div className="hint">Google Fonts download the first time you use them (about 30-100 KB). Fonts you used before keep working offline once cached.</div>
    </div>
  )
}
