import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowUp, Check, ChevronRight, Copy, History, MoreVertical, Pencil, Plus, Square, Trash2, X } from 'lucide-react'
import { useAI } from '../../state/ai'
import type { Msg } from '../../state/ai'
import { useUI } from '../../state/ui'
import { useBackHandler } from '../../services/back'
import { addScreens, addToScreen } from '../../services/aiDesign'
import type { AiDesign } from '../../services/aiDesign'
import DesignPreview from './DesignPreview'
import AiSetup from './AiSetup'
import { AiEditIcon, PanelRightIcon } from '../editor/icons'
import { readImage } from '../../services/gemini'
import type { AiImage } from '../../services/gemini'

const IDEAS = ['Login screen for a banking app', 'Food delivery home screen', '3-step onboarding flow', 'Dark music player', 'Fitness dashboard', 'Profile and settings page']

function DesignCard({ design, onDone }: { design: AiDesign; onDone: () => void }) {
  const [idx, setIdx] = useState(0)
  const sc = design.screens[Math.min(idx, design.screens.length - 1)]
  const many = design.screens.length > 1
  return (
    <div className="ai-card">
      <div className="ai-prev" style={{ aspectRatio: `${sc.w} / ${sc.h}` }}>
        <DesignPreview screen={sc} />
      </div>
      {many && (
        <div className="ai-tabs" role="tablist" aria-label="Screens">
          {design.screens.map((s, i) => (
            <button key={i} role="tab" aria-selected={i === idx} className={i === idx ? 'on' : ''} onClick={() => setIdx(i)}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
      <div className="ai-ctitle">
        <strong>{design.title}</strong>
        <small>{many ? `${design.screens.length} screens` : sc.name}</small>
      </div>
      <div className="ai-cact">
        <button
          className="big primary"
          onClick={() => {
            if (addScreens(design)) {
              useUI.getState().say(many ? `Added ${design.screens.length} screens` : 'Added as a new screen')
              onDone()
            }
          }}
        >
          {many ? `Add ${design.screens.length} screens` : 'Add as screen'}
        </button>
        <button
          className="big ghost"
          onClick={() => {
            const n = addToScreen(sc)
            if (n) {
              useUI.getState().say(`Added ${n} elements to this screen`)
              onDone()
            }
          }}
        >
          Add to this screen
        </button>
      </div>
    </div>
  )
}

function ThinkBlock({ steps, label, live }: { steps: string[]; label: string; live?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={'ai-think' + (live ? ' live' : '')}>
      <button className="ai-think-h" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <History size={18} />
        <span className="ai-think-t">{label}</span>
        <ChevronRight size={18} className={'ai-think-c' + (open ? ' open' : '')} />
      </button>
      {open && steps.length > 0 && (
        <ol className="ai-think-b">
          {steps.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      )}
    </div>
  )
}

function LiveThink() {
  const { steps, step } = useAI()
  return (
    <div className="ai-live">
      <ThinkBlock live steps={steps} label={step || 'Thinking...'} />
    </div>
  )
}

async function copyText(t: string) {
  try {
    await navigator.clipboard.writeText(t)
    return
  } catch {
    /* fall back below */
  }
  const ta = document.createElement('textarea')
  ta.value = t
  ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0'
  document.body.appendChild(ta)
  ta.select()
  try {
    document.execCommand('copy')
  } catch {
    /* ignore */
  }
  ta.remove()
}

function UserBubble({ m, busy, editing, onEdit, onPreview }: { m: Msg; busy: boolean; editing: boolean; onEdit: () => void; onPreview: (u: string) => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className={'ai-user' + (editing ? ' editing' : '')}>
      <div className="ai-msg user">
        {m.images && m.images.length > 0 && (
          <div className="ai-imgs">
            {m.images.map((u, i) => (
              <img key={i} src={u} alt="Reference" onClick={() => onPreview(u)} />
            ))}
          </div>
        )}
        {m.text}
      </div>
      <div className="ai-acts">
        <button
          className="ai-act"
          aria-label="Copy message"
          onClick={() => {
            void copyText(m.text)
            setCopied(true)
            setTimeout(() => setCopied(false), 1400)
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
        <button className="ai-act" aria-label="Edit message" disabled={busy} onClick={onEdit}>
          <Pencil size={14} />
        </button>
      </div>
    </div>
  )
}

function Thought({ m }: { m: Msg }) {
  if (!m.thought) return null
  return <ThinkBlock steps={m.thought.steps} label={`Thought for ${m.thought.secs}s`} />
}

function Bubble({ m, busy, editing, onEdit, onDone, onSetup, onPreview }: { m: Msg; busy: boolean; editing: boolean; onEdit: () => void; onDone: () => void; onSetup: () => void; onPreview: (u: string) => void }) {
  if (m.role === 'user') return <UserBubble m={m} busy={busy} editing={editing} onEdit={onEdit} onPreview={onPreview} />
  if (m.role === 'error')
    return (
      <div className="ai-reply">
        <Thought m={m} />
        <div className="ai-msg err">
          {m.text}
          {/key|model|quota/i.test(m.text) && (
            <button className="mini" onClick={onSetup}>
              Open Gemini setup
            </button>
          )}
        </div>
      </div>
    )
  return (
    <div className="ai-reply">
      <Thought m={m} />
      <div className="ai-msg bot">
        <AiEditIcon size={16} /> <span>{m.text}</span>
      </div>
      {m.designs && (
        <div className="ai-cards">
          {m.designs.map((d, i) => (
            <DesignCard key={i} design={d} onDone={onDone} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function AskAI() {
  const { cfg, ready, msgs, busy, options } = useAI()
  const [preview, setPreview] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)
  const [menu, setMenu] = useState<null | 'menu' | 'confirm'>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState('')
  const [setup, setSetup] = useState(false)
  const [imgs, setImgs] = useState<AiImage[]>([])
  const [imgErr, setImgErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const close = () => useUI.getState().setAiOpen(false)
  const cancelEdit = () => {
    setEditId(null)
    setText('')
    setImgs([])
    setImgErr('')
  }
  useBackHandler(true, close)
  useBackHandler(!!editId, cancelEdit)
  useBackHandler(menu !== null, () => setMenu(null))
  useBackHandler(!!preview, () => setPreview(null))

  useEffect(() => {
    void useAI.getState().init()
  }, [])
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [msgs.length, busy])

  // keep the box as tall as its text (also when a message is loaded into it for editing)
  useEffect(() => {
    const t = taRef.current
    if (!t) return
    t.style.height = 'auto'
    t.style.height = Math.min(140, t.scrollHeight) + 'px'
  }, [text])

  const send = (t = text) => {
    if ((!t.trim() && !imgs.length) || busy || !cfg) return
    const pics = imgs
    const id = editId
    setText('')
    setImgs([])
    setEditId(null)
    // editing replaces that message and everything after it, and the new answer continues from there
    if (id) void useAI.getState().edit(id, t, pics)
    else void useAI.getState().send(t, pics)
  }
  const startEdit = (m: Msg) => {
    if (busy) return
    setEditId(m.id)
    setText(m.text)
    setImgs(m.pics ?? [])
    setImgErr('')
    setTimeout(() => {
      const t = taRef.current
      if (!t) return
      t.focus()
      t.setSelectionRange(t.value.length, t.value.length)
    }, 30)
  }
  const pick = async (files: FileList | null) => {
    if (!files?.length) return
    setImgErr('')
    try {
      const room = 3 - imgs.length
      const read = await Promise.all([...files].slice(0, Math.max(0, room)).map(readImage))
      setImgs((p) => [...p, ...read].slice(0, 3))
    } catch (e: any) {
      setImgErr(e?.message ?? 'Could not add that image.')
    }
    if (fileRef.current) fileRef.current.value = ''
  }
  const needSetup = ready && !cfg

  return (
    <div className="ai-screen" role="dialog" aria-modal="true" aria-label="Ask AI">
      <header className="ai-head">
        <button className="ic" aria-label="Back to the editor" onClick={close}>
          <ArrowLeft size={18} />
        </button>
        <div className="ai-title">
          <strong>Ask AI</strong>
          <small>{cfg ? cfg.model : 'Gemini not set up'}</small>
        </div>
        <button className="ic" aria-label="More options" aria-haspopup="menu" aria-expanded={menu !== null} onClick={() => setMenu(menu ? null : 'menu')}>
          <MoreVertical size={18} />
        </button>
        <button className="ic" aria-label="Gemini setup" onClick={() => setSetup(true)}>
          <PanelRightIcon size={18} />
        </button>
      </header>

      <div className="ai-scroll" ref={scroller}>
        {msgs.length === 0 && (
          <div className="ai-hero">
            <span className="ai-spark">
              <AiEditIcon size={28} />
            </span>
            <h2>What should we design?</h2>
            <p>Describe a screen or an app. Gemini makes real, editable shapes, text and icons. Pick the design you like and add it to your project.</p>
            {needSetup ? (
              <button className="big primary" onClick={() => setSetup(true)}>
                Set up your Gemini
              </button>
            ) : (
              <div className="ai-ideas">
                {IDEAS.map((i) => (
                  <button key={i} className="chip" disabled={!cfg || busy} onClick={() => send(i)}>
                    {i}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {msgs.map((m) => (
          <Bubble key={m.id} m={m} busy={busy} editing={editId === m.id} onEdit={() => startEdit(m)} onDone={close} onSetup={() => setSetup(true)} onPreview={setPreview} />
        ))}
        {busy && <LiveThink />}
      </div>

      <div className="ai-composer">
        <div className="ai-box">
          {editId && (
            <div className="ai-editing">
              <Pencil size={14} />
              <span>Editing message. The replies after it will be redone.</span>
              <button aria-label="Cancel edit" onClick={cancelEdit}>
                <X size={14} />
              </button>
            </div>
          )}
          {(imgs.length > 0 || imgErr) && (
            <div className="ai-thumbs">
              {imgs.map((im, i) => (
                <span key={i} className="ai-thumb">
                  <img src={im.url} alt={`Attached image ${i + 1}`} onClick={() => setPreview(im.url)} />
                  <button aria-label="Remove image" onClick={() => setImgs((p) => p.filter((_, k) => k !== i))}>
                    <X size={12} />
                  </button>
                </span>
              ))}
              {imgErr && <span className="ai-imgerr">{imgErr}</span>}
            </div>
          )}
          <textarea
            ref={taRef}
            aria-label="Describe your design"
            rows={2}
            value={text}
            placeholder={needSetup ? 'Set up Gemini to start' : editId ? 'Edit your message' : imgs.length ? 'Add a note, or just send to follow this design' : msgs.length ? 'Ask for changes, e.g. make it darker' : 'Describe it, or attach a design to follow'}
            disabled={needSetup}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send()
            }}
          />
          <div className="ai-bar">
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void pick(e.target.files)} />
            <button className="ai-plus" aria-label="Add a photo" disabled={needSetup || imgs.length >= 3} onClick={() => fileRef.current?.click()}>
              <Plus size={20} />
            </button>
            <span className="ai-sp" />
            <div className="ai-nums" role="group" aria-label="Number of options">
              {([1, 2, 3] as const).map((n) => (
                <button key={n} className={options === n ? 'on' : ''} aria-pressed={options === n} aria-label={`${n} ${n === 1 ? 'option' : 'options'}`} onClick={() => useAI.getState().setOptions(n)}>
                  {n}
                </button>
              ))}
            </div>
            {busy ? (
              <button className="ai-send stop" aria-label="Stop" onClick={() => useAI.getState().stop()}>
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button className="ai-send" aria-label="Send" disabled={(!text.trim() && !imgs.length) || !cfg} onClick={() => send()}>
                <ArrowUp size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
      {menu && (
        <div className="ai-menu-back" onClick={() => setMenu(null)}>
          <div className="ai-menu" role="menu" onClick={(e) => e.stopPropagation()}>
            {menu === 'menu' ? (
              <button role="menuitem" className="ai-mi danger" disabled={!msgs.length} onClick={() => setMenu('confirm')}>
                <Trash2 size={16} /> Delete chat
              </button>
            ) : (
              <div className="ai-confirm">
                <p>Delete this whole chat?</p>
                <div>
                  <button className="mini" onClick={() => setMenu(null)}>
                    Cancel
                  </button>
                  <button
                    className="mini del"
                    onClick={() => {
                      useAI.getState().clear()
                      cancelEdit()
                      setMenu(null)
                      useUI.getState().say('Chat deleted')
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {preview && (
        <div className="ai-lightbox" role="dialog" aria-label="Image preview" onClick={() => setPreview(null)}>
          <img src={preview} alt="Preview" />
          <button aria-label="Close preview" onClick={() => setPreview(null)}>
            <X size={20} />
          </button>
        </div>
      )}
      {setup && <AiSetup onClose={() => setSetup(false)} />}
    </div>
  )
}
