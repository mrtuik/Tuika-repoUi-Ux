import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export function Row({ label, children, stack }: { label: string; children: ReactNode; stack?: boolean }) {
  return (
    <div className={'prow' + (stack ? ' stack' : '')}>
      <div className="plabel">{label}</div>
      <div className="pctl">{children}</div>
    </div>
  )
}

export function Num({ value, onChange, label, step = 1, min, max, suffix }: { value: number; onChange: (v: number) => void; label: string; step?: number; min?: number; max?: number; suffix?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const fmt = (v: number) => String(Math.round(v * 100) / 100)
  const [text, setText] = useState(fmt(value))
  useEffect(() => {
    if (document.activeElement !== ref.current) setText(fmt(value))
  }, [value])
  return (
    <label className="num">
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
      {suffix && <span className="suffix">{suffix}</span>}
    </label>
  )
}

export function parseColor(s: string): string | null {
  const t = s.trim()
  let m = /^#?([0-9a-f]{6})$/i.exec(t)
  if (m) return '#' + m[1].toUpperCase()
  m = /^#?([0-9a-f]{3})$/i.exec(t)
  if (m) return '#' + m[1].split('').map((c) => c + c).join('').toUpperCase()
  m = /^(?:rgb\()?\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)?$/i.exec(t)
  if (m) {
    const v = [m[1], m[2], m[3]].map((x) => Math.min(255, parseInt(x, 10)))
    return '#' + v.map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase()
  }
  return null
}

const toRgb = (hex: string) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return ''
  const n = parseInt(m[1], 16)
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`
}

export function ColorField({ value, onChange, swatches = [] }: { value: string; onChange: (c: string) => void; swatches?: string[] }) {
  const [hex, setHex] = useState(value)
  const [rgb, setRgb] = useState(toRgb(value))
  useEffect(() => {
    setHex(value)
    setRgb(toRgb(value))
  }, [value])
  const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'
  return (
    <div className="colorfield">
      <div className="swatches">
        {swatches.slice(0, 8).map((c) => (
          <button key={c} className={'sw' + (c.toLowerCase() === value.toLowerCase() ? ' on' : '')} style={{ background: c }} aria-label={`Use color ${c}`} onClick={() => onChange(c)} />
        ))}
        <input type="color" className="sw picker" aria-label="Pick color" value={safe} onChange={(e) => onChange(e.target.value.toUpperCase())} />
      </div>
      <div className="hexrow">
        <input
          aria-label="Hex color"
          className="txt"
          value={hex}
          onChange={(e) => {
            setHex(e.target.value)
            const c = parseColor(e.target.value)
            if (c) onChange(c)
          }}
        />
        <input
          aria-label="RGB color"
          className="txt"
          value={rgb}
          placeholder="r, g, b"
          onChange={(e) => {
            setRgb(e.target.value)
            const c = parseColor(e.target.value)
            if (c) onChange(c)
          }}
        />
        <button className="mini" aria-label="Copy color" onClick={() => navigator.clipboard?.writeText(value).catch(() => {})}>
          Copy
        </button>
        <button
          className="mini"
          aria-label="Paste color"
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
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} className={'toggle' + (on ? ' on' : '')} onClick={() => onChange(!on)}>
      <span />
    </button>
  )
}
