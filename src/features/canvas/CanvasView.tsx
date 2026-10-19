import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Group, Layer, Rect, Shape, Stage, Transformer } from 'react-konva'
import Konva from 'konva'
import { useEditor } from '../../state/editor'
import { useUI } from '../../state/ui'
import type { Artboard } from '../../engine/types'
import ElNode from './ElNode'
import FloatBar from './FloatBar'
import PickerOverlay from './PickerOverlay'
import { BoxSelect } from 'lucide-react'
import { stageHandle } from './handle'

Konva.hitOnDragEnabled = true
// phones report 3x density: 2x looks the same on a canvas but is ~45% fewer pixels to repaint
if (typeof window !== 'undefined') Konva.pixelRatio = Math.min(window.devicePixelRatio || 1, 2)

/** Canva-like handles: round corners, pill-shaped sides, round rotate button below the element. `k` shrinks them on small elements. */
function makeStyleAnchor(k: number) {
  return function styleAnchor(a: Konva.Rect) {
    const side = (w: number, h: number) => {
      a.width(w)
      a.height(h)
      a.offsetX(w / 2)
      a.offsetY(h / 2)
      a.cornerRadius(Math.min(w, h) / 2)
    }
    if (a.hasName('top-center') || a.hasName('bottom-center')) side(34 * k, 11 * k)
    else if (a.hasName('middle-left') || a.hasName('middle-right')) side(11 * k, 34 * k)
    else if (a.hasName('rotater')) {
      const D = 32 * k
      const r = D / 2
      const u = k
      side(D, D)
      a.sceneFunc((ctx: any, shape: any) => {
        ctx.beginPath()
        ctx.arc(r, r, r, 0, Math.PI * 2)
        ctx.closePath()
        ctx.fillStrokeShape(shape)
        const c = ctx._context as CanvasRenderingContext2D
        c.save()
        c.strokeStyle = '#171717'
        c.fillStyle = '#171717'
        c.lineWidth = 1.8 * u
        c.lineCap = 'round'
        c.beginPath()
        c.arc(r, r, 6.5 * u, Math.PI * 0.15, Math.PI * 1.05)
        c.stroke()
        c.beginPath()
        c.arc(r, r, 6.5 * u, Math.PI * 1.15, Math.PI * 2.05)
        c.stroke()
        c.beginPath()
        c.moveTo(r + 9.5 * u, r + 1 * u)
        c.lineTo(r + 3.5 * u, r + 1 * u)
        c.lineTo(r + 6.5 * u, r + 5 * u)
        c.fill()
        c.beginPath()
        c.moveTo(r - 9.5 * u, r - 1 * u)
        c.lineTo(r - 3.5 * u, r - 1 * u)
        c.lineTo(r - 6.5 * u, r - 5 * u)
        c.fill()
        c.restore()
      })
      a.hitFunc((ctx: any, shape: any) => {
        ctx.beginPath()
        ctx.arc(r, r, r + 6, 0, Math.PI * 2)
        ctx.closePath()
        ctx.fillStrokeShape(shape)
      })
    } else {
      side(18 * k, 18 * k)
    }
    a.shadowColor('rgba(0,0,0,0.35)')
    a.shadowBlur(4)
    a.shadowOffsetY(1)
  }
}

export { stageHandle }

interface View {
  x: number
  y: number
  s: number
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

const PAD_X = 20
const PAD_TOP = 10
const PAD_BOTTOM = 30 // room for the page dots

/** Zoom that fits a whole screen in the viewport. */
function fitScale(a: { w: number; h: number }, size: { w: number; h: number }) {
  return clamp(Math.min((size.w - PAD_X * 2) / a.w, (size.h - PAD_TOP - PAD_BOTTOM - 20) / a.h), 0.05, 3)
}

/** The screen stays put like a Canva page: centred when it fits, otherwise it can only be panned within its own edges. */
function clampView(v: View): View {
  const size = sizeRef_.current
  const doc = useEditor.getState().doc
  if (!doc || size.w < 50 || size.h < 120) return v
  const id = useEditor.getState().sel.abId
  const a = doc.artboards.find((x) => x.id === id) ?? doc.artboards[0]
  const s = clamp(v.s, fitScale(a, size) * 0.999, 6)
  const aw = a.w * s
  const ah = a.h * s
  const areaH = size.h - PAD_TOP - PAD_BOTTOM
  const x = aw <= size.w - PAD_X * 2 + 0.5 ? (size.w - aw) / 2 - a.x * s : clamp(v.x, size.w - PAD_X - (a.x + a.w) * s, PAD_X - a.x * s)
  const y = ah <= areaH - 20 + 0.5 ? PAD_TOP + (areaH - ah) / 2 - a.y * s : clamp(v.y, size.h - PAD_BOTTOM - 10 - (a.y + a.h) * s, PAD_TOP + 10 - a.y * s)
  return { s, x, y }
}
const sizeRef_ = { current: { w: 320, h: 480 } }

/** Only the active screen is visible on the canvas; exports temporarily reveal the one they need. */
function withOnlyVisible<T>(st: Konva.Stage, abId: string, fn: () => T): T {
  const groups = st.find('.abgroup')
  const prev = groups.map((g) => g.visible())
  groups.forEach((g) => g.visible(g.id() === 'grp-' + abId))
  try {
    return fn()
  } finally {
    groups.forEach((g, i) => g.visible(prev[i]))
  }
}

/** Renders a small PNG of the first artboard (used for project thumbnails). */
export function makeThumbnail(): string | undefined {
  const st = stageHandle.stage
  const doc = useEditor.getState().doc
  if (!st || !doc) return undefined
  const ab = doc.artboards[0]
  const prev = { sx: st.scaleX(), sy: st.scaleY(), x: st.x(), y: st.y() }
  const tr = st.findOne('Transformer') as Konva.Transformer | undefined
  try {
    tr?.visible(false)
    st.scale({ x: 1, y: 1 })
    st.position({ x: 0, y: 0 })
    return withOnlyVisible(st, ab.id, () => st.toDataURL({ x: ab.x, y: ab.y, width: ab.w, height: ab.h, pixelRatio: Math.min(2, 480 / ab.h), mimeType: 'image/jpeg', quality: 0.7 }))
  } catch {
    return undefined
  } finally {
    st.scale({ x: prev.sx, y: prev.sy })
    st.position({ x: prev.x, y: prev.y })
    tr?.visible(true)
    st.batchDraw()
  }
}

export function renderArtboardImage(abId: string, pixelRatio: number, mime: 'image/png' | 'image/jpeg', transparent: boolean): string | undefined {
  const st = stageHandle.stage
  const doc = useEditor.getState().doc
  const ab = doc?.artboards.find((a) => a.id === abId)
  if (!st || !ab) return undefined
  const prev = { sx: st.scaleX(), sy: st.scaleY(), x: st.x(), y: st.y() }
  const tr = st.findOne('Transformer') as Konva.Transformer | undefined
  const bg = st.findOne('#bg-' + abId)
  const grid = st.find('.grid').concat(st.find('.abshadow'))
  try {
    tr?.visible(false)
    grid.forEach((g) => g.visible(false))
    if (transparent && mime === 'image/png') bg?.visible(false)
    st.scale({ x: 1, y: 1 })
    st.position({ x: 0, y: 0 })
    return withOnlyVisible(st, ab.id, () => st.toDataURL({ x: ab.x, y: ab.y, width: ab.w, height: ab.h, pixelRatio, mimeType: mime, quality: 0.92 }))
  } finally {
    bg?.visible(true)
    grid.forEach((g) => g.visible(true))
    st.scale({ x: prev.sx, y: prev.sy })
    st.position({ x: prev.x, y: prev.y })
    tr?.visible(true)
    st.batchDraw()
  }
}

/** Elements of one screen. Callbacks are stable so memoised ElNodes skip re-rendering while zooming, panning or editing other elements. */
const ArtEls = memo(function ArtEls({ ab }: { ab: Artboard }) {
  const elsRef = useRef(ab.els)
  elsRef.current = ab.els
  const abId = ab.id
  const getSiblings = useCallback(() => elsRef.current, [])
  const groupOf = useCallback((id: string) => {
    const g = elsRef.current.find((e) => e.id === id)?.groupId
    return g ? elsRef.current.filter((e) => e.groupId === g).map((e) => e.id) : [id]
  }, [])
  /** Returns true when the element was already part of the selection before this press. */
  const onSelect = useCallback(
    (id: string, add: boolean): boolean => {
      const st = useEditor.getState()
      const cur = st.sel
      const ids = groupOf(id)
      const was = cur.abId === abId && cur.elIds.includes(id)
      if (add && cur.abId === abId) {
        if (!was) st.select(abId, [...new Set([...cur.elIds, ...ids])])
      } else if (!(was && cur.elIds.length > 1)) st.select(abId, ids)
      return was
    },
    [abId, groupOf],
  )
  const onToggleOff = useCallback(
    (id: string) => {
      const st = useEditor.getState()
      if (st.sel.abId !== abId) return
      const ids = groupOf(id)
      st.select(abId, st.sel.elIds.filter((i) => !ids.includes(i)))
    },
    [abId, groupOf],
  )
  const onLongPress = useCallback(
    (id: string) => {
      const st = useEditor.getState()
      const cur = st.sel.abId === abId ? st.sel.elIds : []
      useUI.getState().setMulti(true)
      st.select(abId, [...new Set([...cur, ...groupOf(id)])])
    },
    [abId, groupOf],
  )
  // while one of several selected elements is dragged, the others follow live
  const dragStart = useRef<{ id: string; x: number; y: number; others: { n: Konva.Node; x: number; y: number }[] } | null>(null)
  const onDragStartSel = useCallback(
    (id: string) => {
      const st = useEditor.getState()
      const stage = stageHandle.stage
      dragStart.current = null
      if (!stage || st.sel.abId !== abId || !st.sel.elIds.includes(id) || st.sel.elIds.length < 2) return
      const me = stage.findOne('#' + id)
      if (!me) return
      const others = st.sel.elIds
        .filter((o) => o !== id)
        .map((o) => stage.findOne('#' + o))
        .filter(Boolean)
        .map((n) => ({ n: n as Konva.Node, x: (n as Konva.Node).x(), y: (n as Konva.Node).y() }))
      dragStart.current = { id, x: me.x(), y: me.y(), others }
    },
    [abId],
  )
  const onDragMoveSel = useCallback((id: string, x: number, y: number) => {
    const d = dragStart.current
    if (!d || d.id !== id) return
    for (const o of d.others) {
      o.n.x(o.x + (x - d.x))
      o.n.y(o.y + (y - d.y))
    }
  }, [])
  const onMoved = useCallback(
    (id: string, x: number, y: number) => {
      const st = useEditor.getState()
      const base = elsRef.current.find((e) => e.id === id)
      if (!base) return
      // dragging one of several selected elements moves all of them by the same delta
      const dx = x - base.x
      const dy = y - base.y
      const ids = st.sel.elIds.includes(id) && st.sel.abId === abId ? st.sel.elIds : [id]
      st.commit((d) => {
        const a = d.artboards.find((q) => q.id === abId)
        if (!a) return
        for (const e of a.els)
          if (ids.includes(e.id)) {
            e.x = Math.round((e.x + dx) * 10) / 10
            e.y = Math.round((e.y + dy) * 10) / 10
          }
      })
    },
    [abId],
  )
  const onDbl = useCallback(
    (id: string) => {
      const el = elsRef.current.find((x) => x.id === id)
      if (el?.type === 'text' && window.innerWidth < 900) useUI.getState().setCtx('edit')
      else useUI.getState().setSheet('props')
    },
    [],
  )
  const onAutoHeight = useCallback((id: string, h: number) => useEditor.getState().syncH(abId, id, h), [abId])
  return (
    <>
      {ab.els.map((el) => (
        <ElNode key={el.id} el={el} interactive abW={ab.w} abH={ab.h} getSiblings={getSiblings} onSelect={onSelect} onToggleOff={onToggleOff} onMoved={onMoved} onDbl={onDbl} onAutoHeight={onAutoHeight} onLongPress={onLongPress} onDragStartSel={onDragStartSel} onDragMoveSel={onDragMoveSel} />
      ))}
    </>
  )
})

export default function CanvasView() {
  const doc = useEditor((s) => s.doc)!
  const sel = useEditor((s) => s.sel)
  const grid = useUI((s) => s.grid)
  const wrap = useRef<HTMLDivElement>(null)
  const trRef = useRef<Konva.Transformer>(null)
  const [size, setSize] = useState({ w: 320, h: 480 })
  const [view, setView] = useState<View>({ x: 16, y: 40, s: 0.6 })
  const activeId = doc.artboards.some((a) => a.id === sel.abId) ? (sel.abId as string) : doc.artboards[0].id
  const activeAb = doc.artboards.find((a) => a.id === activeId)!
  const viewRef = useRef(view)
  const fitRef = useRef(0)
  const [busy, setBusy] = useState(false)
  const [moving, setMoving] = useState(false)
  const movingT = useRef(0)
  const badge = useRef<HTMLDivElement>(null)
  sizeRef_.current = size
  const rafRef = useRef(0)
  const animRef = useRef(0)
  const pinch = useRef<{ d: number; cx: number; cy: number } | null>(null)
  const pan = useRef<{ x: number; y: number; moved: number } | null>(null)
  const multi = useUI((s) => s.multi)
  const picker = useUI((s) => s.picker)
  const mq = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const mqRect = useRef<Konva.Rect>(null)

  // Live view changes go straight to the Konva stage (no React render per pointer move),
  // then sync to React state once per frame. This keeps panning smooth and jitter-free.
  const moveView = useCallback((v0: View) => {
    const v = clampView(v0)
    viewRef.current = v
    const st = stageHandle.stage
    if (st) {
      st.position({ x: v.x, y: v.y })
      st.scale({ x: v.s, y: v.s })
      st.batchDraw()
    }
    if (badge.current) badge.current.textContent = Math.round(v.s * 100) + '%'
    // React only hears about the new view when the gesture settles: no re-render per frame
    setMoving((m) => m || true)
    clearTimeout(movingT.current)
    movingT.current = window.setTimeout(() => {
      setView(viewRef.current)
      setMoving(false)
    }, 140)
  }, [])

  const animateTo = useCallback(
    (to: View, animate = true) => {
      cancelAnimationFrame(animRef.current)
      const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!animate || reduce) return moveView(to)
      const from = { ...viewRef.current }
      const t0 = performance.now()
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / 220)
        const e = 1 - Math.pow(1 - k, 3)
        moveView({ s: from.s + (to.s - from.s) * e, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e })
        if (k < 1) animRef.current = requestAnimationFrame(step)
      }
      animRef.current = requestAnimationFrame(step)
    },
    [moveView],
  )

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current)
      cancelAnimationFrame(animRef.current)
      clearTimeout(movingT.current)
    },
    [],
  )

  /** Put one screen back in the middle at "fit" zoom. */
  const focusAb = useCallback(
    (id: string, animate = false) => {
      const a = useEditor.getState().doc?.artboards.find((x) => x.id === id)
      const sz = sizeRef_.current
      if (!a || sz.w < 50) return
      const s = fitScale(a, sz)
      fitRef.current = s
      const areaH = sz.h - PAD_TOP - PAD_BOTTOM
      animateTo({ s, x: (sz.w - a.w * s) / 2 - a.x * s, y: PAD_TOP + (areaH - a.h * s) / 2 - a.y * s }, animate)
    },
    [animateTo],
  )

  const fit = useCallback(() => focusAb(useEditor.getState().sel.abId ?? useEditor.getState().doc?.artboards[0]?.id ?? '', true), [focusAb])

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // the Android WebView can drop canvas pixels while the app is in the background: repaint when it comes back
  useEffect(() => {
    const redraw = () => {
      if (document.visibilityState !== 'visible') return
      const st = stageHandle.stage
      if (!st) return
      st.getLayers().forEach((l) => l.draw())
      moveView(viewRef.current)
    }
    document.addEventListener('visibilitychange', redraw)
    window.addEventListener('pageshow', redraw)
    window.addEventListener('focus', redraw)
    return () => {
      document.removeEventListener('visibilitychange', redraw)
      window.removeEventListener('pageshow', redraw)
      window.removeEventListener('focus', redraw)
    }
  }, [moveView])

  // redraw once bundled web fonts are ready so text measures with the real font
  useEffect(() => {
    void (document as any).fonts?.ready?.then(() => stageHandle.stage?.batchDraw())
  }, [])

  // opening a project, switching screen, resizing a screen or rotating the phone: show that screen centred at fit zoom
  useEffect(() => {
    if (size.w > 50 && size.h > 120) focusAb(activeId)
  }, [doc.id, activeId, activeAb.w, activeAb.h, size.w, focusAb])

  // panels opening/closing resize the canvas: keep the user's zoom unless the screen was simply fitted
  useEffect(() => {
    if (size.w <= 50 || size.h <= 120) return
    const atFit = viewRef.current.s <= fitRef.current * 1.02
    if (atFit) focusAb(activeId)
    else moveView(viewRef.current)
  }, [size.h])

  useEffect(() => {
    const h = () => fit()
    const f = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      if (useEditor.getState().sel.abId !== id) useEditor.getState().select(id, [])
      focusAb(id)
    }
    window.addEventListener('tuika-fit', h)
    window.addEventListener('tuika-focus', f)
    return () => {
      window.removeEventListener('tuika-fit', h)
      window.removeEventListener('tuika-focus', f)
    }
  }, [fit, focusAb])

  // attach transformer to selected (unlocked) nodes
  useEffect(() => {
    const tr = trRef.current
    const st = stageHandle.stage
    if (!tr || !st) return
    const ab = doc.artboards.find((a) => a.id === sel.abId)
    const nodes = (ab?.els ?? [])
      .filter((e) => sel.elIds.includes(e.id) && !e.locked && e.visible)
      .map((e) => st.findOne('#' + e.id))
      .filter(Boolean) as Konva.Node[]
    tr.nodes(nodes)
    tr.getLayer()?.batchDraw()
  }, [sel, doc])

  const zoomAt = (px: number, py: number, factor: number) => {
    const v = viewRef.current
    const s = clamp(v.s * factor, 0.05, 6) // lower bound enforced by clampView
    const k = s / v.s
    moveView({ s, x: px - (px - v.x) * k, y: py - (py - v.y) * k })
  }

  const onWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const p = stageHandle.stage!.getPointerPosition()
    if (!p) return
    if (e.evt.ctrlKey || e.evt.metaKey) zoomAt(p.x, p.y, e.evt.deltaY < 0 ? 1.08 : 1 / 1.08)
    else {
      const v = viewRef.current
      moveView({ ...v, x: v.x - e.evt.deltaX, y: v.y - e.evt.deltaY })
    }
  }

  const touchDist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)

  const panBy = (x: number, y: number) => {
    const p = pan.current
    if (!p) return
    const dx = x - p.x
    const dy = y - p.y
    p.x = x
    p.y = y
    p.moved += Math.abs(dx) + Math.abs(dy)
    const v = viewRef.current
    moveView({ ...v, x: v.x + dx, y: v.y + dy })
  }

  // drag-select (only while "select multiple" is on)
  const docPoint = () => {
    const st = stageHandle.stage
    const p = st?.getPointerPosition()
    if (!st || !p) return null
    return { x: (p.x - st.x()) / st.scaleX(), y: (p.y - st.y()) / st.scaleY() }
  }
  const moveMarquee = () => {
    const m = mq.current
    const r = mqRect.current
    const p = docPoint()
    if (!m || !r || !p) return
    m.moved = m.moved || Math.hypot(p.x - m.x, p.y - m.y) * viewRef.current.s > 6
    if (!m.moved) return
    r.setAttrs({ visible: true, x: Math.min(m.x, p.x), y: Math.min(m.y, p.y), width: Math.abs(p.x - m.x), height: Math.abs(p.y - m.y), strokeWidth: 1.2 / viewRef.current.s, dash: [4 / viewRef.current.s, 3 / viewRef.current.s] })
    r.getLayer()?.batchDraw()
  }
  const endMarquee = () => {
    const m = mq.current
    const r = mqRect.current
    mq.current = null
    if (!m || !r) return
    const box = { x: r.x(), y: r.y(), w: r.width(), h: r.height() }
    const was = m.moved
    r.visible(false)
    r.getLayer()?.batchDraw()
    if (!was) return
    const st = useEditor.getState()
    const ab = st.doc?.artboards.find((a) => a.id === st.sel.abId)
    if (!ab) return
    const hit = ab.els.filter((e) => e.visible && !e.locked && e.x + e.w >= box.x - ab.x && e.x <= box.x + box.w - ab.x && e.y + e.h >= box.y - ab.y && e.y <= box.y + box.h - ab.y)
    const ids = new Set(hit.map((e) => e.id))
    for (const e of hit) if (e.groupId) for (const o of ab.els) if (o.groupId === e.groupId && !o.locked) ids.add(o.id)
    st.select(ab.id, [...ids])
  }

  const onTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const t = e.evt.touches
    if (mq.current && t.length === 1) {
      e.evt.preventDefault()
      moveMarquee()
      return
    }
    if (t.length === 2) {
      mq.current = null
      mqRect.current?.visible(false)
      e.evt.preventDefault()
      ;(Konva as any).DD?.node?.stopDrag?.()
      const rect = wrap.current!.getBoundingClientRect()
      const cx = (t[0].clientX + t[1].clientX) / 2 - rect.left
      const cy = (t[0].clientY + t[1].clientY) / 2 - rect.top
      const d = touchDist(t)
      const last = pinch.current
      if (last) {
        const v = viewRef.current
        const s = clamp(v.s * (d / last.d), 0.05, 6)
        const k = s / v.s
        moveView({ s, x: cx - (last.cx - v.x) * k, y: cy - (last.cy - v.y) * k })
      }
      pinch.current = { d, cx, cy }
      pan.current = null
    } else if (t.length === 1 && pan.current) {
      e.evt.preventDefault()
      panBy(t[0].clientX, t[0].clientY)
    }
  }

  // Swiping on an empty area or on a screen's background pans the workspace; dragging an element moves it.
  const bgDown = (e: Konva.KonvaEventObject<any>) => {
    const t = e.target
    const isStage = t === stageHandle.stage
    if (!isStage && t.name() !== 'abbg') return
    cancelAnimationFrame(animRef.current)
    if (isStage) useEditor.getState().select(useEditor.getState().sel.abId, [])
    const ev = e.evt
    if (useUI.getState().multi) {
      if (!('touches' in ev) || ev.touches.length === 1) {
        const p = docPoint()
        if (p) mq.current = { x: p.x, y: p.y, moved: false }
      }
      return
    }
    if ('touches' in ev) {
      if (ev.touches.length === 1) pan.current = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, moved: 0 }
    } else pan.current = { x: (ev as MouseEvent).clientX, y: (ev as MouseEvent).clientY, moved: 0 }
  }
  const onMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (mq.current) moveMarquee()
    else panBy(e.evt.clientX, e.evt.clientY)
  }

  const endGesture = () => {
    endMarquee()
    pan.current = null
    pinch.current = null
  }

  const onTransformEnd = () => {
    const tr = trRef.current
    if (!tr) return
    const st = useEditor.getState()
    const abId = st.sel.abId
    const nodes = tr.nodes()
    const patches = new Map<string, any>()
    for (const n of nodes) {
      const el = st.doc?.artboards.find((a) => a.id === abId)?.els.find((e) => e.id === n.id())
      if (!el) continue
      const sx = n.scaleX()
      const sy = n.scaleY()
      n.scaleX(1)
      n.scaleY(1)
      const base = { x: Math.round(n.x() * 10) / 10, y: Math.round(n.y() * 10) / 10, rotation: Math.round(n.rotation() * 10) / 10 }
      if (el.type === 'text') {
        // corners scale the font like Canva, side handles only change the line width; height follows the content
        const corner = Math.abs(sx - sy) < 0.03
        const f = corner ? sx : sy !== 1 && Math.abs(sx - 1) < 0.03 ? sy : 1
        patches.set(el.id, { ...base, w: Math.max(8, Math.round(el.w * sx * 10) / 10), fontSize: Math.max(4, Math.round((el.fontSize ?? 16) * f)) })
        continue
      }
      patches.set(el.id, {
        ...base,
        w: Math.max(1, Math.round(el.w * sx * 10) / 10),
        h: el.type === 'line' || el.type === 'arrow' ? Math.round(el.h * sy * 10) / 10 : Math.max(1, Math.round(el.h * sy * 10) / 10),
      })
    }
    st.commit((d) => {
      const ab = d.artboards.find((a) => a.id === abId)
      if (!ab) return
      for (const e of ab.els) if (patches.has(e.id)) Object.assign(e, patches.get(e.id))
    })
  }

  const store = useEditor.getState

  // handles shrink (and the side ones disappear) when the selected element is small on screen
  const box = useMemo(() => {
    const ab = doc.artboards.find((a) => a.id === sel.abId)
    const picked = (ab?.els ?? []).filter((e) => sel.elIds.includes(e.id) && !e.locked && e.visible)
    if (!picked.length) return { w: 999, h: 999 }
    let x1 = Infinity
    let y1 = Infinity
    let x2 = -Infinity
    let y2 = -Infinity
    for (const e of picked) {
      x1 = Math.min(x1, e.x)
      y1 = Math.min(y1, e.y)
      x2 = Math.max(x2, e.x + e.w)
      y2 = Math.max(y2, e.y + e.h)
    }
    return { w: (x2 - x1) * view.s, h: (y2 - y1) * view.s }
  }, [doc, sel, view.s])
  const k = clamp(Math.min(box.w, box.h) / 110, 0.5, 1)
  const styleAnchor = useMemo(() => makeStyleAnchor(k), [k])
  const anchors = useMemo(() => {
    const a = ['top-left', 'top-right', 'bottom-left', 'bottom-right']
    if (box.w >= 64) a.push('top-center', 'bottom-center')
    if (box.h >= 64) a.push('middle-left', 'middle-right')
    return a
  }, [box.w >= 64, box.h >= 64])

  return (
    <div className="canvas-wrap" ref={wrap}>
      <Stage
        ref={(r: any) => {
          stageHandle.stage = r
        }}
        width={Math.max(1, size.w)}
        height={Math.max(1, size.h)}
        x={view.x}
        y={view.y}
        scaleX={view.s}
        scaleY={view.s}
        onWheel={onWheel}
        onMouseDown={bgDown}
        onTouchStart={bgDown}
        onMouseMove={onMouseMove}
        onTouchMove={onTouchMove}
        onMouseUp={endGesture}
        onTouchEnd={endGesture}
        onMouseLeave={endGesture}
        onDragStart={() => setBusy(true)}
        onDragEnd={() => setBusy(false)}
      >
        <Layer>
          {doc.artboards.map((ab) => {
            const active = ab.id === activeId
            return (
              <Group key={ab.id} id={'grp-' + ab.id} name="abgroup" x={ab.x} y={ab.y} visible={active} listening={active}>
                <Rect name="abshadow" x={-4} y={-4} width={ab.w + 8} height={ab.h + 8} cornerRadius={4} fill="rgba(0,0,0,0.035)" listening={false} perfectDrawEnabled={false} />
                <Rect name="abshadow" x={-1.5} y={-1.5} width={ab.w + 3} height={ab.h + 3} cornerRadius={2} fill="rgba(0,0,0,0.05)" listening={false} perfectDrawEnabled={false} />
                <Rect
                  id={'bg-' + ab.id}
                  name="abbg"
                  width={ab.w}
                  height={ab.h}
                  fill={ab.bg}
                  perfectDrawEnabled={false}
                  onMouseDown={(e) => {
                    store().select(ab.id, [])
                  }}
                  onTouchStart={(e) => {
                    if (e.evt.touches.length > 1) return
                    store().select(ab.id, [])
                  }}
                />
                {grid && (
                  <Shape
                    name="grid"
                    listening={false}
                    sceneFunc={(ctx: any, shape: any) => {
                      ctx.beginPath()
                      for (let x = 8; x < ab.w; x += 8) {
                        ctx.moveTo(x, 0)
                        ctx.lineTo(x, ab.h)
                      }
                      for (let y = 8; y < ab.h; y += 8) {
                        ctx.moveTo(0, y)
                        ctx.lineTo(ab.w, y)
                      }
                      ctx.strokeShape(shape)
                    }}
                    stroke="rgba(23,23,23,0.10)"
                    strokeWidth={0.5 / view.s}
                  />
                )}
                <Group clipX={0} clipY={0} clipWidth={ab.w} clipHeight={ab.h}>
                  <ArtEls ab={ab} />
                </Group>
              </Group>
            )
          })}
        </Layer>
        <Layer>
          <Transformer
            ref={trRef}
            rotateEnabled
            keepRatio
            borderStroke="#171717"
            borderStrokeWidth={1.5}
            anchorStroke="#a1a1aa"
            anchorStrokeWidth={1.5}
            anchorFill="#FFFFFF"
            anchorSize={18 * k}
            anchorCornerRadius={9 * k}
            enabledAnchors={anchors}
            rotateAnchorAngle={180}
            rotateAnchorOffset={34 * k}
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            ignoreStroke
            anchorStyleFunc={styleAnchor}
            onTransformStart={() => setBusy(true)}
            onTransformEnd={() => {
              setBusy(false)
              onTransformEnd()
            }}
            boundBoxFunc={(o, n) => (Math.abs(n.width) < 4 ? o : n)}
          />
          <Rect ref={mqRect} visible={false} listening={false} stroke="#171717" fill="rgba(23,23,23,0.07)" strokeWidth={1} />
        </Layer>
      </Stage>
      <FloatBar view={view} size={size} busy={busy || moving} />
      <button
        className={'multi-btn' + (multi ? ' on' : '')}
        aria-pressed={multi}
        aria-label="Select multiple elements"
        title="Select multiple"
        onClick={() => {
          const on = !useUI.getState().multi
          useUI.getState().setMulti(on)
          if (on) useUI.getState().say('Tap elements to add them, or drag on empty space to select an area')
        }}
      >
        <BoxSelect size={20} />
      </button>
      {picker && <PickerOverlay />}
      <div className="zoom-badge" aria-live="polite" ref={badge}>
        {Math.round(view.s * 100)}%
      </div>
      <button className="fit-btn" aria-label="Fit screen to view" onClick={fit}>
        Fit
      </button>
      {doc.artboards.length > 1 && (
        <div className="pager" role="tablist" aria-label="Screens">
          {doc.artboards.map((a) => (
            <button
              key={a.id}
              role="tab"
              aria-selected={a.id === activeId}
              aria-label={`Go to ${a.name}`}
              className={'pgdot' + (a.id === activeId ? ' on' : '')}
              onClick={() => {
                useEditor.getState().select(a.id, [])
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
