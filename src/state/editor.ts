import { create } from 'zustand'
import { produce } from 'immer'
import type { Artboard, Doc, El, ElType } from '../engine/types'
import { cloneEl, cloneEls, newArtboard, newEl, uid } from '../engine/doc'

const MAX_HISTORY = 100
export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'

interface Sel {
  abId: string | null
  elIds: string[]
}

interface EditorState {
  doc: Doc | null
  sel: Sel
  past: Doc[]
  future: Doc[]
  rev: number
  lastKey: string
  lastT: number
  clip: El[] | null
  styleClip: { from: ElType; props: Partial<El> } | null
  open: (doc: Doc) => void
  close: () => void
  commit: (fn: (d: Doc) => void, key?: string) => void
  select: (abId: string | null, elIds: string[]) => void
  undo: () => void
  redo: () => void
  addEl: (type: ElType, patch?: Partial<El>, abId?: string) => string | null
  patchEl: (abId: string, id: string, patch: Partial<El>, key?: string) => void
  patchSel: (patch: Partial<El>, key?: string) => void
  removeSel: () => void
  syncH: (abId: string, id: string, h: number) => void
  duplicateSel: () => void
  reorder: (dir: 'up' | 'down' | 'front' | 'back') => void
  align: (mode: AlignMode) => void
  group: () => void
  ungroup: () => void
  selectAll: () => void
  copyStyle: () => void
  pasteStyle: () => void
  copy: () => void
  cut: () => void
  paste: () => void
  addArtboard: (name?: string, w?: number, h?: number) => string | null
  duplicateArtboard: (abId: string) => void
  removeArtboard: (abId: string) => void
  moveArtboardOrder: (abId: string, dir: -1 | 1) => void
  patchArtboard: (abId: string, patch: Partial<Artboard>, key?: string) => void
  rename: (name: string) => void
}

function prune(doc: Doc, sel: Sel): Sel {
  const ab = doc.artboards.find((a) => a.id === sel.abId) ?? doc.artboards[0]
  if (!ab) return { abId: null, elIds: [] }
  const ids = new Set(ab.els.map((e) => e.id))
  return { abId: ab.id, elIds: sel.elIds.filter((i) => ids.has(i)) }
}

export const useEditor = create<EditorState>((set, get) => ({
  doc: null,
  sel: { abId: null, elIds: [] },
  past: [],
  future: [],
  rev: 0,
  lastKey: '',
  lastT: 0,
  clip: null,
  styleClip: null,

  open: (doc) => set({ doc, sel: { abId: doc.artboards[0]?.id ?? null, elIds: [] }, past: [], future: [], rev: 0, lastKey: '', lastT: 0 }),
  close: () => set({ doc: null, sel: { abId: null, elIds: [] }, past: [], future: [], rev: 0 }),

  // One undo step per commit. Same `key` within 800ms coalesces (slider drags, typing).
  commit: (fn, key) => {
    const { doc, past, lastKey, lastT, rev, sel } = get()
    if (!doc) return
    const next = produce(doc, fn)
    if (next === doc) return
    const now = Date.now()
    const coalesce = !!key && key === lastKey && now - lastT < 800
    const stamped = { ...next, updatedAt: now }
    set({
      doc: stamped,
      sel: prune(stamped, sel),
      past: coalesce ? past : [...past, doc].slice(-MAX_HISTORY),
      future: [],
      rev: rev + 1,
      lastKey: key ?? '',
      lastT: now,
    })
  },

  select: (abId, elIds) => set({ sel: { abId, elIds } }),

  undo: () => {
    const { past, future, doc, rev, sel } = get()
    if (!doc || past.length === 0) return
    const prev = past[past.length - 1]
    set({ doc: prev, past: past.slice(0, -1), future: [doc, ...future].slice(0, MAX_HISTORY), rev: rev + 1, sel: prune(prev, sel), lastKey: '' })
  },
  redo: () => {
    const { past, future, doc, rev, sel } = get()
    if (!doc || future.length === 0) return
    const next = future[0]
    set({ doc: next, past: [...past, doc].slice(-MAX_HISTORY), future: future.slice(1), rev: rev + 1, sel: prune(next, sel), lastKey: '' })
  },

  addEl: (type, patch = {}, abId) => {
    const { doc, sel } = get()
    if (!doc) return null
    const target = doc.artboards.find((a) => a.id === (abId ?? sel.abId)) ?? doc.artboards[0]
    if (!target) return null
    const el = newEl(type, patch)
    if (patch.x === undefined) el.x = Math.round((target.w - el.w) / 2)
    if (patch.y === undefined) el.y = Math.round((target.h - el.h) / 2)
    get().commit((d) => {
      d.artboards.find((a) => a.id === target.id)!.els.push(el)
    })
    set({ sel: { abId: target.id, elIds: [el.id] } })
    return el.id
  },

  patchEl: (abId, id, patch, key) =>
    get().commit((d) => {
      const e = d.artboards.find((a) => a.id === abId)?.els.find((x) => x.id === id)
      if (e) Object.assign(e, patch)
    }, key ? `${key}:${id}` : undefined),

  patchSel: (patch, key) => {
    const { sel } = get()
    if (!sel.abId || sel.elIds.length === 0) return
    get().commit((d) => {
      const ab = d.artboards.find((a) => a.id === sel.abId)
      if (!ab) return
      for (const e of ab.els) if (sel.elIds.includes(e.id)) Object.assign(e, patch)
    }, key ? `${key}:${sel.elIds.join(',')}` : undefined)
  },

  // text height follows its content; this is derived data, so it never creates an undo step
  syncH: (abId, id, h) => {
    const { doc, rev } = get()
    if (!doc) return
    const next = produce(doc, (d) => {
      const e = d.artboards.find((a) => a.id === abId)?.els.find((x) => x.id === id)
      if (e) e.h = h
    })
    if (next !== doc) set({ doc: next, rev: rev + 1 })
  },

  removeSel: () => {
    const { sel } = get()
    if (!sel.abId || sel.elIds.length === 0) return
    get().commit((d) => {
      const ab = d.artboards.find((a) => a.id === sel.abId)
      if (ab) ab.els = ab.els.filter((e) => !sel.elIds.includes(e.id))
    })
  },

  duplicateSel: () => {
    const { sel, doc } = get()
    if (!doc || !sel.abId || sel.elIds.length === 0) return
    const ab = doc.artboards.find((a) => a.id === sel.abId)
    if (!ab) return
    const copies = cloneEls(ab.els.filter((e) => sel.elIds.includes(e.id)), 16, 16)
    get().commit((d) => {
      d.artboards.find((a) => a.id === sel.abId)!.els.push(...copies)
    })
    set({ sel: { abId: sel.abId, elIds: copies.map((c) => c.id) } })
  },

  reorder: (dir) => {
    const { sel } = get()
    if (!sel.abId || sel.elIds.length === 0) return
    get().commit((d) => {
      const ab = d.artboards.find((a) => a.id === sel.abId)
      if (!ab) return
      const picked = ab.els.filter((e) => sel.elIds.includes(e.id))
      const rest = ab.els.filter((e) => !sel.elIds.includes(e.id))
      if (dir === 'front') ab.els = [...rest, ...picked]
      else if (dir === 'back') ab.els = [...picked, ...rest]
      else {
        const arr = ab.els
        if (dir === 'up') {
          for (let i = arr.length - 2; i >= 0; i--) if (sel.elIds.includes(arr[i].id) && !sel.elIds.includes(arr[i + 1].id)) [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
        } else {
          for (let i = 1; i < arr.length; i++) if (sel.elIds.includes(arr[i].id) && !sel.elIds.includes(arr[i - 1].id)) [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]]
        }
      }
    })
  },

  align: (mode) => {
    const { sel } = get()
    if (!sel.abId || sel.elIds.length === 0) return
    get().commit((d) => {
      const ab = d.artboards.find((a) => a.id === sel.abId)
      if (!ab) return
      const picked = ab.els.filter((e) => sel.elIds.includes(e.id))
      if (!picked.length) return
      // the selection moves as one block, measured on its visible (rotated) outline
      let x1 = Infinity
      let y1 = Infinity
      let x2 = -Infinity
      let y2 = -Infinity
      for (const e of picked) {
        const r = ((e.rotation || 0) * Math.PI) / 180
        const c = Math.cos(r)
        const s = Math.sin(r)
        for (const [px, py] of [[0, 0], [e.w, 0], [e.w, e.h], [0, e.h]]) {
          const X = e.x + px * c - py * s
          const Y = e.y + px * s + py * c
          x1 = Math.min(x1, X)
          y1 = Math.min(y1, Y)
          x2 = Math.max(x2, X)
          y2 = Math.max(y2, Y)
        }
      }
      let dx = 0
      let dy = 0
      if (mode === 'left') dx = -x1
      if (mode === 'hcenter') dx = (ab.w - (x2 - x1)) / 2 - x1
      if (mode === 'right') dx = ab.w - x2
      if (mode === 'top') dy = -y1
      if (mode === 'vcenter') dy = (ab.h - (y2 - y1)) / 2 - y1
      if (mode === 'bottom') dy = ab.h - y2
      for (const e of picked) {
        e.x = Math.round((e.x + dx) * 10) / 10
        e.y = Math.round((e.y + dy) * 10) / 10
      }
    })
  },

  group: () => {
    const { sel } = get()
    if (!sel.abId || sel.elIds.length < 2) return
    const gid = uid()
    get().commit((d) => {
      const ab = d.artboards.find((a) => a.id === sel.abId)
      if (ab) for (const e of ab.els) if (sel.elIds.includes(e.id)) e.groupId = gid
    })
  },
  ungroup: () => {
    const { sel, doc } = get()
    const ab = doc?.artboards.find((a) => a.id === sel.abId)
    if (!ab) return
    const gids = new Set(ab.els.filter((e) => sel.elIds.includes(e.id) && e.groupId).map((e) => e.groupId as string))
    if (gids.size === 0) return
    get().commit((d) => {
      const a = d.artboards.find((x) => x.id === sel.abId)
      if (a) for (const e of a.els) if (e.groupId && gids.has(e.groupId)) delete e.groupId
    })
  },
  selectAll: () => {
    const { sel, doc } = get()
    const ab = doc?.artboards.find((a) => a.id === sel.abId) ?? doc?.artboards[0]
    if (!ab) return
    set({ sel: { abId: ab.id, elIds: ab.els.filter((e) => e.visible && !e.locked).map((e) => e.id) } })
  },

  copyStyle: () => {
    const { sel, doc } = get()
    const ab = doc?.artboards.find((a) => a.id === sel.abId)
    const e = ab?.els.find((x) => x.id === sel.elIds[0])
    if (!e) return
    const props: Partial<El> = { fill: e.fill, fillGradient: e.fillGradient, stroke: e.stroke, strokeWidth: e.strokeWidth, strokeOn: e.strokeOn, radius: e.radius, opacity: e.opacity, shadow: { ...e.shadow } }
    if (e.type === 'text') Object.assign(props, { fontFamily: e.fontFamily, fontWeight: e.fontWeight, align: e.align, lineHeight: e.lineHeight, letterSpacing: e.letterSpacing, underline: e.underline, italic: e.italic, strike: e.strike })
    set({ styleClip: { from: e.type, props } })
  },
  pasteStyle: () => {
    const { styleClip, sel } = get()
    if (!styleClip || !sel.abId || sel.elIds.length === 0) return
    const { from, props } = styleClip
    const srcFill = from === 'rect' || from === 'ellipse' || from === 'text' || from === 'icon'
    get().commit((d) => {
      const ab = d.artboards.find((a) => a.id === sel.abId)
      if (!ab) return
      for (const e of ab.els) {
        if (!sel.elIds.includes(e.id)) continue
        const fillable = e.type === 'rect' || e.type === 'ellipse' || e.type === 'text' || e.type === 'icon'
        if (fillable && srcFill) {
          e.fill = props.fill as string
          if (e.type !== 'icon') e.fillGradient = props.fillGradient ? { ...props.fillGradient, stops: props.fillGradient.stops.map((s) => ({ ...s })) } : undefined
        }
        if (e.type === 'rect' || e.type === 'ellipse' || e.type === 'text') {
          if (from !== 'line' && from !== 'arrow' && from !== 'image' && from !== 'icon') {
            e.stroke = props.stroke as string
            e.strokeWidth = props.strokeWidth as number
            e.strokeOn = props.strokeOn as boolean
          }
        } else if (e.type === 'line' || e.type === 'arrow') {
          if (from === 'line' || from === 'arrow') {
            e.stroke = props.stroke as string
            e.strokeWidth = props.strokeWidth as number
          } else if (srcFill) e.stroke = props.fill as string
        }
        if ((e.type === 'rect' || e.type === 'image') && (from === 'rect' || from === 'image')) e.radius = props.radius as number
        e.opacity = props.opacity as number
        e.shadow = { ...(props.shadow as El['shadow']) }
        if (e.type === 'text' && from === 'text') Object.assign(e, { fontFamily: props.fontFamily, fontWeight: props.fontWeight, align: props.align, lineHeight: props.lineHeight, letterSpacing: props.letterSpacing, underline: props.underline, italic: props.italic, strike: props.strike })
      }
    })
  },

  copy: () => {
    const { sel, doc } = get()
    const ab = doc?.artboards.find((a) => a.id === sel.abId)
    if (!ab) return
    const items = ab.els.filter((e) => sel.elIds.includes(e.id)).map((e) => ({ ...e, shadow: { ...e.shadow } }))
    if (items.length) set({ clip: items })
  },
  cut: () => {
    get().copy()
    get().removeSel()
  },
  paste: () => {
    const { clip, sel, doc } = get()
    if (!clip || !doc) return
    const abId = sel.abId ?? doc.artboards[0].id
    const copies = cloneEls(clip, 16, 16)
    get().commit((d) => {
      d.artboards.find((a) => a.id === abId)?.els.push(...copies)
    })
    set({ sel: { abId, elIds: copies.map((c) => c.id) } })
  },

  addArtboard: (name, w, h) => {
    const { doc } = get()
    if (!doc) return null
    const last = doc.artboards[doc.artboards.length - 1]
    const ab = newArtboard(name ?? `Screen ${doc.artboards.length + 1}`, w ?? last?.w ?? 360, h ?? last?.h ?? 800, last?.bg ?? '#FFFFFF', last ? last.x + last.w + 60 : 0, last?.y ?? 0)
    get().commit((d) => {
      d.artboards.push(ab)
    })
    set({ sel: { abId: ab.id, elIds: [] } })
    return ab.id
  },

  duplicateArtboard: (abId) => {
    const { doc } = get()
    const src = doc?.artboards.find((a) => a.id === abId)
    if (!doc || !src) return
    const copy: Artboard = { ...src, id: uid(), name: `${src.name} copy`, x: src.x + src.w + 60, els: src.els.map((e) => ({ ...cloneEl(e), name: e.name })) }
    get().commit((d) => {
      d.artboards.push(copy)
    })
    set({ sel: { abId: copy.id, elIds: [] } })
  },

  removeArtboard: (abId) => {
    const { doc } = get()
    if (!doc || doc.artboards.length <= 1) return
    get().commit((d) => {
      d.artboards = d.artboards.filter((a) => a.id !== abId)
      if (d.startId === abId) d.startId = d.artboards[0].id
    })
  },

  moveArtboardOrder: (abId, dir) =>
    get().commit((d) => {
      const i = d.artboards.findIndex((a) => a.id === abId)
      const j = i + dir
      if (i < 0 || j < 0 || j >= d.artboards.length) return
      ;[d.artboards[i], d.artboards[j]] = [d.artboards[j], d.artboards[i]]
    }),

  patchArtboard: (abId, patch, key) =>
    get().commit((d) => {
      const a = d.artboards.find((x) => x.id === abId)
      if (a) Object.assign(a, patch)
    }, key ? `${key}:${abId}` : undefined),

  rename: (name) =>
    get().commit((d) => {
      d.name = name
    }, 'rename'),
}))

export const selectedEls = (s: { doc: Doc | null; sel: Sel }): El[] => {
  const ab = s.doc?.artboards.find((a) => a.id === s.sel.abId)
  return ab ? ab.els.filter((e) => s.sel.elIds.includes(e.id)) : []
}
