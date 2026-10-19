import { useCallback, useEffect, useRef, useState } from 'react'
import { Group, Layer, Rect, Shape, Stage, Transformer } from 'react-konva'
import Konva from 'konva'
import { useEditor } from '../../state/editor'
import { useUI } from '../../state/ui'
import ElNode from './ElNode'
import FloatBar from './FloatBar'
import { stageHandle } from './handle'

Konva.hitOnDragEnabled = true

/** Canva-like handles: round corners, pill-shaped sides, round rotate button below the element. */
function styleAnchor(a: Konva.Rect) {
  const side = (w: number, h: number) => {
    a.width(w)
    a.height(h)
    a.offsetX(w / 2)
    a.offsetY(h / 2)
    a.cornerRadius(Math.min(w, h) / 2)
  }
  if (a.hasName('top-center') || a.hasName('bottom-center')) side(34, 11)
  else if (a.hasName('middle-left') || a.hasName('middle-right')) side(11, 34)
  else if (a.hasName('rotater')) {
    side(32, 32)
    a.sceneFunc((ctx: any, shape: any) => {
      const r = 16
      ctx.beginPath()
      ctx.arc(r, r, r, 0, Math.PI * 2)
      ctx.closePath()
      ctx.fillStrokeShape(shape)
      const c = ctx._context as CanvasRenderingContext2D
      c.save()
      c.strokeStyle = '#171717'
      c.lineWidth = 1.8
      c.lineCap = 'round'
      c.beginPath()
      c.arc(r, r, 6.5, Math.PI * 0.15, Math.PI * 1.05)
      c.stroke()
      c.beginPath()
      c.arc(r, r, 6.5, Math.PI * 1.15, Math.PI * 2.05)
      c.stroke()
      c.fillStyle = '#171717'
      c.beginPath()
      c.moveTo(r + 6.5 + 3, r + 1)
      c.lineTo(r + 6.5 - 3, r + 1)
      c.lineTo(r + 6.5, r + 5)
      c.fill()
      c.beginPath()
      c.moveTo(r - 6.5 - 3, r - 1)
      c.lineTo(r - 6.5 + 3, r - 1)
      c.lineTo(r - 6.5, r - 5)
      c.fill()
      c.restore()
    })
    a.hitFunc((ctx: any, shape: any) => {
      ctx.beginPath()
      ctx.arc(16, 16, 20, 0, Math.PI * 2)
      ctx.closePath()
      ctx.fillStrokeShape(shape)
    })
  } else {
    side(18, 18)
  }
  a.shadowColor('rgba(0,0,0,0.35)')
  a.shadowBlur(4)
  a.shadowOffsetY(1)
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
  const grid = st.find('.grid')
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
  sizeRef_.current = size
  const rafRef = useRef(0)
  const animRef = useRef(0)
  const pinch = useRef<{ d: number; cx: number; cy: number } | null>(null)
  const pan = useRef<{ x: number; y: number; moved: number } | null>(null)

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
    if (!rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0
        setView(viewRef.current)
      })
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

  const onTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    const t = e.evt.touches
    if (t.length === 2) {
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
    if ('touches' in ev) {
      if (ev.touches.length === 1) pan.current = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, moved: 0 }
    } else pan.current = { x: (ev as MouseEvent).clientX, y: (ev as MouseEvent).clientY, moved: 0 }
  }
  const onMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => panBy(e.evt.clientX, e.evt.clientY)

  const endGesture = () => {
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
      patches.set(el.id, {
        x: Math.round(n.x() * 10) / 10,
        y: Math.round(n.y() * 10) / 10,
        rotation: Math.round(n.rotation() * 10) / 10,
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
  const snapT = 8 / view.s

  return (
    <div className="canvas-wrap" ref={wrap}>
      <Stage
        ref={(r: any) => {
          stageHandle.stage = r
        }}
        width={size.w}
        height={size.h}
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
                <Rect
                  id={'bg-' + ab.id}
                  name="abbg"
                  width={ab.w}
                  height={ab.h}
                  fill={ab.bg}
                  shadowColor="#000"
                  shadowBlur={14}
                  shadowOpacity={0.12}
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
                  {ab.els.map((el) => (
                    <ElNode
                      key={el.id}
                      el={el}
                      interactive
                      abW={ab.w}
                      abH={ab.h}
                      siblings={ab.els}
                      snapT={snapT}
                      onSelect={(id, add) => {
                        const cur = store().sel
                        if (add && cur.abId === ab.id) {
                          const has = cur.elIds.includes(id)
                          store().select(ab.id, has ? cur.elIds.filter((i) => i !== id) : [...cur.elIds, id])
                        } else if (!(cur.abId === ab.id && cur.elIds.includes(id) && cur.elIds.length > 1)) store().select(ab.id, [id])
                      }}
                      onMoved={(id, x, y) => {
                        const cur = store().sel
                        // dragging one of several selected elements moves all of them by the same delta
                        const base = ab.els.find((e) => e.id === id)
                        if (!base) return
                        const dx = x - base.x
                        const dy = y - base.y
                        const ids = cur.elIds.includes(id) && cur.abId === ab.id ? cur.elIds : [id]
                        store().commit((d) => {
                          const a = d.artboards.find((q) => q.id === ab.id)
                          if (!a) return
                          for (const e of a.els) if (ids.includes(e.id)) {
                            e.x = Math.round((e.x + dx) * 10) / 10
                            e.y = Math.round((e.y + dy) * 10) / 10
                          }
                        })
                      }}
                      onDbl={(id) => {
                        const el = ab.els.find((x) => x.id === id)
                        if (el?.type === 'text' && window.innerWidth < 900) useUI.getState().setCtx('edit')
                        else useUI.getState().setSheet('props')
                      }}
                    />
                  ))}
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
            anchorSize={18}
            anchorCornerRadius={9}
            rotateAnchorAngle={180}
            rotateAnchorOffset={34}
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
        </Layer>
      </Stage>
      <FloatBar view={view} size={size} busy={busy} />
      <div className="zoom-badge" aria-live="polite">
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
