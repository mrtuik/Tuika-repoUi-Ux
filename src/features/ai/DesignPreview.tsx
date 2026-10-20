import { memo, useMemo } from 'react'
import type { AiScreen } from '../../services/aiDesign'
import type { El } from '../../engine/types'
import { svgToDataUrl } from '../../services/svg'

let seq = 0

function gradCoords(angle: number, w: number, h: number) {
  const a = (angle * Math.PI) / 180
  const dx = Math.cos(a)
  const dy = Math.sin(a)
  const L = (Math.abs(w * dx) + Math.abs(h * dy)) / 2
  return { x1: w / 2 - dx * L, y1: h / 2 - dy * L, x2: w / 2 + dx * L, y2: h / 2 + dy * L }
}

/** Lightweight SVG rendering of a generated screen (used for the preview cards in the Ask AI chat). */
function DesignPreview({ screen }: { screen: AiScreen }) {
  const uidp = useMemo(() => 'p' + ++seq + '-', [])
  const defs: JSX.Element[] = []
  const body = screen.els.map((e: El, i) => {
    const id = uidp + i
    let fill: string = e.fill
    if (e.fillGradient && e.type !== 'text') {
      const g = e.fillGradient
      fill = `url(#g${id})`
      const stops = g.stops.map((s, k) => <stop key={k} offset={s.pos} stopColor={s.color} />)
      defs.push(
        g.type === 'radial' ? (
          <radialGradient key={'g' + id} id={'g' + id} gradientUnits="userSpaceOnUse" cx={e.x + e.w / 2} cy={e.y + e.h / 2} r={Math.max(e.w, e.h) / 2}>
            {stops}
          </radialGradient>
        ) : (
          (() => {
            const c = gradCoords(g.angle, e.w, e.h)
            return (
              <linearGradient key={'g' + id} id={'g' + id} gradientUnits="userSpaceOnUse" x1={e.x + c.x1} y1={e.y + c.y1} x2={e.x + c.x2} y2={e.y + c.y2}>
                {stops}
              </linearGradient>
            )
          })()
        ),
      )
    }
    let filter: string | undefined
    if (e.shadow.enabled) {
      filter = `url(#s${id})`
      defs.push(
        <filter key={'s' + id} id={'s' + id} x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx={e.shadow.x} dy={e.shadow.y} stdDeviation={e.shadow.blur / 2} floodColor={e.shadow.color} floodOpacity={e.shadow.opacity} />
        </filter>,
      )
    }
    const tf = e.rotation ? `rotate(${e.rotation} ${e.x} ${e.y})` : undefined
    const common = { opacity: e.opacity, transform: tf, filter }
    const stroke = e.strokeOn ? { stroke: e.stroke, strokeWidth: e.strokeWidth } : {}
    switch (e.type) {
      case 'rect':
        return <rect key={i} x={e.x} y={e.y} width={e.w} height={e.h} rx={Math.min(e.radius, Math.min(e.w, e.h) / 2)} fill={fill} {...stroke} {...common} />
      case 'ellipse':
        return <ellipse key={i} cx={e.x + e.w / 2} cy={e.y + e.h / 2} rx={e.w / 2} ry={e.h / 2} fill={fill} {...stroke} {...common} />
      case 'line':
      case 'arrow':
        return <line key={i} x1={e.x} y1={e.y} x2={e.x + e.w} y2={e.y + e.h} stroke={e.stroke} strokeWidth={e.strokeWidth} strokeLinecap="round" {...common} />
      case 'icon':
        return e.svg ? <image key={i} href={svgToDataUrl(e.svg, e.fill)} x={e.x} y={e.y} width={e.w} height={e.h} {...common} /> : null
      case 'text':
        return (
          <foreignObject key={i} x={e.x} y={e.y} width={e.w} height={Math.max(e.h, 400)} {...common} style={{ overflow: 'visible' }}>
            <div
              style={{
                width: e.w,
                color: e.fill,
                fontFamily: e.fontFamily,
                fontSize: e.fontSize,
                fontWeight: e.fontWeight,
                lineHeight: e.lineHeight,
                letterSpacing: e.letterSpacing,
                textAlign: e.align,
                fontStyle: e.italic ? 'italic' : 'normal',
                textDecoration: e.underline ? 'underline' : 'none',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {e.text}
            </div>
          </foreignObject>
        )
      default:
        return null
    }
  })
  return (
    <svg className="ai-svg" viewBox={`0 0 ${screen.w} ${screen.h}`} role="img" aria-label={`Preview of ${screen.name}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <clipPath id={uidp + 'clip'}>
          <rect width={screen.w} height={screen.h} />
        </clipPath>
        {defs}
      </defs>
      <g clipPath={`url(#${uidp}clip)`}>
        <rect width={screen.w} height={screen.h} fill={screen.bg} />
        {body}
      </g>
    </svg>
  )
}

export default memo(DesignPreview)
