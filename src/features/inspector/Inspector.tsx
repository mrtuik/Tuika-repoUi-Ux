import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignStartHorizontal, AlignStartVertical, Copy, Trash2 } from 'lucide-react'
import { useEditor, selectedEls } from '../../state/editor'
import type { AlignMode } from '../../state/editor'
import { brokenLinks } from '../../engine/doc'
import { ColorField, Num, Row, Toggle } from './controls'

const FONTS = [
  ['Inter, system-ui, sans-serif', 'Inter / System'],
  ['Roboto, sans-serif', 'Roboto'],
  ['Georgia, serif', 'Georgia'],
  ['"Courier New", monospace', 'Mono'],
  ['"Trebuchet MS", sans-serif', 'Trebuchet'],
]
const WEIGHTS = [300, 400, 500, 600, 700, 800]
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

  // ---------- artboard properties ----------
  if (els.length === 0) {
    const broken = brokenLinks(doc)
    return (
      <div className="props">
        <Row label="Name">
          <input className="txt wide" aria-label="Artboard name" value={ab.name} onChange={(e) => st.patchArtboard(ab.id, { name: e.target.value }, 'abname')} />
        </Row>
        <Row label="Position">
          <Num label="Artboard X" value={ab.x} onChange={(v) => st.patchArtboard(ab.id, { x: v }, 'abx')} suffix="X" />
          <Num label="Artboard Y" value={ab.y} onChange={(v) => st.patchArtboard(ab.id, { y: v }, 'aby')} suffix="Y" />
        </Row>
        <Row label="Size">
          <Num label="Artboard width" value={ab.w} min={16} max={8000} onChange={(v) => st.patchArtboard(ab.id, { w: v }, 'abw')} suffix="W" />
          <Num label="Artboard height" value={ab.h} min={16} max={8000} onChange={(v) => st.patchArtboard(ab.id, { h: v }, 'abh')} suffix="H" />
        </Row>
        <Row label="Fill" stack>
          <ColorField value={ab.bg} swatches={doc.palette} onChange={(c) => st.patchArtboard(ab.id, { bg: c }, 'abbg')} />
        </Row>
        <Row label="Start screen">
          <Toggle label="Use as start screen" on={doc.startId === ab.id} onChange={(v) => v && st.commit((d) => void (d.startId = ab.id))} />
        </Row>
        <Row label="Order">
          <button className="mini" onClick={() => st.moveArtboardOrder(ab.id, -1)}>
            Earlier
          </button>
          <button className="mini" onClick={() => st.moveArtboardOrder(ab.id, 1)}>
            Later
          </button>
        </Row>
        <Row label="Artboard">
          <button className="mini" onClick={() => st.duplicateArtboard(ab.id)}>
            <Copy size={14} /> Duplicate
          </button>
          <button className="mini danger" disabled={doc.artboards.length <= 1} onClick={() => window.confirm(`Delete "${ab.name}" and everything on it?`) && st.removeArtboard(ab.id)}>
            <Trash2 size={14} /> Delete
          </button>
        </Row>
        {broken.length > 0 && <div className="warn">{broken.length} prototype link(s) point to a deleted screen: {broken.map((b) => b.name).join(', ')}</div>}
      </div>
    )
  }

  // ---------- element properties ----------
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
      {multi && <div className="note">{els.length} elements selected. Changes apply to all.</div>}

      <Row label="Position">
        <div className="aligns">
          {ALIGNS.map(({ m, I, l }) => (
            <button key={m} className="ic" aria-label={l} title={l} onClick={() => st.align(m)}>
              <I size={16} />
            </button>
          ))}
        </div>
      </Row>
      {!multi && (
        <>
          <Row label="X / Y">
            <Num label="X" value={e.x} onChange={(v) => patch({ x: v }, 'x')} suffix="X" />
            <Num label="Y" value={e.y} onChange={(v) => patch({ y: v }, 'y')} suffix="Y" />
          </Row>
          <Row label="W / H">
            <Num label="Width" value={e.w} min={0} onChange={(v) => patch({ w: v }, 'w')} suffix="W" />
            <Num label="Height" value={e.h} min={0} onChange={(v) => patch({ h: v }, 'h')} suffix="H" />
          </Row>
          <Row label="Rotation">
            <Num label="Rotation" value={e.rotation} onChange={(v) => patch({ rotation: v }, 'rot')} suffix="deg" />
          </Row>
        </>
      )}

      {hasFill && (
        <Row label={isText ? 'Text color' : 'Fill'} stack>
          <ColorField value={e.fill} swatches={doc.palette} onChange={(c) => patch({ fill: c }, 'fill')} />
          <button className="mini" onClick={() => !doc.palette.includes(e.fill) && st.commit((d) => void d.palette.push(e.fill))}>
            Save as color style
          </button>
        </Row>
      )}

      {(hasStroke || isLine) && (
        <>
          {!isLine && (
            <Row label="Stroke">
              <Toggle label="Stroke" on={e.strokeOn} onChange={(v) => patch({ strokeOn: v })} />
            </Row>
          )}
          {(e.strokeOn || isLine) && (
            <>
              <Row label={isLine ? 'Color' : 'Stroke color'} stack>
                <ColorField value={e.stroke} swatches={doc.palette} onChange={(c) => patch({ stroke: c }, 'stroke')} />
              </Row>
              <Row label="Width">
                <Num label="Stroke width" value={e.strokeWidth} min={0} max={100} onChange={(v) => patch({ strokeWidth: v }, 'sw')} suffix="px" />
              </Row>
            </>
          )}
        </>
      )}

      {hasRadius && !multi && (
        <Row label="Radius">
          <Num label="Corner radius" value={e.radius} min={0} onChange={(v) => patch({ radius: v }, 'rad')} suffix="px" />
        </Row>
      )}

      {isText && !multi && (
        <>
          <Row label="Content" stack>
            <textarea className="txt area" aria-label="Text content" rows={3} value={e.text ?? ''} onChange={(ev) => patch({ text: ev.target.value }, 'text')} />
          </Row>
          <Row label="Font">
            <select className="txt" aria-label="Font family" value={e.fontFamily} onChange={(ev) => patch({ fontFamily: ev.target.value })}>
              {FONTS.map(([v, n]) => (
                <option key={v} value={v}>
                  {n}
                </option>
              ))}
            </select>
            <select className="txt" aria-label="Font weight" value={e.fontWeight} onChange={(ev) => patch({ fontWeight: Number(ev.target.value) })}>
              {WEIGHTS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Text size">
            <input type="range" aria-label="Font size slider" min={8} max={160} value={e.fontSize ?? 16} onChange={(ev) => patch({ fontSize: Number(ev.target.value) }, 'fs')} />
            <Num label="Font size" value={e.fontSize ?? 16} min={1} max={500} onChange={(v) => patch({ fontSize: v }, 'fs')} suffix="px" />
          </Row>
          <Row label="Spacing">
            <Num label="Line height" value={e.lineHeight ?? 1.2} step={0.1} min={0.5} max={4} onChange={(v) => patch({ lineHeight: v }, 'lh')} suffix="LH" />
            <Num label="Letter spacing" value={e.letterSpacing ?? 0} step={0.5} onChange={(v) => patch({ letterSpacing: v }, 'ls')} suffix="LS" />
          </Row>
          <Row label="Align">
            {(['left', 'center', 'right'] as const).map((a) => (
              <button key={a} className={'mini' + (e.align === a ? ' on' : '')} onClick={() => patch({ align: a })}>
                {a}
              </button>
            ))}
            <button className={'mini' + (e.underline ? ' on' : '')} aria-pressed={!!e.underline} onClick={() => patch({ underline: !e.underline })}>
              U
            </button>
          </Row>
        </>
      )}

      <Row label="Opacity">
        <input type="range" aria-label="Opacity slider" min={0} max={100} value={Math.round(e.opacity * 100)} onChange={(ev) => patch({ opacity: Number(ev.target.value) / 100 }, 'op')} />
        <Num label="Opacity percent" value={Math.round(e.opacity * 100)} min={0} max={100} onChange={(v) => patch({ opacity: v / 100 }, 'op')} suffix="%" />
      </Row>

      <Row label="Shadow">
        <button
          className="mini"
          onClick={() => patch({ shadow: { enabled: true, x: 0, y: 8, blur: 24, color: '#000000', opacity: 0.18 } })}
        >
          Soft
        </button>
        <button className="mini" onClick={() => patch({ shadow: { enabled: true, x: 0, y: 2, blur: 4, color: '#000000', opacity: 0.25 } })}>
          Drop
        </button>
        <Toggle label="Shadow" on={e.shadow.enabled} onChange={(v) => patch({ shadow: { ...e.shadow, enabled: v } })} />
      </Row>
      {e.shadow.enabled && !multi && (
        <>
          <Row label="Offset">
            <Num label="Shadow X" value={e.shadow.x} onChange={(v) => patch({ shadow: { ...e.shadow, x: v } }, 'shx')} suffix="X" />
            <Num label="Shadow Y" value={e.shadow.y} onChange={(v) => patch({ shadow: { ...e.shadow, y: v } }, 'shy')} suffix="Y" />
            <Num label="Shadow blur" value={e.shadow.blur} min={0} onChange={(v) => patch({ shadow: { ...e.shadow, blur: v } }, 'shb')} suffix="B" />
          </Row>
          <Row label="Shadow color" stack>
            <ColorField value={e.shadow.color} onChange={(c) => patch({ shadow: { ...e.shadow, color: c } }, 'shc')} />
          </Row>
          <Row label="Shadow opacity">
            <input type="range" aria-label="Shadow opacity" min={0} max={100} value={Math.round(e.shadow.opacity * 100)} onChange={(ev) => patch({ shadow: { ...e.shadow, opacity: Number(ev.target.value) / 100 } }, 'sho')} />
          </Row>
        </>
      )}

      {!multi && (
        <Row label="Tap goes to">
          <select
            className="txt"
            aria-label="Prototype link target"
            value={e.link ?? ''}
            onChange={(ev) => patch({ link: ev.target.value || undefined })}
          >
            <option value="">No link</option>
            {doc.artboards.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            {e.link && !doc.artboards.some((a) => a.id === e.link) && <option value={e.link}>Missing screen</option>}
          </select>
        </Row>
      )}

      <Row label="Element">
        <button className="mini" onClick={() => st.duplicateSel()}>
          <Copy size={14} /> Duplicate
        </button>
        <button className="mini danger" onClick={() => st.removeSel()}>
          <Trash2 size={14} /> Delete
        </button>
      </Row>
    </div>
  )
}
