import { useCallback, useEffect, useRef, useState } from 'react'
import { Group, Layer, Rect, Shape, Stage, Text, Transformer } from 'react-konva'
import Konva from 'konva'
import { useEditor } from '../../state/editor'
import { useUI } from '../../state/ui'
import ElNode from './ElNode'

Konva.hitOnDragEnabled = true

export const stageHandle: { stage: Konva.Stage | null } = { stage: null }

interface View {
  x: number
  y: number
  s: number
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

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
    return st.toDataURL({ x: ab.x, y: ab.y, width: ab.w, height: ab.h, pixelRatio: Math.min(1, 240 / ab.h), mimeType: 'image/jpeg', quality: 0.7 })
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
    return st.toDataURL({ x: ab.x, y: ab.y, width: ab.w, height: ab.h, pixelRatio, mimeType: mime, quality: 0.92 })
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
  const viewRef = useRef(view)
  const rafRef = useRef(0)
  const animRef = useRef(0)
  const pinch = useRef<{ d: number; cx: number; cy: number } | null>(null)
  const pan = useRef<{ x: number; y: number; moved: number } | null>(null)

  // Live view changes go straight to the Konva stage (no React render per pointer move),
  // then sync to React state once per frame. This keeps panning smooth and jitter-free.
  const moveView = useCallback((v: View) => {
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

  const focusScale = (a: { w: number; h: number }) => clamp(Math.min((size.w - 40) / a.w, (size.h - 76) / a.h), 0.05, 3)

  /** Centre one screen in the viewport (like swiping to a page in Canva). */
  const focusAb = useCallback(
    (id: string, animate = true) => {
      const a = useEditor.getState().doc?.artboards.find((x) => x.id === id)
      if (!a || size.w < 50) return
      const s = clamp(Math.min((size.w - 40) / a.w, (size.h - 76) / a.h), 0.05, 3)
      animateTo({ s, x: (size.w - a.w * s) / 2 - a.x * s, y: (size.h - 30 - a.h * s) / 2 - a.y * s + 10 }, animate)
    },
    [size.w, size.h, animateTo],
  )

  const fit = useCallback(() => {
    const d = useEditor.getState().doc
    if (!d || size.w < 50) return
    const minX = Math.min(...d.artboards.map((a) => a.x))
    const minY = Math.min(...d.artboards.map((a) => a.y))
    const maxX = Math.max(...d.artboards.map((a) => a.x + a.w))
    const maxY = Math.max(...d.artboards.map((a) => a.y + a.h))
    const pad = 28
    const s = clamp(Math.min((size.w - pad * 2) / (maxX - minX), (size.h - pad * 2 - 30) / (maxY - minY)), 0.05, 3)
    animateTo({ s, x: (size.w - (maxX - minX) * s) / 2 - minX * s, y: (size.h - 30 - (maxY - minY) * s) / 2 - minY * s + 14 })
  }, [size.w, size.h, animateTo])

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

  // when a project opens, centre its first screen
  const fitted = useRef<string>('')
  useEffect(() => {
    if (fitted.current !== doc.id && size.w > 50) {
      fitted.current = doc.id
      focusAb(doc.artboards[0].id, false)
    }
  }, [doc.id, doc.artboards, size.w, focusAb])

  useEffect(() => {
    const h = () => fit()
    const f = (e: Event) => focusAb((e as CustomEvent<string>).detail)
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
    const s = clamp(v.s * factor, 0.05, 6)
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

  /** After a swipe at "one screen" zoom, glide to the nearest screen so it sits centred. */
  const snapToNearest = () => {
    const d = useEditor.getState().doc
    if (!d || d.artboards.length < 2) return
    const v = viewRef.current
    const cx = (size.w / 2 - v.x) / v.s
    const cy = (size.h / 2 - v.y) / v.s
    let best = d.artboards[0]
    let bd = Infinity
    for (const a of d.artboards) {
      const dist = Math.hypot(a.x + a.w / 2 - cx, a.y + a.h / 2 - cy)
      if (dist < bd) {
        bd = dist
        best = a
      }
    }
    const fs = focusScale(best)
    if (v.s < fs * 0.8 || v.s > fs * 1.25) return
    if (useEditor.getState().sel.abId !== best.id) useEditor.getState().select(best.id, [])
    focusAb(best.id)
  }

  const endGesture = () => {
    const p = pan.current
    pan.current = null
    pinch.current = null
    if (p && p.moved > 8) snapToNearest()
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
      >
        <Layer>
          {doc.artboards.map((ab) => {
            const active = ab.id === sel.abId
            return (
              <Group key={ab.id} x={ab.x} y={ab.y}>
                <Text
                  name="abbg"
                  y={-18 / view.s}
                  text={ab.name + (doc.startId === ab.id ? '  (start)' : '')}
                  fontSize={12 / view.s}
                  fill={active ? '#171717' : '#737373'}
                  fontFamily="Inter, system-ui, sans-serif"
                  onMouseDown={(e) => {
                    store().select(ab.id, [])
                  }}
                  onTouchStart={(e) => {
                    store().select(ab.id, [])
                  }}
                />
                <Rect
                  id={'bg-' + ab.id}
                  name="abbg"
                  width={ab.w}
                  height={ab.h}
                  fill={ab.bg}
                  shadowColor="#000"
                  shadowBlur={10}
                  shadowOpacity={0.14}
                  stroke={active ? '#171717' : undefined}
                  strokeWidth={active ? 1.5 / view.s : 0}
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
                      onDbl={() => useUI.getState().setSheet('props')}
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
            keepRatio={false}
            borderStroke="#171717"
            anchorStroke="#171717"
            anchorFill="#FFFFFF"
            anchorSize={14}
            anchorCornerRadius={3}
            rotateAnchorOffset={26}
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            ignoreStroke
            onTransformEnd={onTransformEnd}
            boundBoxFunc={(o, n) => (Math.abs(n.width) < 4 || Math.abs(n.height) < 0 ? o : n)}
          />
        </Layer>
      </Stage>
      <div className="zoom-badge" aria-live="polite">
        {Math.round(view.s * 100)}%
      </div>
      <button className="fit-btn" aria-label="Show all screens" onClick={fit}>
        All
      </button>
      {doc.artboards.length > 1 && (
        <div className="pager" role="tablist" aria-label="Screens">
          {doc.artboards.map((a) => (
            <button
              key={a.id}
              role="tab"
              aria-selected={a.id === sel.abId}
              aria-label={`Go to ${a.name}`}
              className={'pgdot' + (a.id === sel.abId ? ' on' : '')}
              onClick={() => {
                useEditor.getState().select(a.id, [])
                focusAb(a.id)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
