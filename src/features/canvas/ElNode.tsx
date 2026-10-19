import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Arrow, Image as KImage, Line, Rect, Shape, Text } from 'react-konva'
import type Konva from 'konva'
import type { El } from '../../engine/types'
import { svgToDataUrl } from '../../services/svg'
import { ensureFont } from '../../services/fonts'
import { useUI } from '../../state/ui'

// decoded bitmaps are the biggest memory cost: cap the cache by total pixels, not by count
const imgCache = new Map<string, HTMLImageElement>()
let cachePx = 0
const MAX_PX = 36_000_000
const px = (i: HTMLImageElement) => i.naturalWidth * i.naturalHeight

function remember(src: string, i: HTMLImageElement) {
  imgCache.set(src, i)
  cachePx += px(i)
  while (cachePx > MAX_PX && imgCache.size > 1) {
    const k = imgCache.keys().next().value as string
    if (k === src) break
    cachePx -= px(imgCache.get(k)!)
    imgCache.delete(k)
  }
}

export const getCachedImage = (src?: string) => (src ? imgCache.get(src) : undefined)

function useImg(src?: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(() => (src ? imgCache.get(src) ?? null : null))
  useEffect(() => {
    if (!src) return setImg(null)
    const hit = imgCache.get(src)
    if (hit) return setImg(hit)
    let ok = true
    const i = new window.Image()
    i.decoding = 'async'
    i.onload = () => {
      remember(src, i)
      if (ok) setImg(i)
    }
    i.onerror = () => ok && setImg(null)
    i.src = src
    return () => {
      ok = false
    }
  }, [src])
  return img
}

interface Props {
  el: El
  interactive: boolean
  abW: number
  abH: number
  siblings?: El[]
  getSiblings?: () => El[]
  /** Outline of the whole selection relative to this element, so a group snaps as one block. */
  getSnapBox?: (id: string) => { dx: number; dy: number; w: number; h: number } | null
  snapT?: number
  onSelect?: (id: string, additive: boolean) => boolean | void
  onToggleOff?: (id: string) => void
  onMoved?: (id: string, x: number, y: number) => void
  onDbl?: (id: string) => void
  onAutoHeight?: (id: string, h: number) => void
  onLongPress?: (id: string) => void
  onDragStartSel?: (id: string) => void
  onDragMoveSel?: (id: string, x: number, y: number) => void
  onLink?: (target: string) => void
}

/** Small elements are hard to tap at low zoom: give every shape a hit box that is at least ~40 screen px wide and tall. */
function hitBox(shape: any) {
  const k = shape.getStage()?.scaleX() || 1
  const w = shape.width()
  const h = shape.height()
  const px = Math.max(0, (40 / k - w) / 2)
  const py = Math.max(0, (40 / k - h) / 2)
  return { x: -px, y: -py, w: w + px * 2, h: h + py * 2 }
}
const slopHit = (ctx: any, shape: any) => {
  const b = hitBox(shape)
  ctx.beginPath()
  ctx.rect(b.x, b.y, b.w, b.h)
  ctx.closePath()
  ctx.fillShape(shape)
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** Konva fill props for a solid colour or a gradient. */
function fillProps(el: El): Record<string, any> {
  const g = el.fillGradient
  if (!g || g.stops.length < 2 || (el.type !== 'rect' && el.type !== 'ellipse' && el.type !== 'text')) return { fill: el.fill }
  const stops = g.stops.flatMap((s) => [s.pos, s.color])
  const w = Math.max(1, el.w)
  const h = Math.max(1, el.h)
  if (g.type === 'radial') {
    return {
      fill: undefined,
      fillPriority: 'radial-gradient',
      fillRadialGradientStartPoint: { x: w / 2, y: h / 2 },
      fillRadialGradientStartRadius: 0,
      fillRadialGradientEndPoint: { x: w / 2, y: h / 2 },
      fillRadialGradientEndRadius: Math.max(1, Math.hypot(w, h) / 2),
      fillRadialGradientColorStops: stops,
    }
  }
  const a = (g.angle * Math.PI) / 180
  const dx = Math.cos(a)
  const dy = Math.sin(a)
  const L = Math.abs((w / 2) * dx) + Math.abs((h / 2) * dy)
  return {
    fill: undefined,
    fillPriority: 'linear-gradient',
    fillLinearGradientStartPoint: { x: w / 2 - dx * L, y: h / 2 - dy * L },
    fillLinearGradientEndPoint: { x: w / 2 + dx * L, y: h / 2 + dy * L },
    fillLinearGradientColorStops: stops,
  }
}

function snap1(v: number, size: number, targets: number[], T: number) {
  let best = v
  let bd = T
  for (const t of targets)
    for (const off of [0, size / 2, size]) {
      const d = Math.abs(v + off - t)
      if (d < bd) {
        bd = d
        best = t - off
      }
    }
  return best
}

function ElNodeBase({ el, interactive, abW, abH, siblings, getSiblings, getSnapBox, onSelect, onToggleOff, onMoved, onDbl, onAutoHeight, onDragStartSel, onDragMoveSel, onLink }: Props) {
  const iconUrl = useMemo(() => (el.type === 'icon' && el.svg ? svgToDataUrl(el.svg, el.fill) : undefined), [el.type, el.svg, el.fill])
  const textRef = useRef<Konva.Text>(null)
  const downSel = useRef(false)
  const [fontTick, setFontTick] = useState(0)

  // Google fonts: load on demand, then re-measure the text
  useEffect(() => {
    if (el.type !== 'text') return
    let ok = true
    void ensureFont(el.fontFamily, el.fontWeight, el.text).then((loaded) => {
      if (!ok || !loaded) return
      const n = textRef.current as any
      n?._setTextData?.()
      n?.getLayer()?.batchDraw()
      setFontTick((t) => t + 1)
    })
    return () => {
      ok = false
    }
  }, [el.type, el.fontFamily, el.fontWeight, el.text])

  // text grows with its content so the whole text is always visible
  useEffect(() => {
    if (el.type !== 'text' || !onAutoHeight) return
    let ok = true
    const check = () => {
      const n = textRef.current as any
      if (!ok || !n) return
      n._setTextData?.()
      const h = Math.ceil(n.height() * 10) / 10
      if (Math.abs(h - el.h) > 0.5) onAutoHeight(el.id, h)
    }
    check()
    void (document as any).fonts?.ready?.then(check)
    return () => {
      ok = false
    }
  }, [el.type, el.text, el.w, el.h, el.fontSize, el.fontFamily, el.fontWeight, el.lineHeight, el.letterSpacing, el.id, onAutoHeight, fontTick])

  const img = useImg(el.type === 'image' ? el.src : iconUrl)

  const canSelect = interactive && !el.locked
  const common: any = {
    id: el.id,
    name: 'el el-' + el.type + (el.type === 'image' && el.mask === 'circle' ? ' circle' : ''),
    x: el.x,
    y: el.y,
    rotation: el.rotation,
    opacity: el.opacity,
    visible: el.visible,
    draggable: canSelect,
    listening: interactive ? !el.locked : !!el.link,
    perfectDrawEnabled: false,
    shadowForStrokeEnabled: false,
    shadowEnabled: el.shadow.enabled,
    shadowColor: el.shadow.color,
    shadowBlur: el.shadow.blur,
    shadowOffsetX: el.shadow.x,
    shadowOffsetY: el.shadow.y,
    shadowOpacity: el.shadow.opacity,
  }
  const handlers = interactive
    ? {
        onMouseDown: (e: Konva.KonvaEventObject<any>) => {
          e.cancelBubble = true
          downSel.current = !!onSelect?.(el.id, !!(e.evt as MouseEvent).shiftKey || !!(e.evt as MouseEvent).ctrlKey || useUI.getState().multi)
        },
        onTouchStart: (e: Konva.KonvaEventObject<any>) => {
          if ((e.evt as TouchEvent).touches?.length > 1) return
          e.cancelBubble = true
          downSel.current = !!onSelect?.(el.id, useUI.getState().multi)
        },
        // in "select multiple" mode a tap on an element that was already selected removes it
        onClick: () => useUI.getState().multi && downSel.current && onToggleOff?.(el.id),
        onTap: () => useUI.getState().multi && downSel.current && onToggleOff?.(el.id),
        onDragStart: () => onDragStartSel?.(el.id),
        onDblClick: () => onDbl?.(el.id),
        onDblTap: () => onDbl?.(el.id),
        onDragMove: (e: Konva.KonvaEventObject<any>) => {
          const n = e.target
          const xs = [0, abW / 2, abW]
          const ys = [0, abH / 2, abH]
          const T = 8 / (n.getStage()?.scaleX() || 1)
          for (const s of getSiblings?.() ?? siblings ?? []) {
            if (s.id === el.id || !s.visible) continue
            xs.push(s.x, s.x + s.w / 2, s.x + s.w)
            ys.push(s.y, s.y + s.h / 2, s.y + s.h)
          }
          const box = getSnapBox?.(el.id)
          const ox = box?.dx ?? 0
          const oy = box?.dy ?? 0
          n.x(snap1(n.x() + ox, box?.w ?? el.w, xs, T) - ox)
          n.y(snap1(n.y() + oy, box?.h ?? el.h, ys, T) - oy)
          onDragMoveSel?.(el.id, n.x(), n.y())
        },
        onDragEnd: (e: Konva.KonvaEventObject<any>) => onMoved?.(el.id, r1(e.target.x()), r1(e.target.y())),
      }
    : {
        onClick: () => el.link && onLink?.(el.link),
        onTap: () => el.link && onLink?.(el.link),
      }

  const strokeProps = el.strokeOn ? { stroke: el.stroke, strokeWidth: el.strokeWidth } : {}

  if (el.type === 'rect') return <Rect {...common} {...handlers} hitFunc={slopHit} width={el.w} height={el.h} {...fillProps(el)} cornerRadius={el.radius} {...strokeProps} />

  if (el.type === 'ellipse')
    return (
      <Shape
        {...common}
        {...handlers}
        width={el.w}
        height={el.h}
        hitFunc={slopHit}
        {...fillProps(el)}
        {...strokeProps}
        sceneFunc={(ctx: any, shape: any) => {
          ctx.beginPath()
          const w = shape.width()
          const h = shape.height()
          ctx.ellipse(w / 2, h / 2, Math.max(0.1, w / 2), Math.max(0.1, h / 2), 0, 0, Math.PI * 2)
          ctx.closePath()
          ctx.fillStrokeShape(shape)
        }}
      />
    )

  if (el.type === 'text')
    return (
      <Text
        ref={textRef}
        {...common}
        {...handlers}
        hitFunc={slopHit}
        width={el.w}
        text={el.text ?? ''}
        fontSize={el.fontSize}
        fontFamily={el.fontFamily}
        fontStyle={String(el.fontWeight ?? 400)}
        align={el.align}
        lineHeight={el.lineHeight}
        letterSpacing={el.letterSpacing}
        textDecoration={el.underline ? 'underline' : ''}
        {...fillProps(el)}
        {...strokeProps}
      />
    )

  if (el.type === 'image' || el.type === 'icon')
    return img ? (
      <KImage
        {...common}
        {...handlers}
        image={img}
        hitFunc={slopHit}
        width={el.w}
        height={el.h}
        crop={el.type === 'image' && el.crop ? { x: el.crop.x * img.naturalWidth, y: el.crop.y * img.naturalHeight, width: el.crop.w * img.naturalWidth, height: el.crop.h * img.naturalHeight } : undefined}
        cornerRadius={el.type === 'image' ? (el.mask === 'circle' ? Math.min(el.w, el.h) / 2 : el.radius) : 0}
      />
    ) : (
      <Rect {...common} {...handlers} width={el.w} height={el.h} fill="#F5F5F5" stroke="#E5E5E5" strokeWidth={1} dash={[4, 4]} />
    )

  if (el.type === 'line')
    return <Line {...common} {...handlers} points={[0, 0, el.w, el.h]} stroke={el.stroke} strokeWidth={el.strokeWidth} lineCap="round" hitStrokeWidth={24} />

  return (
    <Arrow
      {...common}
      {...handlers}
      points={[0, 0, el.w, el.h]}
      stroke={el.stroke}
      fill={el.stroke}
      strokeWidth={el.strokeWidth}
      pointerLength={el.strokeWidth * 4 + 6}
      pointerWidth={el.strokeWidth * 4 + 6}
      lineCap="round"
      hitStrokeWidth={24}
    />
  )
}

export default memo(ElNodeBase)
