import { useState } from 'react'
import { useEditor } from '../../state/editor'
import { useUI } from '../../state/ui'
import { renderArtboardImage } from '../canvas/CanvasView'
import { exportArtboardSvg } from '../../services/svg'
import { saveDataUrl, saveText } from '../../services/files'
import { serializeProject } from '../../engine/doc'
import { flushSave } from '../../database/persistence'
import { Field, Section, Seg, Toggle } from '../inspector/controls'

const safe = (s: string) => s.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 40) || 'design'

export default function ExportPanel() {
  const doc = useEditor((s) => s.doc)!
  const sel = useEditor((s) => s.sel)
  const [fmt, setFmt] = useState<'png' | 'jpeg' | 'svg'>('png')
  const [scale, setScale] = useState(2)
  const [all, setAll] = useState(false)
  const [transparent, setTransparent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [warn, setWarn] = useState<string[]>([])
  const say = useUI.getState().say

  const run = async () => {
    setBusy(true)
    setWarn([])
    try {
      const abs = all ? doc.artboards : doc.artboards.filter((a) => a.id === (sel.abId ?? doc.artboards[0].id))
      const warnings: string[] = []
      for (const ab of abs) {
        const base = `${safe(doc.name)}-${safe(ab.name)}`
        if (fmt === 'svg') {
          const r = exportArtboardSvg(ab)
          warnings.push(...r.warnings)
          await saveText(`${base}.svg`, r.svg, 'image/svg+xml')
        } else {
          const url = renderArtboardImage(ab.id, scale, fmt === 'png' ? 'image/png' : 'image/jpeg', transparent)
          if (!url) throw new Error('Could not render the artboard')
          await saveDataUrl(`${base}@${scale}x.${fmt === 'png' ? 'png' : 'jpg'}`, url)
        }
      }
      setWarn(warnings)
      say(`Exported ${abs.length} file${abs.length > 1 ? 's' : ''}`)
    } catch (e: any) {
      say(e?.message ?? 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="props">
      <Section title="Image or vector">
        <Field label="Format">
          <Seg
            label="Export format"
            value={fmt}
            onChange={setFmt}
            options={[
              { v: 'png', label: 'PNG' },
              { v: 'jpeg', label: 'JPEG' },
              { v: 'svg', label: 'SVG' },
            ]}
          />
        </Field>
        {fmt !== 'svg' && (
          <Field label="Scale">
            <Seg
              label="Export scale"
              value={scale}
              onChange={setScale}
              options={[1, 2, 3, 4].map((n) => ({ v: n, label: `${n}x` }))}
            />
          </Field>
        )}
        {fmt === 'png' && (
          <div className="field inline">
            <span className="flabel">Transparent background</span>
            <Toggle label="Transparent background" on={transparent} onChange={setTransparent} />
          </div>
        )}
        <div className="field inline">
          <span className="flabel">All artboards ({doc.artboards.length})</span>
          <Toggle label="Export all artboards" on={all} onChange={setAll} />
        </div>
        <button className="big primary" disabled={busy} onClick={() => void run()}>
          {busy ? 'Exporting...' : all ? 'Export all artboards' : 'Export current artboard'}
        </button>
        {warn.length > 0 && <div className="warn">SVG notes: {warn.join('; ')}</div>}
        <div className="hint flush">On Android the share sheet opens so you can save to Files, Drive and more.</div>
      </Section>
      <Section title="Project backup">
        <button
          className="big"
          onClick={async () => {
            await flushSave(undefined, true)
            await saveText(`${safe(doc.name)}.tuika.json`, serializeProject(useEditor.getState().doc!), 'application/json')
            say('Backup exported')
          }}
        >
          Export backup (.tuika.json)
        </button>
      </Section>
    </div>
  )
}
