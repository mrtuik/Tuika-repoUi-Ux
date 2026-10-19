import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown, Pipette, Plus } from 'lucide-react'
import { useUI } from '../../state/ui'

/* ---------- layout primitives ---------- */

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="psec">
      <div className="psec-h">
        <h3>{title}</h3>
        {action}
      </div>
      <div className="psec-b">{children}</div>
    </section>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <span className="flabel">{label}</span>
      {children}
    </div>
  )
}

export function Row({ label, children }: { label: string; children: ReactNode; stack?: boolean }) {
  return (
    <div className="field inline">
      <span className="flabel">{label}</span>
      <div className="fctl">{children}</div>
    </div>
  )
}

/* ---------- inputs ---------- */

export function Num({ value, onChange, label, step = 1, min, max, suffix }: { value: number; onChange: (v: number) => void; label: string; step?: number; min?: number; max?: number; suffix?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const fmt = (v: number) => String(Math.round(v * 100) / 100)
  const [text, setText] = useState(fmt(value))
  useEffect(() => {
    if (document.activeElement !== ref.current) setText(fmt(value))
  }, [value])
  const trailing = suffix === 'px' || suffix === '%' || suffix === 'deg'
  return (
    <label className="num">
      {suffix && !trailing && <span className="pre">{suffix}</span>}
      <input
        ref={ref}
        aria-label={label}
        inputMode="decimal"
        value={text}
        step={step}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          setText(e.target.value)
          let n = parseFloat(e.target.value)
          if (!Number.isFinite(n)) return
          if (min !== undefined) n = Math.max(min, n)
          if (max !== undefined) n = Math.min(max, n)
          onChange(n)
        }}
        onBlur={() => setText(fmt(value))}
      />
      {suffix && trailing && <span className="post">{suffix}</span>}
    </label>
  )
}

export function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: { v: T; label?: ReactNode; aria?: string }[]; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.v)} className={o.v === value ? 'on' : ''} aria-pressed={o.v === value} aria-label={o.aria} title={o.aria} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Slider({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  const p = ((value - min) / (max - min)) * 100
  return <input type="range" className="slider" aria-label={label} min={min} max={max} value={value} style={{ ['--p' as any]: `${p}%` }} onChange={(e) => onChange(Number(e.target.value))} />
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} className={'toggle' + (on ? ' on' : '')} onClick={() => onChange(!on)}>
      <span />
    </button>
  )
}

export function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        -
      </button>
      <span aria-live="polite">{value}</span>
      <button aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  )
}

/* ---------- color ---------- */

export function parseColor(s: string): string | null {
  const t = s.trim()
  let m = /^#?([0-9a-f]{6})$/i.exec(t)
  if (m) return '#' + m[1].toUpperCase()
  m = /^#?([0-9a-f]{3})$/i.exec(t)
  if (m) return '#' + m[1].split('').map((c) => c + c).join('').toUpperCase()
  m = /^(?:rgb\()?\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)?$/i.exec(t)
  if (m) return rgbToHex(Math.min(255, +m[1]), Math.min(255, +m[2]), Math.min(255, +m[3]))
  return null
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

function hexToRgb(h: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(h)
  if (!m) return [0, 0, 0]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map((x) => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, '0')).join('').toUpperCase()
}
function rgbToHsv(r: number, g: number, b: number) {
  r /= 255
  g /= 255
  b /= 255
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const d = mx - mn
  let h = 0
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6
    else if (mx === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  return { h, s: mx ? d / mx : 0, v: mx }
}
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}

function Drag({ className, onMove, children, style }: { className: string; onMove: (x: number, y: number) => void; children?: ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const handle = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect()
    onMove(clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1))
  }
  return (
    <div
      ref={ref}
      className={className}
      style={style}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        handle(e)
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) handle(e)
      }}
    >
      {children}
    </div>
  )
}

function Picker({ value, onChange, palette, onSave }: { value: string; onChange: (c: string) => void; palette: string[]; onSave?: () => void }) {
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : '#000000'
  const [hsv, setHsv] = useState(() => {
    const [r, g, b] = hexToRgb(safe)
    return rgbToHsv(r, g, b)
  })
  const [hex, setHex] = useState(safe)
  useEffect(() => {
    setHex(safe)
    const cur = rgbToHex(...hsvToRgb(hsv.h, hsv.s, hsv.v))
    if (cur !== safe) {
      const [r, g, b] = hexToRgb(safe)
      const n = rgbToHsv(r, g, b)
      setHsv((p) => ({ h: n.s === 0 || n.v === 0 ? p.h : n.h, s: n.s, v: n.v }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safe])

  const emit = (h: number, s: number, v: number) => {
    setHsv({ h, s, v })
    onChange(rgbToHex(...hsvToRgb(h, s, v)))
  }
  const [r, g, b] = hexToRgb(safe)
  const ED = typeof window !== 'undefined' ? (window as any).EyeDropper : undefined

  return (
    <div className="picker">
      <Drag className="sv" style={{ backgroundColor: `hsl(${hsv.h}, 100%, 50%)` }} onMove={(x, y) => emit(hsv.h, x, 1 - y)}>
        <span className="knob" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: safe }} />
      </Drag>
      <div className="hue-row">
        <button
          className="ic small"
          aria-label="Pick color from screen"
          title="Pick color from screen"
          onClick={() => {
            if (ED) new ED().open().then((res: { sRGBHex: string }) => onChange(res.sRGBHex.toUpperCase())).catch(() => {})
            else useUI.getState().startPick((c) => onChange(c))
          }}
        >
          <Pipette size={16} />
        </button>
        <Drag className="hue" onMove={(x) => emit(x * 359.99, hsv.s || 0.0001, hsv.v || 0.0001)}>
          <span className="knob" style={{ left: `${(hsv.h / 360) * 100}%`, background: `hsl(${hsv.h}, 100%, 50%)` }} />
        </Drag>
      </div>
      <div className="cf-fields">
        <label className="num hexbox">
          <span className="pre">#</span>
          <input
            aria-label="Hex color"
            value={hex.replace('#', '')}
            maxLength={7}
            onChange={(e) => {
              setHex('#' + e.target.value.replace('#', ''))
              const c = parseColor(e.target.value)
              if (c) onChange(c)
            }}
            onBlur={() => setHex(safe)}
          />
        </label>
        <Num label="Red" value={r} min={0} max={255} onChange={(v) => onChange(rgbToHex(v, g, b))} suffix="R" />
        <Num label="Green" value={g} min={0} max={255} onChange={(v) => onChange(rgbToHex(r, v, b))} suffix="G" />
        <Num label="Blue" value={b} min={0} max={255} onChange={(v) => onChange(rgbToHex(r, g, v))} suffix="B" />
      </div>
      <div className="cf-saved">
        <div className="swatches">
          {palette.slice(0, 12).map((c) => (
            <button key={c} className={'sw' + (c.toUpperCase() === safe ? ' on' : '')} style={{ background: c }} aria-label={`Use color ${c}`} onClick={() => onChange(c)} />
          ))}
          {onSave && (
            <button className="sw add" aria-label="Save as color style" title="Save as color style" onClick={onSave}>
              <Plus size={14} />
            </button>
          )}
        </div>
        <div className="cf-copy">
          <button className="mini" onClick={() => navigator.clipboard?.writeText(safe).catch(() => {})}>
            Copy
          </button>
          <button
            className="mini"
            onClick={async () => {
              try {
                const c = parseColor(await navigator.clipboard.readText())
                if (c) onChange(c)
              } catch {
                /* clipboard permission denied */
              }
            }}
          >
            Paste
          </button>
        </div>
      </div>
    </div>
  )
}

export function ColorField({ value, onChange, swatches = [], onSave }: { value: string; onChange: (c: string) => void; swatches?: string[]; onSave?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="cf">
      <button className="cf-head" aria-expanded={open} aria-label={`Color ${value}. Tap to edit`} onClick={() => setOpen(!open)}>
        <span className="cf-chip" style={{ background: value }} />
        <span className="cf-hex">{value.toUpperCase()}</span>
        <ChevronDown size={16} className={open ? 'flip' : ''} />
      </button>
      {!open && swatches.length > 0 && (
        <div className="swatches quick">
          {swatches.slice(0, 7).map((c) => (
            <button key={c} className={'sw' + (c.toUpperCase() === value.toUpperCase() ? ' on' : '')} style={{ background: c }} aria-label={`Use color ${c}`} onClick={() => onChange(c)} />
          ))}
        </div>
      )}
      {open && <Picker value={value} onChange={onChange} palette={swatches} onSave={onSave} />}
    </div>
  )
}
