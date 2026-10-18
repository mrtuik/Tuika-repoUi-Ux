import { AlignCenter, AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignLeft, AlignRight, AlignStartHorizontal, AlignStartVertical, Copy, Trash2, Underline } from 'lucide-react'
import { useEditor, selectedEls } from '../../state/editor'
import type { AlignMode } from '../../state/editor'
import { brokenLinks } from '../../engine/doc'
import { ColorField, Field, Num, Section, Seg, Slider, Toggle } from './controls'

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

export default function Inspector() {
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

  return (
    <div className="props">
      {multi && <div className="hint flush">{els.length} elements selected. Changes apply to all.</div>}

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

      {isText && !multi && (
        <Section title="Text">
          <textarea className="txt area" aria-label="Text content" rows={2} value={e.text ?? ''} onChange={(ev) => patch({ text: ev.target.value }, 'text')} />
          <Field label="Typeface">
            <select className="txt wide" aria-label="Font family" value={e.fontFamily} onChange={(ev) => patch({ fontFamily: ev.target.value })}>
              {FONTS.map(([v, n]) => (
                <option key={v} value={v}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
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

      {hasFill && (
        <Section title={isText ? 'Text color' : 'Fill'}>
          <ColorField value={e.fill} swatches={doc.palette} onSave={savePalette(e.fill)} onChange={(c) => patch({ fill: c }, 'fill')} />
        </Section>
      )}

      {(hasStroke || isLine) && (
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

      <Section title="Appearance">
        <Field label="Opacity">
          <div className="slide-row">
            <Slider label="Opacity" value={Math.round(e.opacity * 100)} min={0} max={100} onChange={(v) => patch({ opacity: v / 100 }, 'op')} />
            <Num label="Opacity percent" value={Math.round(e.opacity * 100)} min={0} max={100} onChange={(v) => patch({ opacity: v / 100 }, 'op')} suffix="%" />
          </div>
        </Field>
      </Section>

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

      {!multi && (
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

      <div className="btnrow end">
        <button className="mini" onClick={() => st.duplicateSel()}>
          <Copy size={14} /> Duplicate
        </button>
        <button className="mini danger" onClick={() => st.removeSel()}>
          <Trash2 size={14} /> Delete
        </button>
      </div>
    </div>
  )
}
