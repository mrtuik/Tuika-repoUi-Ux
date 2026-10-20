import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowUp, ChevronRight, History, Pencil, Plus, Square, Trash2, X } from 'lucide-react'
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
  const { steps, step, startedAt } = useAI()
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])
  const secs = Math.max(0, Math.round((now - startedAt) / 1000))
  return (
    <div className="ai-live">
      <ThinkBlock live steps={steps} label={step || 'Thinking...'} />
      <div className="ai-live-row">
        <small>{secs}s</small>
        <button className="mini" onClick={() => useAI.getState().stop()}>
          Stop
        </button>
      </div>
    </div>
  )
}

function UserBubble({ m, busy, onPreview }: { m: Msg; busy: boolean; onPreview: (u: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [txt, setTxt] = useState(m.text)
  const [pics, setPics] = useState<AiImage[]>(m.pics ?? [])
  const [err, setErr] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  const open = () => {
    setTxt(m.text)
    setPics(m.pics ?? [])
    setErr('')
    setEditing(true)
  }
  const add = async (files: FileList | null) => {
    if (!files?.length) return
    setErr('')
    try {
      const read = await Promise.all([...files].slice(0, Math.max(0, 3 - pics.length)).map(readImage))
      setPics((p) => [...p, ...read].slice(0, 3))
    } catch (e: any) {
      setErr(e?.message ?? 'Could not add that image.')
    }
    if (ref.current) ref.current.value = ''
  }
  if (editing)
    return (
      <div className="ai-edit">
        {pics.length > 0 && (
          <div className="ai-thumbs">
            {pics.map((im, i) => (
              <span key={i} className="ai-thumb">
                <img src={im.url} alt={`Image ${i + 1}`} onClick={() => onPreview(im.url)} />
                <button aria-label="Remove image" onClick={() => setPics((p) => p.filter((_, k) => k !== i))}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        {err && <span className="ai-imgerr">{err}</span>}
        <textarea aria-label="Edit your message" value={txt} rows={3} onChange={(e) => setTxt(e.target.value)} autoFocus />
        <div className="ai-edit-bar">
          <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => void add(e.target.files)} />
          <button className="ai-plus sm" aria-label="Add a photo" disabled={pics.length >= 3} onClick={() => ref.current?.click()}>
            <Plus size={18} />
          </button>
          <span className="ai-sp" />
          <button className="mini" onClick={() => setEditing(false)}>
            Cancel
          </button>
          <button
            className="mini dark"
            disabled={busy || (!txt.trim() && !pics.length)}
            onClick={() => {
              setEditing(false)
              void useAI.getState().edit(m.id, txt, pics)
            }}
          >
            Send
          </button>
        </div>
      </div>
    )
  return (
    <div className="ai-user">
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
      <button className="ai-edit-btn" aria-label="Edit message" disabled={busy} onClick={open}>
        <Pencil size={14} />
      </button>
    </div>
  )
}

function Thought({ m }: { m: Msg }) {
  if (!m.thought) return null
  return <ThinkBlock steps={m.thought.steps} label={`Thought for ${m.thought.secs}s`} />
}

function Bubble({ m, busy, onDone, onSetup, onPreview }: { m: Msg; busy: boolean; onDone: () => void; onSetup: () => void; onPreview: (u: string) => void }) {
  if (m.role === 'user') return <UserBubble key={m.id} m={m} busy={busy} onPreview={onPreview} />
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
  const [text, setText] = useState('')
  const [setup, setSetup] = useState(false)
  const [imgs, setImgs] = useState<AiImage[]>([])
  const [imgErr, setImgErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const close = () => useUI.getState().setAiOpen(false)
  useBackHandler(true, close)

  useEffect(() => {
    void useAI.getState().init()
  }, [])
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [msgs.length, busy])

  const send = (t = text) => {
    if ((!t.trim() && !imgs.length) || busy || !cfg) return
    setText('')
    const pics = imgs
    setImgs([])
    void useAI.getState().send(t, pics)
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
        {msgs.length > 0 && (
          <button className="ic" aria-label="New chat" onClick={() => useAI.getState().clear()}>
            <Trash2 size={17} />
          </button>
        )}
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
          <Bubble key={m.id} m={m} busy={busy} onDone={close} onSetup={() => setSetup(true)} onPreview={setPreview} />
        ))}
        {busy && <LiveThink />}
      </div>

      <div className="ai-composer">
        <div className="ai-box">
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
            aria-label="Describe your design"
            rows={2}
            value={text}
            placeholder={needSetup ? 'Set up Gemini to start' : imgs.length ? 'Add a note, or just send to follow this design' : msgs.length ? 'Ask for changes, e.g. make it darker' : 'Describe it, or attach a design to follow'}
            disabled={needSetup}
            onChange={(e) => {
              setText(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(140, e.target.scrollHeight) + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send()
            }}
          />
          <div className="ai-bar">
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void pick(e.target.files)} />
            <button className="ai-plus" aria-label="Add a photo" disabled={busy || needSetup || imgs.length >= 3} onClick={() => fileRef.current?.click()}>
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
