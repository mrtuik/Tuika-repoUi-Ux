import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCcw } from 'lucide-react'
import { useEditor, selectedEls } from '../../state/editor'
import { Num, Section } from './controls'

const STEPS = [1, 5, 10, 25, 50]
const r1 = (n: number) => Math.round(n * 10) / 10
const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '\u2212' : '') + Math.abs(r1(n))

/** Press-and-hold repeats the move, so long distances do not need dozens of taps. */
function Pad({ label, children, onStep, cls }: { label: string; children: ReactNode; onStep: () => void; cls: string }) {
  const fn = useRef(onStep)
  fn.current = onStep
  const t = useRef(0)
  const iv = useRef(0)
  const stop = () => {
    window.clearTimeout(t.current)
    window.clearInterval(iv.current)
  }
  useEffect(() => stop, [])
  return (
    <button
      className={'dpad-btn ' + cls}
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault()
        stop()
        fn.current()
        t.current = window.setTimeout(() => {
          iv.current = window.setInterval(() => fn.current(), 70)
        }, 380)
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  )
}

/** Move the selected element(s) a fixed distance at a time, and show how far they have moved. */
export default function Nudge() {
  const els = useEditor((s) => selectedEls(s))
  const [step, setStep] = useState(5)
  const key = els.map((e) => e.id).join(',')
  const origin = useRef<{ key: string; pos: Record<string, { x: number; y: number }> } | null>(null)
  if (!origin.current || origin.current.key !== key) origin.current = { key, pos: Object.fromEntries(els.map((e) => [e.id, { x: e.x, y: e.y }])) }
  if (els.length === 0) return null

  const first = els[0]
  const o = origin.current.pos[first.id] ?? { x: first.x, y: first.y }
  const dx = first.x - o.x
  const dy = first.y - o.y

  const move = (mx: number, my: number) => {
    const s = useEditor.getState()
    const { abId, elIds } = s.sel
    if (!abId || elIds.length === 0) return
    s.commit((d) => {
      const ab = d.artboards.find((a) => a.id === abId)
      if (!ab) return
      for (const e of ab.els)
        if (elIds.includes(e.id)) {
          e.x = r1(e.x + mx)
          e.y = r1(e.y + my)
        }
    }, 'nudge')
  }
  const reset = () => {
    const pos = origin.current!.pos
    const s = useEditor.getState()
    const { abId } = s.sel
    s.commit((d) => {
      const ab = d.artboards.find((a) => a.id === abId)
      if (!ab) return
      for (const e of ab.els)
        if (pos[e.id]) {
          e.x = pos[e.id].x
          e.y = pos[e.id].y
        }
    })
  }

  return (
    <Section title="Nudge">
      <div className="nudge">
        <div className="dpad" role="group" aria-label="Move selection">
          <Pad cls="u" label="Move up" onStep={() => move(0, -step)}>
            <ArrowUp size={22} />
          </Pad>
          <Pad cls="l" label="Move left" onStep={() => move(-step, 0)}>
            <ArrowLeft size={22} />
          </Pad>
          <span className="dpad-mid">{step}px</span>
          <Pad cls="r" label="Move right" onStep={() => move(step, 0)}>
            <ArrowRight size={22} />
          </Pad>
          <Pad cls="d" label="Move down" onStep={() => move(0, step)}>
            <ArrowDown size={22} />
          </Pad>
        </div>
        <div className="nudge-side">
          <div className="nudge-lb">Move by</div>
          <div className="nudge-steps" role="group" aria-label="Distance per tap">
            {STEPS.map((v) => (
              <button key={v} className={step === v ? 'on' : ''} aria-pressed={step === v} onClick={() => setStep(v)}>
                {v}
              </button>
            ))}
          </div>
          <Num label="Custom distance" value={step} min={0.1} max={500} onChange={(v) => setStep(v)} suffix="px" />
          <div className="nudge-read" aria-live="polite">
            <span>
              Moved X <b>{sign(dx)}</b>
            </span>
            <span>
              Y <b>{sign(dy)}</b>
            </span>
          </div>
          <div className="nudge-read dim">
            <span>
              At X {r1(first.x)}
            </span>
            <span>Y {r1(first.y)}</span>
          </div>
          <button className="mini" onClick={reset} disabled={dx === 0 && dy === 0}>
            <RotateCcw size={14} /> Back to start
          </button>
        </div>
      </div>
    </Section>
  )
}
