/** Turns Gemini's JSON into real Tuika elements, and Tuika screens into compact JSON for Gemini. */
import { cloneEls, newEl, uid, newArtboard } from '../engine/doc'
import type { Artboard, El, Gradient } from '../engine/types'
import { sanitizeSvg } from './svg'
import { BUNDLED, GOOGLE_FONTS, familyValue } from './fonts'
import { useEditor } from '../state/editor'

export interface AiScreen {
  name: string
  bg: string
  w: number
  h: number
  els: El[]
}
export interface AiDesign {
  title: string
  screens: AiScreen[]
}
export interface Device {
  w: number
  h: number
}

export function systemPrompt(dev: Device, count: number): string {
  return `You are the design engine inside "Tuika", a mobile UI/UX design studio. You create attractive, modern, production-quality app screens as editable elements.

Reply with ONE JSON object and nothing else:
{"message":"1-2 friendly sentences about what you made","designs":[{"title":"short option name","screens":[{"name":"Screen name","bg":"#FFFFFF","elements":[ ... ]}]}]}

Make exactly ${count} design option${count > 1 ? 's' : ''} in "designs". Options must look clearly different (layout, colour mood, style). Use 1 screen per option unless the user asks for a flow or several screens (max 4).

Canvas: each screen is ${dev.w} x ${dev.h} px, origin top-left, y grows downward. Elements are drawn in array order (first = bottom).

Element types and fields (omit anything you do not need; keep JSON compact):
- rect: x,y,w,h, fill, radius, stroke, strokeWidth, opacity, shadow:{x,y,blur,color,opacity}, gradient:{type:"linear"|"radial",angle:0-360 (90 = top to bottom),stops:[["#hex",0],["#hex",1]]}
- ellipse: same as rect without radius (use for avatars, dots, blobs)
- text: x,y,w,text,fontSize,fontWeight(100-900),fontFamily,align("left"|"center"|"right"),fill,lineHeight,letterSpacing. Set w to the box width the text should wrap in. Height is automatic.
- icon: x,y,w,h,icon:"lucide:home",fill. Icons come from Iconify. Prefer the "lucide" set (e.g. lucide:house, lucide:search, lucide:bell, lucide:user, lucide:heart, lucide:settings, lucide:shopping-bag, lucide:play, lucide:chevron-right, lucide:plus, lucide:camera, lucide:map-pin, lucide:credit-card). "mdi" also works.
- line / arrow: x,y,w,h (h can be 0), stroke, strokeWidth
Any element may have: "name" (short layer name), "group" (same string = moves together, use for cards/list rows/buttons), "link" (name of another screen in the same design, for tappable prototype navigation on buttons/tabs).
There are no photos. For images use a rect or ellipse with a soft gradient or tinted fill, optionally with an icon on top.

Fonts: only "Inter" (default), "Poppins", "Playfair Display", "JetBrains Mono", or a Google font name such as "DM Sans", "Manrope", "Space Grotesk", "Outfit", "Plus Jakarta Sans". For Bangla text use "Hind Siliguri".

Design rules (follow them, this is what makes it attractive):
- Colours as 6-digit hex. Pick a deliberate palette: 1 brand colour, 1 accent, neutrals. Good contrast. Never pure grey-only unless asked.
- 8px spacing grid, 16-24px side margins, consistent corner radii (12-20 for cards/buttons, fully round for pills/avatars).
- Clear hierarchy: one big title (26-34), section titles (16-20), body (14-16), captions (11-13). Use weights 400/500/600/700.
- Keep the top ${Math.round(Math.min(48, dev.h * 0.06))}px free for the status bar. Bottom navigation or primary button sits about 24px above the bottom edge. Touch targets at least 44px high.
- Realistic copy and numbers, never lorem ipsum. Fill the whole screen with believable content (cards, lists, stats, tabs), not just a few elements.
- Soft shadows only (blur 12-24, opacity 0.06-0.16). Use gradients tastefully for hero cards and primary buttons.
- Every element must stay inside the screen width. Aim for 25-60 elements per screen.
If the user gives a current screen as JSON, use it as the starting point and apply the requested change. If they ask to change a previous design, reuse your last answer and edit it.`
}

// ---------- parsing ----------

export function parseReply(text: string): { message: string; designs: any[] } {
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  let j: any
  try {
    j = JSON.parse(t)
  } catch {
    const a = t.indexOf('{')
    const b = t.lastIndexOf('}')
    if (a < 0 || b <= a) throw new Error('Gemini did not return a design. Try again.')
    try {
      j = JSON.parse(t.slice(a, b + 1))
    } catch {
      throw new Error('The answer was cut off or malformed. Try again with 1 option, or a simpler request.')
    }
  }
  const designs = Array.isArray(j?.designs) ? j.designs : Array.isArray(j) ? j : []
  if (!designs.length) throw new Error('Gemini did not return a design. Try again.')
  return { message: typeof j?.message === 'string' ? j.message : '', designs }
}

// ---------- icons ----------

const iconCache = new Map<string, string | null>()
async function fetchIcon(raw: string): Promise<string | null> {
  const name = raw.trim().toLowerCase()
  if (iconCache.has(name)) return iconCache.get(name)!
  const [p, n] = name.includes(':') ? name.split(':') : ['lucide', name]
  const tries = [`${p}/${n}`, `lucide/${n}`, `mdi/${n}`]
  let svg: string | null = null
  for (const t of [...new Set(tries)]) {
    if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(t)) continue
    try {
      const r = await fetch(`https://api.iconify.design/${t}.svg`)
      if (!r.ok) continue
      svg = sanitizeSvg(await r.text())
      if (svg) break
    } catch {
      /* try the next */
    }
  }
  iconCache.set(name, svg)
  return svg
}

async function loadIcons(names: string[]): Promise<Map<string, string | null>> {
  const uniq = [...new Set(names.map((n) => n.trim().toLowerCase()))].slice(0, 80)
  const out = new Map<string, string | null>()
  for (let i = 0; i < uniq.length; i += 8) {
    await Promise.all(uniq.slice(i, i + 8).map(async (n) => out.set(n, await fetchIcon(n))))
  }
  return out
}

// ---------- building elements ----------

const num = (v: unknown, d: number, lo = -1e5, hi = 1e5) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d)
const r1 = (n: number) => Math.round(n * 10) / 10

function hex(v: unknown, d: string): string {
  if (typeof v !== 'string') return d
  const s = v.trim()
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toUpperCase()
  if (/^#[0-9a-f]{3}$/i.test(s)) return ('#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toUpperCase()
  if (/^#[0-9a-f]{8}$/i.test(s)) return s.slice(0, 7).toUpperCase()
  return d
}

const FONT_NAMES = new Set([...BUNDLED, ...GOOGLE_FONTS.map((f) => f.name)])
function font(v: unknown): string {
  const n = typeof v === 'string' ? v.split(',')[0].trim().replace(/^['"]|['"]$/g, '') : ''
  const hit = [...FONT_NAMES].find((f) => f.toLowerCase() === n.toLowerCase())
  return familyValue(hit ?? 'Inter')
}

function gradient(g: any): Gradient | undefined {
  if (!g || typeof g !== 'object' || !Array.isArray(g.stops)) return undefined
  const stops = g.stops
    .map((s: any) => (Array.isArray(s) ? { color: hex(s[0], ''), pos: num(s[1], 0, 0, 1) } : s && typeof s === 'object' ? { color: hex(s.color, ''), pos: num(s.pos, 0, 0, 1) } : null))
    .filter((s: any) => s && s.color)
    .sort((a: any, b: any) => a.pos - b.pos)
    .slice(0, 5)
  if (stops.length < 2) return undefined
  return { type: g.type === 'radial' ? 'radial' : 'linear', angle: num(g.angle, 90, -360, 360), stops }
}

function estimateH(text: string, w: number, size: number, lh: number): number {
  const per = Math.max(1, Math.floor(w / (size * 0.52)))
  const lines = text.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / per)), 0)
  return Math.ceil(lines * size * lh)
}

function buildEl(r: any, dev: Device, groups: Map<string, string>, icons: Map<string, string | null>): El | null {
  if (!r || typeof r !== 'object') return null
  let type = String(r.type ?? '')
  if (type === 'image') type = 'rect'
  if (!['rect', 'ellipse', 'text', 'icon', 'line', 'arrow'].includes(type)) return null
  const patch: Partial<El> = {
    name: typeof r.name === 'string' ? r.name.slice(0, 40) : undefined,
    x: r1(num(r.x, 0, -dev.w, dev.w * 2)),
    y: r1(num(r.y, 0, -dev.h, dev.h * 2)),
    rotation: num(r.rotation, 0, -360, 360),
    opacity: num(r.opacity, 1, 0, 1),
  }
  if (!patch.name) delete patch.name
  if (type === 'text') {
    const text = typeof r.text === 'string' ? r.text.slice(0, 500) : ''
    if (!text) return null
    const size = num(r.fontSize, 16, 8, 120)
    const lh = num(r.lineHeight, 1.25, 0.9, 2.2)
    const w = Math.max(8, r1(num(r.w, dev.w - 48, 8, dev.w * 2)))
    Object.assign(patch, {
      text,
      w,
      h: estimateH(text, w, size, lh),
      fontSize: size,
      lineHeight: lh,
      fontWeight: Math.round(num(r.fontWeight, 400, 100, 900) / 100) * 100,
      fontFamily: font(r.fontFamily),
      align: r.align === 'center' || r.align === 'right' ? r.align : 'left',
      fill: hex(r.fill, '#171717'),
      letterSpacing: num(r.letterSpacing, 0, -5, 20),
      italic: r.italic === true,
      underline: r.underline === true,
    })
    if (!patch.name) patch.name = text.slice(0, 24)
  } else if (type === 'icon') {
    const svg = typeof r.icon === 'string' ? icons.get(r.icon.trim().toLowerCase()) : null
    if (!svg) return null
    Object.assign(patch, { svg, w: r1(num(r.w, 24, 4, 600)), h: r1(num(r.h ?? r.w, 24, 4, 600)), fill: hex(r.fill, '#171717') })
    if (!patch.name) patch.name = String(r.icon).split(':').pop()
  } else if (type === 'line' || type === 'arrow') {
    Object.assign(patch, { w: r1(num(r.w, 100, -2000, 2000)), h: r1(num(r.h, 0, -2000, 2000)), strokeOn: true, stroke: hex(r.stroke ?? r.fill, '#171717'), strokeWidth: num(r.strokeWidth, 2, 0.5, 20) })
  } else {
    const g = gradient(r.gradient)
    Object.assign(patch, { w: r1(num(r.w, 100, 1, 2000)), h: r1(num(r.h, 100, 1, 4000)), fill: hex(r.fill, g ? g.stops[0].color : '#E5E5E5'), radius: type === 'rect' ? num(r.radius, 0, 0, 2000) : 0 })
    if (g) patch.fillGradient = g
  }
  if (type === 'rect' || type === 'ellipse') {
    if (r.stroke) Object.assign(patch, { strokeOn: true, stroke: hex(r.stroke, '#E5E5E5'), strokeWidth: num(r.strokeWidth, 1, 0.5, 20) })
  }
  if (r.shadow && typeof r.shadow === 'object' && type !== 'line' && type !== 'arrow') {
    const s = r.shadow
    patch.shadow = { enabled: true, x: num(s.x, 0, -50, 50), y: num(s.y, 4, -50, 50), blur: num(s.blur, 12, 0, 80), color: hex(s.color, '#000000'), opacity: num(s.opacity, 0.12, 0, 1) }
  }
  if (typeof r.group === 'string' && r.group) {
    if (!groups.has(r.group)) groups.set(r.group, uid())
    patch.groupId = groups.get(r.group)
  }
  if (typeof r.link === 'string' && r.link) patch.link = r.link // screen NAME until the design is added to a project
  return newEl(type as any, patch)
}

/** Validates the model's designs and downloads the icons they use. */
export async function resolveDesigns(raw: any[], dev: Device, signal?: AbortSignal): Promise<AiDesign[]> {
  const names: string[] = []
  for (const d of raw)
    for (const s of d?.screens ?? [])
      for (const e of s?.elements ?? []) if (e?.type === 'icon' && typeof e.icon === 'string') names.push(e.icon)
  const icons = await loadIcons(names)
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  const out: AiDesign[] = []
  for (const d of raw.slice(0, 4)) {
    const groups = new Map<string, string>()
    const screens: AiScreen[] = []
    for (const s of (Array.isArray(d?.screens) ? d.screens : []).slice(0, 6)) {
      const els = (Array.isArray(s?.elements) ? s.elements : []).slice(0, 160).map((e: any) => buildEl(e, dev, groups, icons)).filter(Boolean) as El[]
      if (els.length) screens.push({ name: typeof s?.name === 'string' && s.name ? s.name.slice(0, 40) : `Screen ${screens.length + 1}`, bg: hex(s?.bg, '#FFFFFF'), w: dev.w, h: dev.h, els })
    }
    if (screens.length) out.push({ title: typeof d?.title === 'string' && d.title ? d.title.slice(0, 40) : `Option ${out.length + 1}`, screens })
  }
  if (!out.length) throw new Error('Gemini returned an empty design. Try again.')
  return out
}

// ---------- current screen -> compact JSON for the model ----------

export function screenContext(ab: Artboard): string {
  const els = ab.els.filter((e) => e.visible).slice(0, 90).map((e) => {
    const o: any = { type: e.type, name: e.name, x: Math.round(e.x), y: Math.round(e.y), w: Math.round(e.w), h: Math.round(e.h) }
    if (e.type === 'text') Object.assign(o, { text: e.text, fontSize: e.fontSize, fontWeight: e.fontWeight, align: e.align, fill: e.fill })
    else if (e.type === 'icon') Object.assign(o, { icon: 'lucide:' + e.name.toLowerCase().replace(/\s+/g, '-'), fill: e.fill })
    else if (e.type !== 'line' && e.type !== 'arrow') Object.assign(o, { fill: e.fill, radius: e.radius || undefined })
    return o
  })
  return JSON.stringify({ name: ab.name, w: Math.round(ab.w), h: Math.round(ab.h), bg: ab.bg, elements: els })
}

// ---------- adding to the project ----------

/** Adds every screen of a design as new screens (one undo step). Returns the first new screen id. */
export function addScreens(design: AiDesign, only?: number): string | null {
  const st = useEditor.getState()
  const doc = st.doc
  if (!doc) return null
  const picked = only === undefined ? design.screens : [design.screens[only]]
  const last = doc.artboards[doc.artboards.length - 1]
  const boards: Artboard[] = picked.map((s, i) => {
    const ab = newArtboard(s.name, s.w, s.h, s.bg, last ? last.x + last.w + 60 + i * (s.w + 60) : i * (s.w + 60), last?.y ?? 0)
    ab.els = cloneEls(s.els)
    return ab
  })
  const idByName = new Map(boards.map((b) => [b.name, b.id]))
  for (const b of boards)
    for (const e of b.els) {
      if (e.link) {
        const id = idByName.get(e.link)
        if (id) e.link = id
        else delete e.link
      }
    }
  st.commit((d) => {
    d.artboards.push(...boards)
  })
  st.select(boards[0].id, [])
  window.dispatchEvent(new CustomEvent('tuika-focus', { detail: boards[0].id }))
  return boards[0].id
}

/** Drops one screen's elements onto the screen that is open now. */
export function addToScreen(screen: AiScreen): number {
  const st = useEditor.getState()
  const doc = st.doc
  const ab = doc?.artboards.find((a) => a.id === st.sel.abId) ?? doc?.artboards[0]
  if (!doc || !ab) return 0
  const els = cloneEls(screen.els).map((e) => {
    delete e.link
    return e
  })
  st.commit((d) => {
    d.artboards.find((a) => a.id === ab.id)!.els.push(...els)
  })
  st.select(ab.id, els.map((e) => e.id))
  return els.length
}
