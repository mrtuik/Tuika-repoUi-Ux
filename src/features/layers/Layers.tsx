import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, Circle, Copy, Eye, EyeOff, Image as ImageIcon, Lock, Minus, MoveRight, Plus, Search, Shapes, Square, Trash2, Type, Unlock } from 'lucide-react'
import { useEditor } from '../../state/editor'
import type { ElType } from '../../engine/types'
import { Seg } from '../inspector/controls'

const ICON: Record<ElType, typeof Square> = { rect: Square, ellipse: Circle, text: Type, image: ImageIcon, icon: Shapes, line: Minus, arrow: MoveRight }

/** Every element of the current screen, top layer first. Tap one to select it. Used by the Layers sheet and the Arrange panel. */
export function LayerList({ multi = false }: { multi?: boolean }) {
  const doc = useEditor((s) => s.doc)!
  const sel = useEditor((s) => s.sel)
  const st = useEditor.getState()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const ab = doc.artboards.find((a) => a.id === sel.abId) ?? doc.artboards[0]
  const list = [...ab.els].reverse().filter((e) => e.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      {ab.els.length > 6 && (
        <label className="search spaced">
          <Search size={16} />
          <input aria-label="Search layers" placeholder="Search layers" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      )}
      {list.length === 0 && <div className="empty small">{ab.els.length ? 'No layers match' : 'No layers yet. Use the toolbar to add some.'}</div>}

      <ul className="layer-list">
        {list.map((e) => {
          const I = ICON[e.type]
          const on = sel.elIds.includes(e.id) && sel.abId === ab.id
          return (
            <li key={e.id} className={'layer' + (on ? ' on' : '') + (e.visible ? '' : ' dim')}>
              <button
                className="layer-main"
                aria-label={`Select ${e.name}`}
                aria-pressed={on}
                onClick={() => {
                  if (multi && sel.abId === ab.id) st.select(ab.id, on ? sel.elIds.filter((i) => i !== e.id) : [...sel.elIds, e.id])
                  else st.select(ab.id, [e.id])
                }}
                onDoubleClick={() => setEditing(e.id)}
              >
                <span className="lico">
                  <I size={16} />
                </span>
                {editing === e.id ? (
                  <input
                    autoFocus
                    className="txt"
                    aria-label="Layer name"
                    defaultValue={e.name}
                    onClick={(ev) => ev.stopPropagation()}
                    onBlur={(ev) => {
                      st.patchEl(ab.id, e.id, { name: ev.target.value.trim() || e.name })
                      setEditing(null)
                    }}
                    onKeyDown={(ev) => ev.key === 'Enter' && (ev.target as HTMLInputElement).blur()}
                  />
                ) : (
                  <span className="lname">{e.name}</span>
                )}
              </button>
              <button className="ic small" aria-label={e.visible ? 'Hide layer' : 'Show layer'} onClick={() => st.patchEl(ab.id, e.id, { visible: !e.visible })}>
                {e.visible ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button className="ic small" aria-label={e.locked ? 'Unlock layer' : 'Lock layer'} onClick={() => st.patchEl(ab.id, e.id, { locked: !e.locked })}>
                {e.locked ? <Lock size={16} /> : <Unlock size={16} />}
              </button>
            </li>
          )
        })}
      </ul>

    </>
  )
}

export default function Layers() {
  const doc = useEditor((s) => s.doc)!
  const sel = useEditor((s) => s.sel)
  const st = useEditor.getState()
  const [multi, setMulti] = useState(false)
  const ab = doc.artboards.find((a) => a.id === sel.abId) ?? doc.artboards[0]

  return (
    <div className="layers">
      <div className="artboard-tabs" role="tablist" aria-label="Artboards">
        {doc.artboards.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={a.id === ab.id}
            className={'chip' + (a.id === ab.id ? ' on' : '')}
            onClick={() => {
              st.select(a.id, [])
              window.dispatchEvent(new CustomEvent('tuika-focus', { detail: a.id }))
            }}
          >
            {a.name}
          </button>
        ))}
        <button
          className="chip plus"
          aria-label="Add artboard"
          onClick={() => {
            const id = st.addArtboard()
            if (id) window.dispatchEvent(new CustomEvent('tuika-focus', { detail: id }))
          }}
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="spaced">
        <Seg label="Selection mode" value={multi ? 'multi' : 'one'} onChange={(v) => setMulti(v === 'multi')} options={[{ v: 'one', label: 'Select one' }, { v: 'multi', label: 'Select many' }]} />
      </div>

      <LayerList multi={multi} />

      {sel.elIds.length > 0 && (
        <div className="actionbar" role="toolbar" aria-label="Layer actions">
          <button className="ic" aria-label="Bring forward" onClick={() => st.reorder('up')}>
            <ArrowUp size={17} />
          </button>
          <button className="ic" aria-label="Send backward" onClick={() => st.reorder('down')}>
            <ArrowDown size={17} />
          </button>
          <button className="ic" aria-label="Bring to front" onClick={() => st.reorder('front')}>
            <ChevronsUp size={17} />
          </button>
          <button className="ic" aria-label="Send to back" onClick={() => st.reorder('back')}>
            <ChevronsDown size={17} />
          </button>
          <button className="ic" aria-label="Duplicate" onClick={() => st.duplicateSel()}>
            <Copy size={17} />
          </button>
          <button className="ic danger" aria-label="Delete" onClick={() => st.removeSel()}>
            <Trash2 size={17} />
          </button>
        </div>
      )}
    </div>
  )
}
