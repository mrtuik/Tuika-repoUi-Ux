import { memo, useEffect, useState } from 'react'
import { Arrow, Image as KImage, Line, Rect, Shape, Text } from 'react-konva'
import type Konva from 'konva'
import type { El } from '../../engine/types'
import { svgToDataUrl } from '../../services/svg'

const imgCache = new Map<string, HTMLImageElement>()

function useImg(src?: string) {
  const [img, setImg] = useState<HTMLImageElement | null>(() => (src ? imgCache.get(src) ?? null : null))
  useEffect(() => {
    if (!src) return setImg(null)
    const hit = imgCache.get(src)
    if (hit) return setImg(hit)
    let ok = true
    const i = new window.Image()
    i.onload = () => {
      if (imgCache.size > 60) imgCache.delete(imgCache.keys().next().value as string)
      imgCache.set(src, i)
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
  siblings: El[]
  snapT: number
  onSelect?: (id: string, additive: boolean) => void
  onMoved?: (id: string, x: number, y: number) => void
  onDbl?: (id: string) => void
  onLink?: (target: string) => void
}

const r1 = (n: number) => Math.round(n * 10) / 10

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

function ElNodeBase({ el, interactive, abW, abH, siblings, snapT, onSelect, onMoved, onDbl, onLink }: Props) {
  const iconUrl = el.type === 'icon' && el.svg ? svgToDataUrl(el.svg, el.fill) : undefined
  const img = useImg(el.type === 'image' ? el.src : iconUrl)

  const canSelect = interactive && !el.locked
  const common: any = {
    id: el.id,
    x: el.x,
    y: el.y,
    rotation: el.rotation,
    opacity: el.opacity,
    visible: el.visible,
    draggable: canSelect,
    listening: interactive ? !el.locked : !!el.link,
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
          onSelect?.(el.id, !!(e.evt as MouseEvent).shiftKey || !!(e.evt as MouseEvent).ctrlKey)
        },
        onTouchStart: (e: Konva.KonvaEventObject<any>) => {
          if ((e.evt as TouchEvent).touches?.length > 1) return
          e.cancelBubble = true
          onSelect?.(el.id, false)
        },
        onDblClick: () => onDbl?.(el.id),
        onDblTap: () => onDbl?.(el.id),
        onDragMove: (e: Konva.KonvaEventObject<any>) => {
          const n = e.target
          const xs = [0, abW / 2, abW]
          const ys = [0, abH / 2, abH]
          for (const s of siblings) {
            if (s.id === el.id || !s.visible) continue
            xs.push(s.x, s.x + s.w / 2, s.x + s.w)
            ys.push(s.y, s.y + s.h / 2, s.y + s.h)
          }
          n.x(snap1(n.x(), el.w, xs, snapT))
          n.y(snap1(n.y(), el.h, ys, snapT))
        },
        onDragEnd: (e: Konva.KonvaEventObject<any>) => onMoved?.(el.id, r1(e.target.x()), r1(e.target.y())),
      }
    : {
        onClick: () => el.link && onLink?.(el.link),
        onTap: () => el.link && onLink?.(el.link),
      }

  const strokeProps = el.strokeOn ? { stroke: el.stroke, strokeWidth: el.strokeWidth } : {}

  if (el.type === 'rect') return <Rect {...common} {...handlers} width={el.w} height={el.h} fill={el.fill} cornerRadius={el.radius} {...strokeProps} />

  if (el.type === 'ellipse')
    return (
      <Shape
        {...common}
        {...handlers}
        width={el.w}
        height={el.h}
        fill={el.fill}
        {...strokeProps}
        sceneFunc={(ctx: any, shape: any) => {
          ctx.beginPath()
          ctx.ellipse(el.w / 2, el.h / 2, Math.max(0.1, el.w / 2), Math.max(0.1, el.h / 2), 0, 0, Math.PI * 2)
          ctx.closePath()
          ctx.fillStrokeShape(shape)
        }}
      />
    )

  if (el.type === 'text')
    return (
      <Text
        {...common}
        {...handlers}
        width={el.w}
        height={el.h || undefined}
        text={el.text ?? ''}
        fontSize={el.fontSize}
        fontFamily={el.fontFamily}
        fontStyle={String(el.fontWeight ?? 400)}
        align={el.align}
        lineHeight={el.lineHeight}
        letterSpacing={el.letterSpacing}
        textDecoration={el.underline ? 'underline' : ''}
        fill={el.fill}
        {...strokeProps}
      />
    )

  if (el.type === 'image' || el.type === 'icon')
    return img ? (
      <KImage {...common} {...handlers} image={img} width={el.w} height={el.h} cornerRadius={el.type === 'image' ? el.radius : 0} />
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
