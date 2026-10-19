import { ArrowDownToLine, ArrowUpToLine, ChevronDown, ChevronUp, Lock, Unlock, AlignCenter, AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignLeft, AlignRight, AlignStartHorizontal, AlignStartVertical, Copy, Trash2, Underline } from 'lucide-react'
import { useEditor, selectedEls } from '../../state/editor'
import type { AlignMode } from '../../state/editor'
import type { CtxPanel } from '../../state/ui'
import { brokenLinks } from '../../engine/doc'
import { ColorField, Field, Num, Section, Seg, Slider, Toggle, parseColor } from './controls'
import FontPicker from './FontPicker'
import Nudge from './Nudge'
import { LayerList } from '../layers/Layers'
import { gradCss } from '../../engine/gradient'
import { getCachedImage } from '../canvas/ElNode'
import type { El, Gradient } from '../../engine/types'

export const FONTS: [string, string][] = [
  ['Inter, system-ui, sans-serif', 'Inter'],
  ['Poppins, sans-serif', 'Poppins'],
  ["'Playfair Display', serif", 'Playfair Display'],
  ["'JetBrains Mono', monospace", 'JetBrains Mono'],
  ['system-ui, sans-serif', 'System'],
]
const WEIGHTS: [number, string][] = [
  [300, 'Light'],
  [400, 'Regular'],
  [500, 'Medium'],
  [600, 'Semibold'],
  [700, 'Bold'],
  [800, 'Extra bold'],
]
const SIZES = [12, 14, 16, 18, 24, 32, 48]
const ALIGNS: { m: AlignMode; I: typeof AlignStartHorizontal; l: string }[] = [
  { m: 'left', I: AlignStartVertical, l: 'Align left' },
  { m: 'hcenter', I: AlignCenterVertical, l: 'Center horizontally' },
  { m: 'right', I: AlignEndVertical, l: 'Align right' },
  { m: 'top', I: AlignStartHorizontal, l: 'Align top' },
  { m: 'vcenter', I: AlignCenterHorizontal, l: 'Center vertically' },
  { m: 'bottom', I: AlignEndHorizontal, l: 'Align bottom' },
]

const GRADS: [string, string][] = [
  ['#F97316', '#EC4899'],
  ['#6366F1', '#06B6D4'],
  ['#22C55E', '#EAB308'],
  ['#171717', '#525252'],
  ['#FDE68A', '#F97316'],
  ['#0EA5E9', '#8B5CF6'],
]

/** A second colour that contrasts with the first, used when switching to a gradient. */
function other(hex: string) {
  const c = parseColor(hex) ?? '#171717'
  const n = parseInt(c.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  const f = (v: number) => Math.round(lum > 0.55 ? v * 0.35 : v + (255 - v) * 0.6)
  return '#' + [f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()
}

function FillControls({ e, patch, palette, onSave }: { e: El; patch: (p: Partial<El>, key?: string) => void; palette: string[]; onSave: () => void }) {
  const canGrad = e.type === 'rect' || e.type === 'ellipse' || e.type === 'text'
  const g = e.fillGradient
  const mode = g ? g.type : 'solid'
  const set = (next: Gradient, key?: string) => patch({ fillGradient: { ...next, stops: [...next.stops].sort((a, b) => a.pos - b.pos) } }, key)
  const setMode = (m: 'solid' | 'linear' | 'radial') => {
    if (m === 'solid') patch({ fillGradient: undefined })
    else set(g ? { ...g, type: m } : { type: m, angle: 90, stops: [{ color: e.fill, pos: 0 }, { color: other(e.fill), pos: 1 }] })
  }
  const setStop = (i: number, part: Partial<Gradient['stops'][number]>) => g && set({ ...g, stops: g.stops.map((s, j) => (j === i ? { ...s, ...part } : s)) }, 'grad')
  return (
    <>
      {canGrad && (
        <Seg
          label="Fill type"
          value={mode as 'solid' | 'linear' | 'radial'}
          options={[
            { v: 'solid', label: 'Solid' },
            { v: 'linear', label: 'Linear' },
            { v: 'radial', label: 'Radial' },
          ]}
          onChange={setMode}
        />
      )}
      {!g && <ColorField value={e.fill} swatches={palette} onSave={onSave} onChange={(c) => patch({ fill: c }, 'fill')} />}
      {g && (
        <>
          <div className="grad-presets" role="group" aria-label="Gradient presets">
            {GRADS.map(([a, b]) => (
              <button
                key={a + b}
                className="grad-sw"
                aria-label={`Gradient ${a} to ${b}`}
                style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
                onClick={() =>
                  set({
                    ...g,
                    stops: [
                      { color: a, pos: 0 },
                      { color: b, pos: 1 },
                    ],
                  })
                }
              />
            ))}
          </div>
          <div className="grad-bar" style={{ background: gradCss({ ...g, type: 'linear', angle: 0 }) }} aria-hidden />
          {g.stops.map((s, i) => (
            <div className="stop" key={i}>
              <div className="stop-head">
                <span>Colour {i + 1}</span>
                {g.stops.length > 2 && (
                  <button className="mini" onClick={() => set({ ...g, stops: g.stops.filter((_, j) => j !== i) })}>
                    Remove
                  </button>
                )}
              </div>
              <ColorField value={s.color} swatches={palette} onChange={(c) => setStop(i, { color: c })} />
              <div className="slide-row">
                <Slider label={`Colour ${i + 1} position`} value={Math.round(s.pos * 100)} min={0} max={100} onChange={(v) => setStop(i, { pos: v / 100 })} />
                <Num label={`Colour ${i + 1} position`} value={Math.round(s.pos * 100)} min={0} max={100} onChange={(v) => setStop(i, { pos: v / 100 })} suffix="%" />
              </div>
            </div>
          ))}
          {g.stops.length < 4 && (
            <button className="mini" onClick={() => set({ ...g, stops: [...g.stops, { color: other(g.stops[0].color), pos: 0.5 }] })}>
              Add colour
            </button>
          )}
          {g.type === 'linear' && (
            <Field label="Angle">
              <div className="slide-row">
                <Slider label="Gradient angle" value={((Math.round(g.angle) % 360) + 360) % 360} min={0} max={360} onChange={(v) => set({ ...g, angle: v }, 'grad')} />
                <Num label="Gradient angle" value={Math.round(g.angle)} min={-360} max={360} onChange={(v) => set({ ...g, angle: v }, 'grad')} suffix="deg" />
              </div>
            </Field>
          )}
        </>
      )}
    </>
  )
}

export default function Inspector({ only }: { only?: CtxPanel } = {}) {
  const doc = useEditor((s) => s.doc)!
  const sel = useEditor((s) => s.sel)
  const els = useEditor((s) => selectedEls(s))
  const st = useEditor.getState()
  const ab = doc.artboards.find((a) => a.id === sel.abId)
  if (!ab) return <div className="empty">Nothing selected</div>

  const savePalette = (c: string) => () => !doc.palette.includes(c) && st.commit((d) => void d.palette.push(c))

  // ---------- artboard ----------
  if (els.length === 0) {
    const broken = brokenLinks(doc)
    return (
      <div className="props">
        <Section title="Artboard">
          <Field label="Name">
            <input className="txt wide" aria-label="Artboard name" value={ab.name} onChange={(e) => st.patchArtboard(ab.id, { name: e.target.value }, 'abname')} />
          </Field>
          <div className="grid2">
            <Field label="X">
              <Num label="Artboard X" value={ab.x} onChange={(v) => st.patchArtboard(ab.id, { x: v }, 'abx')} suffix="X" />
            </Field>
            <Field label="Y">
              <Num label="Artboard Y" value={ab.y} onChange={(v) => st.patchArtboard(ab.id, { y: v }, 'aby')} suffix="Y" />
            </Field>
            <Field label="Width">
              <Num label="Artboard width" value={ab.w} min={16} max={8000} onChange={(v) => st.patchArtboard(ab.id, { w: v }, 'abw')} suffix="W" />
            </Field>
            <Field label="Height">
              <Num label="Artboard height" value={ab.h} min={16} max={8000} onChange={(v) => st.patchArtboard(ab.id, { h: v }, 'abh')} suffix="H" />
            </Field>
          </div>
        </Section>
        <Section title="Background">
          <ColorField value={ab.bg} swatches={doc.palette} onSave={savePalette(ab.bg)} onChange={(c) => st.patchArtboard(ab.id, { bg: c }, 'abbg')} />
        </Section>
        <Section title="Prototype" action={<Toggle label="Use as start screen" on={doc.startId === ab.id} onChange={(v) => v && st.commit((d) => void (d.startId = ab.id))} />}>
          <div className="hint flush">Start screen: where the preview begins.</div>
          {broken.length > 0 && <div className="warn">{broken.length} link(s) point to a deleted screen: {broken.map((b) => b.name).join(', ')}</div>}
        </Section>
        <Section title="Arrange">
          <div className="btnrow">
            <button className="mini" onClick={() => st.moveArtboardOrder(ab.id, -1)}>
              Move earlier
            </button>
            <button className="mini" onClick={() => st.moveArtboardOrder(ab.id, 1)}>
              Move later
            </button>
          </div>
          <div className="btnrow">
            <button className="mini" onClick={() => st.duplicateArtboard(ab.id)}>
              <Copy size={14} /> Duplicate
            </button>
            <button className="mini danger" disabled={doc.artboards.length <= 1} onClick={() => window.confirm(`Delete "${ab.name}" and everything on it?`) && st.removeArtboard(ab.id)}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </Section>
      </div>
    )
  }

  // ---------- element(s) ----------
  const e = els[0]
  const multi = els.length > 1
  const patch = (p: Partial<typeof e>, key?: string) => st.patchSel(p, key)
  const isText = e.type === 'text'
  const isLine = e.type === 'line' || e.type === 'arrow'
  const hasFill = !isLine && e.type !== 'image'
  const hasStroke = e.type === 'rect' || e.type === 'ellipse' || e.type === 'text'
  const hasRadius = e.type === 'rect' || e.type === 'image'
  const show = (p: CtxPanel) => !only || only === 'all' || only === p

  return (
    <div className="props">
      {multi && (!only || only === 'all') && <div className="hint flush">{els.length} elements selected. Changes apply to all.</div>}

      {show('position') && (
      <Section title="Layout">
        <div className="aligns" role="group" aria-label="Align to artboard">
          {ALIGNS.map(({ m, I, l }) => (
            <button key={m} className="ic" aria-label={l} title={l} onClick={() => st.align(m)}>
              <I size={17} />
            </button>
          ))}
        </div>
        {!multi && (
          <div className="grid2">
            <Num label="X" value={e.x} onChange={(v) => patch({ x: v }, 'x')} suffix="X" />
            <Num label="Y" value={e.y} onChange={(v) => patch({ y: v }, 'y')} suffix="Y" />
            <Num label="Width" value={e.w} min={0} onChange={(v) => patch({ w: v }, 'w')} suffix="W" />
            <Num label="Height" value={e.h} min={0} onChange={(v) => patch({ h: v }, 'h')} suffix="H" />
            <Num label="Rotation" value={e.rotation} onChange={(v) => patch({ rotation: v }, 'rot')} suffix="deg" />
            {hasRadius ? <Num label="Corner radius" value={e.radius} min={0} onChange={(v) => patch({ radius: v }, 'rad')} suffix="px" /> : <span />}
          </div>
        )}
      </Section>
      )}

      {show('nudge') && <Nudge />}

      {show('corners') && hasRadius && !multi && (
        <Section title={e.type === 'image' ? 'Shape and corners' : 'Corners'}>
          {e.type === 'image' && (
            <Seg
              label="Image shape"
              value={e.mask === 'circle' ? 'circle' : e.radius > 0 ? 'rounded' : 'square'}
              options={[
                { v: 'square', label: 'Square' },
                { v: 'rounded', label: 'Rounded' },
                { v: 'circle', label: 'Circle' },
              ]}
              onChange={(v) => {
                if (v === 'square') patch({ mask: undefined, radius: 0 })
                else if (v === 'rounded') patch({ mask: undefined, radius: e.radius > 0 ? e.radius : 24 })
                else {
                  // circle: centre-square crop of the current crop, then a round mask
                  const im = getCachedImage(e.src)
                  let crop = e.crop
                  if (im) {
                    const cur = e.crop ?? { x: 0, y: 0, w: 1, h: 1 }
                    const side = Math.min(cur.w * im.naturalWidth, cur.h * im.naturalHeight)
                    const w = side / im.naturalWidth
                    const h = side / im.naturalHeight
                    crop = { x: cur.x + (cur.w - w) / 2, y: cur.y + (cur.h - h) / 2, w, h }
                  }
                  patch({ mask: 'circle', crop, h: e.w })
                }
              }}
            />
          )}
          {e.mask !== 'circle' && (
            <div className="slide-row">
              <Slider label="Corner radius" value={Math.min(200, Math.round(e.radius))} min={0} max={Math.max(24, Math.round(Math.min(e.w, e.h) / 2))} onChange={(v) => patch({ radius: v }, 'rad')} />
              <Num label="Corner radius" value={e.radius} min={0} onChange={(v) => patch({ radius: v }, 'rad')} suffix="px" />
            </div>
          )}
        </Section>
      )}

      {isText && !multi && show('edit') && (
        <Section title="Text">
          <textarea className="txt area" aria-label="Text content" rows={3} autoFocus={only === 'edit'} value={e.text ?? ''} onChange={(ev) => patch({ text: ev.target.value }, 'text')} />
        </Section>
      )}

      {isText && !multi && show('font') && (
        <Section title="Font">
          <FontPicker value={e.fontFamily} onPick={(f) => patch({ fontFamily: f })} />
          <Field label="Weight">
            <select className="txt wide" aria-label="Font weight" value={e.fontWeight} onChange={(ev) => patch({ fontWeight: Number(ev.target.value) })}>
              {WEIGHTS.map(([w, n]) => (
                <option key={w} value={w}>
                  {n} ({w})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Text size">
            <div className="chips" role="group" aria-label="Font size presets">
              {SIZES.map((n) => (
                <button key={n} className={'chipbtn' + (e.fontSize === n ? ' on' : '')} aria-pressed={e.fontSize === n} onClick={() => patch({ fontSize: n })}>
                  {n}
                </button>
              ))}
            </div>
            <div className="slide-row">
              <Slider label="Font size" value={Math.min(160, Math.max(8, e.fontSize ?? 16))} min={8} max={160} onChange={(v) => patch({ fontSize: v }, 'fs')} />
              <Num label="Font size" value={e.fontSize ?? 16} min={1} max={500} onChange={(v) => patch({ fontSize: v }, 'fs')} suffix="px" />
            </div>
          </Field>
        </Section>
      )}

      {isText && !multi && show('format') && (
        <Section title="Style">
          <Field label="Align and style">
            <div className="btnrow">
              <Seg
                label="Text alignment"
                value={e.align ?? 'left'}
                onChange={(a) => patch({ align: a })}
                options={[
                  { v: 'left', label: <AlignLeft size={16} />, aria: 'Align text left' },
                  { v: 'center', label: <AlignCenter size={16} />, aria: 'Align text center' },
                  { v: 'right', label: <AlignRight size={16} />, aria: 'Align text right' },
                ]}
              />
              <button className={'ic sq' + (e.underline ? ' on' : '')} aria-label="Underline" aria-pressed={!!e.underline} onClick={() => patch({ underline: !e.underline })}>
                <Underline size={16} />
              </button>
            </div>
          </Field>
          <div className="grid2">
            <Field label="Line height">
              <Num label="Line height" value={e.lineHeight ?? 1.2} step={0.1} min={0.5} max={4} onChange={(v) => patch({ lineHeight: v }, 'lh')} suffix="LH" />
            </Field>
            <Field label="Letter spacing">
              <Num label="Letter spacing" value={e.letterSpacing ?? 0} step={0.5} onChange={(v) => patch({ letterSpacing: v }, 'ls')} suffix="LS" />
            </Field>
          </div>
        </Section>
      )}

      {hasFill && show('colour') && (
        <Section title={isText ? 'Text color' : 'Fill'}>
          <FillControls e={e} patch={patch} palette={doc.palette} onSave={savePalette(e.fill)} />
        </Section>
      )}

      {(hasStroke || isLine) && show('stroke') && (
        <Section title={isLine ? 'Line' : 'Stroke'} action={!isLine ? <Toggle label="Stroke" on={e.strokeOn} onChange={(v) => patch({ strokeOn: v })} /> : undefined}>
          {(e.strokeOn || isLine) && (
            <>
              <ColorField value={e.stroke} swatches={doc.palette} onSave={savePalette(e.stroke)} onChange={(c) => patch({ stroke: c }, 'stroke')} />
              <Field label="Width">
                <div className="slide-row">
                  <Slider label="Stroke width" value={Math.min(40, e.strokeWidth)} min={0} max={40} onChange={(v) => patch({ strokeWidth: v }, 'sw')} />
                  <Num label="Stroke width" value={e.strokeWidth} min={0} max={100} onChange={(v) => patch({ strokeWidth: v }, 'sw')} suffix="px" />
                </div>
              </Field>
            </>
          )}
        </Section>
      )}

      {show('opacity') && (
      <Section title="Appearance">
        <Field label="Opacity">
          <div className="slide-row">
            <Slider label="Opacity" value={Math.round(e.opacity * 100)} min={0} max={100} onChange={(v) => patch({ opacity: v / 100 }, 'op')} />
            <Num label="Opacity percent" value={Math.round(e.opacity * 100)} min={0} max={100} onChange={(v) => patch({ opacity: v / 100 }, 'op')} suffix="%" />
          </div>
        </Field>
      </Section>
      )}

      {show('shadow') && (
      <Section title="Shadow" action={<Toggle label="Shadow" on={e.shadow.enabled} onChange={(v) => patch({ shadow: { ...e.shadow, enabled: v } })} />}>
        {e.shadow.enabled && (
          <>
            <div className="btnrow">
              <button className="mini" onClick={() => patch({ shadow: { enabled: true, x: 0, y: 8, blur: 24, color: '#000000', opacity: 0.18 } })}>
                Soft
              </button>
              <button className="mini" onClick={() => patch({ shadow: { enabled: true, x: 0, y: 2, blur: 4, color: '#000000', opacity: 0.25 } })}>
                Drop
              </button>
              <button className="mini" onClick={() => patch({ shadow: { enabled: true, x: 6, y: 6, blur: 0, color: '#000000', opacity: 0.3 } })}>
                Hard
              </button>
            </div>
            {!multi && (
              <div className="grid3">
                <Num label="Shadow X" value={e.shadow.x} onChange={(v) => patch({ shadow: { ...e.shadow, x: v } }, 'shx')} suffix="X" />
                <Num label="Shadow Y" value={e.shadow.y} onChange={(v) => patch({ shadow: { ...e.shadow, y: v } }, 'shy')} suffix="Y" />
                <Num label="Shadow blur" value={e.shadow.blur} min={0} onChange={(v) => patch({ shadow: { ...e.shadow, blur: v } }, 'shb')} suffix="B" />
              </div>
            )}
            <ColorField value={e.shadow.color} onChange={(c) => patch({ shadow: { ...e.shadow, color: c } }, 'shc')} />
            <Field label="Shadow opacity">
              <Slider label="Shadow opacity" value={Math.round(e.shadow.opacity * 100)} min={0} max={100} onChange={(v) => patch({ shadow: { ...e.shadow, opacity: v / 100 } }, 'sho')} />
            </Field>
          </>
        )}
      </Section>
      )}

      {!multi && show('link') && (
        <Section title="Prototype">
          <Field label="On tap, go to">
            <select className="txt wide" aria-label="Prototype link target" value={e.link ?? ''} onChange={(ev) => patch({ link: ev.target.value || undefined })}>
              <option value="">No link</option>
              {doc.artboards.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
              {e.link && !doc.artboards.some((a) => a.id === e.link) && <option value={e.link}>Missing screen</option>}
            </select>
          </Field>
        </Section>
      )}

      {show('arrange') && (
        <Section title="Arrange">
          <div className="btnrow">
            <button className="mini" onClick={() => st.reorder('front')}>
              <ArrowUpToLine size={14} /> To front
            </button>
            <button className="mini" onClick={() => st.reorder('up')}>
              <ChevronUp size={14} /> Forward
            </button>
          </div>
          <div className="btnrow">
            <button className="mini" onClick={() => st.reorder('down')}>
              <ChevronDown size={14} /> Backward
            </button>
            <button className="mini" onClick={() => st.reorder('back')}>
              <ArrowDownToLine size={14} /> To back
            </button>
          </div>
          <div className="btnrow">
            <button className="mini" onClick={() => patch({ locked: !e.locked })}>
              {e.locked ? <Unlock size={14} /> : <Lock size={14} />} {e.locked ? 'Unlock' : 'Lock'}
            </button>
          </div>
          <div className="arr-list-h">All layers</div>
          <LayerList multi={multi} />
        </Section>
      )}

      {(!only || only === 'all') && (
        <div className="btnrow end">
          <button className="mini" onClick={() => st.duplicateSel()}>
            <Copy size={14} /> Duplicate
          </button>
          <button className="mini danger" onClick={() => st.removeSel()}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  )
}
