import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useUI } from '../../state/ui'
import { stageHandle } from './handle'

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('').toUpperCase()

/**
 * Eyedropper for the canvas (Android WebView has no EyeDropper API): drag over the design, a magnifier follows the finger,
 * release to take the colour of the pixel under it. Works on shapes, text and photos.
 */
export default function PickerOverlay() {
  const loupe = useRef<HTMLCanvasElement>(null)
  const [pt, setPt] = useState<{ x: number; y: number } | null>(null)
  const [color, setColor] = useState('#FFFFFF')
  const live = useRef('#FFFFFF')

  const update = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    setPt({ x, y })
    const layer = stageHandle.stage?.getLayers()[0]
    if (!layer) return
    const kc: any = layer.getCanvas()
    const cv = kc._canvas as HTMLCanvasElement
    const pr: number = kc.getPixelRatio()
    const px = Math.min(cv.width - 1, Math.max(0, Math.round(x * pr)))
    const py = Math.min(cv.height - 1, Math.max(0, Math.round(y * pr)))
    try {
      const ctx = cv.getContext('2d')!
      const d = ctx.getImageData(px, py, 1, 1).data
      const a = d[3] / 255
      const c = hex(Math.round(d[0] * a + 255 * (1 - a)), Math.round(d[1] * a + 255 * (1 - a)), Math.round(d[2] * a + 255 * (1 - a)))
      live.current = c
      setColor(c)
      const lc = loupe.current?.getContext('2d')
      if (lc) {
        lc.imageSmoothingEnabled = false
        lc.clearRect(0, 0, 88, 88)
        lc.drawImage(cv, px - 5, py - 5, 11, 11, 0, 0, 88, 88)
        lc.strokeStyle = '#171717'
        lc.lineWidth = 2
        lc.strokeRect(40, 40, 8, 8)
        lc.strokeStyle = '#fff'
        lc.lineWidth = 1
        lc.strokeRect(39, 39, 10, 10)
      }
    } catch {
      /* canvas not readable: ignore */
    }
  }

  const finish = () => {
    const cb = useUI.getState().picker
    useUI.getState().cancelPick()
    if (cb && pt) cb(live.current)
  }

  return (
    <div
      className="picker-ov"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        update(e)
      }}
      onPointerMove={(e) => e.buttons !== 0 || e.pointerType === 'touch' ? update(e) : undefined}
      onPointerUp={finish}
      onPointerCancel={() => useUI.getState().cancelPick()}
    >
      <div className="picker-bar" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
        <span>Drag over the design, release to pick a colour</span>
        <button aria-label="Cancel colour picking" onClick={() => useUI.getState().cancelPick()}>
          <X size={16} />
        </button>
      </div>
      {pt && (
        <div className="loupe" style={{ left: Math.max(4, pt.x - 48), top: Math.max(44, pt.y - 140) }}>
          <canvas ref={loupe} width={88} height={88} />
          <span className="loupe-hex">
            <i style={{ background: color }} />
            {color}
          </span>
        </div>
      )}
    </div>
  )
}
