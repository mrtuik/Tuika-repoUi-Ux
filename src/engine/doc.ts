import { nanoid } from 'nanoid'
import { DOC_VERSION, EL_TYPES } from './types'
import type { Artboard, Crop, Doc, El, ElType, Gradient } from './types'

export const uid = () => nanoid(10)

export function defaultShadow() {
  return { enabled: false, x: 0, y: 4, blur: 12, color: '#000000', opacity: 0.2 }
}

const NAMES: Record<ElType, string> = {
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  text: 'Text',
  image: 'Image',
  icon: 'Icon',
  line: 'Line',
  arrow: 'Arrow',
}

export function newEl(type: ElType, patch: Partial<El> = {}): El {
  const base: El = {
    id: uid(),
    type,
    name: NAMES[type],
    x: 0,
    y: 0,
    w: 120,
    h: 120,
    rotation: 0,
    visible: true,
    locked: false,
    opacity: 1,
    fill: '#E5E5E5',
    stroke: '#171717',
    strokeWidth: 2,
    strokeOn: false,
    radius: 0,
    shadow: defaultShadow(),
  }
  if (type === 'rect') Object.assign(base, { w: 160, h: 96, fill: '#171717', radius: 12 })
  if (type === 'ellipse') Object.assign(base, { w: 120, h: 120, fill: '#171717' })
  if (type === 'text')
    Object.assign(base, {
      w: 200,
      h: 32,
      fill: '#171717',
      text: 'Text',
      fontSize: 24,
      fontFamily: 'Inter, system-ui, sans-serif',
      fontWeight: 500,
      align: 'left',
      lineHeight: 1.2,
      letterSpacing: 0,
      underline: false,
      italic: false,
      strike: false,
    })
  if (type === 'icon') Object.assign(base, { w: 48, h: 48, fill: '#171717' })
  if (type === 'line' || type === 'arrow') Object.assign(base, { w: 160, h: 0, strokeOn: true, stroke: '#171717', fill: '#171717' })
  return { ...base, ...patch, id: patch.id ?? base.id }
}

export function cloneEl(el: El): El {
  return { ...el, id: uid(), name: el.name.replace(/( copy)*$/, '') + ' copy', shadow: { ...el.shadow } }
}

/** Copies elements (new ids) and keeps their groups together under fresh group ids. */
export function cloneEls(els: El[], dx = 0, dy = 0): El[] {
  const groups = new Map<string, string>()
  return els.map((e) => {
    const c: El = { ...cloneEl(e), x: e.x + dx, y: e.y + dy }
    if (e.groupId) {
      if (!groups.has(e.groupId)) groups.set(e.groupId, uid())
      c.groupId = groups.get(e.groupId)
    }
    return c
  })
}

export function newArtboard(name: string, w: number, h: number, bg = '#FFFFFF', x = 0, y = 0): Artboard {
  return { id: uid(), name, x, y, w, h, bg, els: [] }
}

export function newDoc(name: string, w: number, h: number, bg = '#FFFFFF', count = 1): Doc {
  const artboards: Artboard[] = []
  for (let i = 0; i < Math.max(1, count); i++) artboards.push(newArtboard(`Screen ${i + 1}`, w, h, bg, i * (w + 60), 0))
  const now = Date.now()
  return {
    version: DOC_VERSION,
    id: uid(),
    name,
    artboards,
    startId: artboards[0].id,
    palette: ['#171717', '#FFFFFF', '#737373', '#E5E5E5', '#F97316'],
    assets: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function statusBarEls(w: number, h: number, withNav: boolean): El[] {
  const els: El[] = [
    newEl('rect', { name: 'Status bar', x: 0, y: 0, w, h: 24, fill: '#F5F5F5', radius: 0 }),
    newEl('text', { name: 'Clock', x: 16, y: 4, w: 60, h: 16, text: '9:41', fontSize: 12, fontWeight: 600 }),
  ]
  if (withNav) els.push(newEl('rect', { name: 'Navigation bar', x: 0, y: h - 40, w, h: 40, fill: '#F5F5F5', radius: 0 }))
  return els
}

export function loginTemplate(ab: Artboard) {
  const cx = 24
  const w = ab.w - 48
  ab.els.push(
    newEl('text', { name: 'Title', x: cx, y: 120, w, h: 40, text: 'Welcome back', fontSize: 32, fontWeight: 700 }),
    newEl('text', { name: 'Subtitle', x: cx, y: 168, w, h: 24, text: 'Sign in to continue', fontSize: 16, fill: '#737373', fontWeight: 400 }),
    newEl('rect', { name: 'Email field', x: cx, y: 232, w, h: 52, fill: '#F5F5F5', radius: 12 }),
    newEl('text', { name: 'Email label', x: cx + 16, y: 247, w: w - 32, h: 22, text: 'Email', fontSize: 16, fill: '#737373', fontWeight: 400 }),
    newEl('rect', { name: 'Password field', x: cx, y: 300, w, h: 52, fill: '#F5F5F5', radius: 12 }),
    newEl('text', { name: 'Password label', x: cx + 16, y: 315, w: w - 32, h: 22, text: 'Password', fontSize: 16, fill: '#737373', fontWeight: 400 }),
    newEl('rect', { name: 'Button', x: cx, y: 384, w, h: 52, fill: '#171717', radius: 12 }),
    newEl('text', { name: 'Button label', x: cx, y: 399, w, h: 22, text: 'Sign in', fontSize: 16, fill: '#FFFFFF', align: 'center', fontWeight: 600 }),
  )
}

// ---------- validation / migration ----------

const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const str = (v: unknown, d: string) => (typeof v === 'string' ? v : d)
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)

export interface ValidationResult {
  doc: Doc
  warnings: string[]
}

function safeSrc(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  return /^data:image\/(png|jpeg|webp|gif|svg\+xml)[;,]/i.test(v) ? v : undefined
}

const HEX = /^#[0-9a-f]{6}$/i
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

function cleanGradient(g: any): Gradient | undefined {
  if (!g || typeof g !== 'object' || (g.type !== 'linear' && g.type !== 'radial') || !Array.isArray(g.stops)) return undefined
  const stops = g.stops
    .filter((s: any) => s && typeof s.color === 'string' && HEX.test(s.color) && typeof s.pos === 'number' && Number.isFinite(s.pos))
    .map((s: any) => ({ color: s.color.toUpperCase(), pos: clamp01(s.pos) }))
    .sort((a: { pos: number }, b: { pos: number }) => a.pos - b.pos)
    .slice(0, 5)
  if (stops.length < 2) return undefined
  return { type: g.type, angle: num(g.angle, 90), stops }
}

function cleanCrop(c: any): Crop | undefined {
  if (!c || typeof c !== 'object') return undefined
  const x = clamp01(num(c.x, 0))
  const y = clamp01(num(c.y, 0))
  const w = Math.min(1 - x, num(c.w, 1))
  const h = Math.min(1 - y, num(c.h, 1))
  return w > 0.02 && h > 0.02 ? { x, y, w, h } : undefined
}

function cleanEl(raw: any, warnings: string[], where: string): El | null {
  if (!raw || typeof raw !== 'object') {
    warnings.push(`${where}: invalid element skipped`)
    return null
  }
  if (!EL_TYPES.includes(raw.type)) {
    warnings.push(`${where}: unsupported element type "${String(raw.type)}" (${str(raw.name, 'unnamed')}) was not imported`)
    return null
  }
  const d = newEl(raw.type as ElType)
  const sh = raw.shadow && typeof raw.shadow === 'object' ? raw.shadow : {}
  const el: El = {
    ...d,
    id: str(raw.id, d.id),
    name: str(raw.name, d.name),
    x: num(raw.x, 0),
    y: num(raw.y, 0),
    w: Math.max(0, num(raw.w, d.w)),
    h: Math.max(0, num(raw.h, d.h)),
    rotation: num(raw.rotation, 0),
    visible: bool(raw.visible, true),
    locked: bool(raw.locked, false),
    opacity: Math.min(1, Math.max(0, num(raw.opacity, 1))),
    fill: str(raw.fill, d.fill),
    stroke: str(raw.stroke, d.stroke),
    strokeWidth: Math.max(0, num(raw.strokeWidth, d.strokeWidth)),
    strokeOn: bool(raw.strokeOn, d.strokeOn),
    radius: Math.max(0, num(raw.radius, 0)),
    text: typeof raw.text === 'string' ? raw.text : d.text,
    fontSize: num(raw.fontSize, d.fontSize ?? 16),
    fontFamily: str(raw.fontFamily, d.fontFamily ?? ''),
    fontWeight: num(raw.fontWeight, d.fontWeight ?? 400),
    align: raw.align === 'center' || raw.align === 'right' ? raw.align : 'left',
    lineHeight: num(raw.lineHeight, d.lineHeight ?? 1.2),
    letterSpacing: num(raw.letterSpacing, 0),
    underline: bool(raw.underline, false),
    italic: bool(raw.italic, false),
    strike: bool(raw.strike, false),
    src: safeSrc(raw.src),
    svg: typeof raw.svg === 'string' && !/<script|on\w+\s*=/i.test(raw.svg) ? raw.svg : undefined,
    shadow: {
      enabled: bool(sh.enabled, false),
      x: num(sh.x, 0),
      y: num(sh.y, 4),
      blur: Math.max(0, num(sh.blur, 12)),
      color: str(sh.color, '#000000'),
      opacity: Math.min(1, Math.max(0, num(sh.opacity, 0.2))),
    },
    link: typeof raw.link === 'string' ? raw.link : undefined,
  }
  const grad = raw.type === 'rect' || raw.type === 'ellipse' || raw.type === 'text' ? cleanGradient(raw.fillGradient) : undefined
  if (grad) el.fillGradient = grad
  const crop = raw.type === 'image' ? cleanCrop(raw.crop) : undefined
  if (crop) el.crop = crop
  if (raw.type === 'image' && raw.mask === 'circle') el.mask = 'circle'
  if (typeof raw.groupId === 'string' && raw.groupId.length <= 40) el.groupId = raw.groupId
  if (raw.type !== 'text') {
    delete el.text
    delete el.fontSize
    delete el.fontFamily
    delete el.fontWeight
    delete el.align
    delete el.lineHeight
    delete el.letterSpacing
    delete el.underline
    delete el.italic
    delete el.strike
  }
  if (raw.src && !el.src) warnings.push(`${where}: image "${el.name}" had an unsupported source and was left empty`)
  return el
}

/** Validates + migrates untrusted input. Throws on unusable files; reports every dropped item in warnings. */
export function validateDoc(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object') throw new Error('File is not a Tuika project')
  const r = raw as any
  if (typeof r.version !== 'number') throw new Error('Missing project version')
  if (r.version > DOC_VERSION) throw new Error(`Project was made with a newer Tuika version (v${r.version})`)
  if (!Array.isArray(r.artboards) || r.artboards.length === 0) throw new Error('Project has no artboards')
  const warnings: string[] = []
  const artboards: Artboard[] = r.artboards.map((a: any, i: number) => {
    const els: El[] = []
    const list = Array.isArray(a?.els) ? a.els : []
    for (const e of list) {
      const c = cleanEl(e, warnings, `Artboard ${i + 1}`)
      if (c) els.push(c)
    }
    return {
      id: str(a?.id, uid()),
      name: str(a?.name, `Screen ${i + 1}`),
      x: num(a?.x, i * 420),
      y: num(a?.y, 0),
      w: Math.min(8000, Math.max(16, num(a?.w, 360))),
      h: Math.min(8000, Math.max(16, num(a?.h, 800))),
      bg: str(a?.bg, '#FFFFFF'),
      els,
    }
  })
  const ids = new Set(artboards.map((a) => a.id))
  const now = Date.now()
  const doc: Doc = {
    version: DOC_VERSION,
    id: str(r.id, uid()),
    name: str(r.name, 'Imported project'),
    artboards,
    startId: ids.has(r.startId) ? r.startId : artboards[0].id,
    palette: Array.isArray(r.palette) ? r.palette.filter((c: unknown) => typeof c === 'string').slice(0, 40) : [],
    assets: Array.isArray(r.assets)
      ? r.assets
          .filter((a: any) => a && typeof a.id === 'string' && (a.kind === 'icon' || a.kind === 'image'))
          .map((a: any) => ({ id: a.id, name: str(a.name, 'Asset'), kind: a.kind, svg: typeof a.svg === 'string' ? a.svg : undefined, src: safeSrc(a.src), source: typeof a.source === 'string' ? a.source : undefined }))
      : [],
    createdAt: num(r.createdAt, now),
    updatedAt: num(r.updatedAt, now),
  }
  return { doc, warnings }
}

export function brokenLinks(doc: Doc): { abId: string; elId: string; name: string }[] {
  const ids = new Set(doc.artboards.map((a) => a.id))
  const out: { abId: string; elId: string; name: string }[] = []
  for (const a of doc.artboards) for (const e of a.els) if (e.link && !ids.has(e.link)) out.push({ abId: a.id, elId: e.id, name: e.name })
  return out
}

export const BACKUP_FORMAT = 'tuika-project'

export function serializeProject(doc: Doc): string {
  return JSON.stringify({ format: BACKUP_FORMAT, version: DOC_VERSION, exportedAt: Date.now(), doc })
}

export function parseProject(text: string): ValidationResult {
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('File is not valid JSON')
  }
  if (data?.format !== BACKUP_FORMAT) throw new Error('File is not a Tuika backup')
  return validateDoc(data.doc)
}
