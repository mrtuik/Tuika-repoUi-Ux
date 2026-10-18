import { useState } from 'react'
import { ArrowDown, ArrowUp, Circle, Copy, Eye, EyeOff, Image as ImageIcon, Lock, Minus, MoveRight, Shapes, Square, Trash2, Type, Unlock } from 'lucide-react'
import { useEditor } from '../../state/editor'
import type { ElType } from '../../engine/types'

const ICON: Record<ElType, typeof Square> = { rect: Square, ellipse: Circle, text: Type, image: ImageIcon, icon: Shapes, line: Minus, arrow: MoveRight }

export default function Layers() {
  const doc = useEditor((s) => s.doc)!
  const sel = useEditor((s) => s.sel)
  const st = useEditor.getState()
  const [q, setQ] = useState('')
  const [multi, setMulti] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const ab = doc.artboards.find((a) => a.id === sel.abId) ?? doc.artboards[0]
  const list = [...ab.els].reverse().filter((e) => e.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="layers">
      <div className="artboard-tabs" role="tablist" aria-label="Artboards">
        {doc.artboards.map((a) => (
          <button key={a.id} role="tab" aria-selected={a.id === ab.id} className={'chip' + (a.id === ab.id ? ' on' : '')} onClick={() => st.select(a.id, [])}>
            {a.name}
          </button>
        ))}
        <button className="chip" aria-label="Add artboard" onClick={() => st.addArtboard()}>
          +
        </button>
      </div>
      <div className="layer-tools">
        <input className="txt" aria-label="Search layers" placeholder="Search layers" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={'mini' + (multi ? ' on' : '')} aria-pressed={multi} onClick={() => setMulti(!multi)}>
          Multi
        </button>
        <button className="mini" disabled={sel.elIds.length === 0} onClick={() => st.select(ab.id, [])}>
          Clear
        </button>
      </div>
      {list.length === 0 && <div className="empty small">{ab.els.length ? 'No layers match' : 'No layers yet. Use the toolbar to add some.'}</div>}
      <ul className="layer-list">
        {list.map((e) => {
          const I = ICON[e.type]
          const on = sel.elIds.includes(e.id) && sel.abId === ab.id
          return (
            <li key={e.id} className={'layer' + (on ? ' on' : '')}>
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
                <I size={16} />
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
              <button className="ic" aria-label={e.visible ? 'Hide layer' : 'Show layer'} onClick={() => st.patchEl(ab.id, e.id, { visible: !e.visible })}>
                {e.visible ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button className="ic" aria-label={e.locked ? 'Unlock layer' : 'Lock layer'} onClick={() => st.patchEl(ab.id, e.id, { locked: !e.locked })}>
                {e.locked ? <Lock size={16} /> : <Unlock size={16} />}
              </button>
              {on && (
                <>
                  <button className="ic" aria-label="Bring forward" onClick={() => st.reorder('up')}>
                    <ArrowUp size={16} />
                  </button>
                  <button className="ic" aria-label="Send backward" onClick={() => st.reorder('down')}>
                    <ArrowDown size={16} />
                  </button>
                  <button className="ic" aria-label="Duplicate layer" onClick={() => st.duplicateSel()}>
                    <Copy size={16} />
                  </button>
                  <button className="ic" aria-label="Delete layer" onClick={() => st.removeSel()}>
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </li>
          )
        })}
      </ul>
      {sel.elIds.length > 0 && (
        <div className="layer-tools">
          <button className="mini" onClick={() => st.reorder('front')}>
            To front
          </button>
          <button className="mini" onClick={() => st.reorder('back')}>
            To back
          </button>
        </div>
      )}
    </div>
  )
}
