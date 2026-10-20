import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowUp, Layers, Settings, Sparkles, Square, Trash2 } from 'lucide-react'
import { useAI } from '../../state/ai'
import type { Msg } from '../../state/ai'
import { useUI } from '../../state/ui'
import { useBackHandler } from '../../services/back'
import { addScreens, addToScreen } from '../../services/aiDesign'
import type { AiDesign } from '../../services/aiDesign'
import DesignPreview from './DesignPreview'
import AiSetup from './AiSetup'

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

function Bubble({ m, onDone, onSetup }: { m: Msg; onDone: () => void; onSetup: () => void }) {
  if (m.role === 'user') return <div className="ai-msg user">{m.text}</div>
  if (m.role === 'error')
    return (
      <div className="ai-msg err">
        {m.text}
        {/key|model|quota/i.test(m.text) && (
          <button className="mini" onClick={onSetup}>
            Open Gemini setup
          </button>
        )}
      </div>
    )
  return (
    <div className="ai-reply">
      <div className="ai-msg bot">
        <Sparkles size={14} /> <span>{m.text}</span>
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
  const { cfg, ready, msgs, busy, step, options, useScreen } = useAI()
  const [text, setText] = useState('')
  const [setup, setSetup] = useState(false)
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
    if (!t.trim() || busy || !cfg) return
    setText('')
    void useAI.getState().send(t)
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
          <Settings size={17} />
        </button>
      </header>

      <div className="ai-scroll" ref={scroller}>
        {msgs.length === 0 && (
          <div className="ai-hero">
            <span className="ai-spark">
              <Sparkles size={26} />
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
          <Bubble key={m.id} m={m} onDone={close} onSetup={() => setSetup(true)} />
        ))}
        {busy && (
          <div className="ai-msg bot typing">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <span>{step || 'Designing...'}</span>
            <button className="mini" onClick={() => useAI.getState().stop()}>
              Stop
            </button>
          </div>
        )}
      </div>

      <div className="ai-composer">
        <div className="ai-opts">
          <div className="seg mini" role="group" aria-label="Number of options">
            {([1, 2, 3] as const).map((n) => (
              <button key={n} className={options === n ? 'on' : ''} aria-pressed={options === n} onClick={() => useAI.getState().setOptions(n)}>
                {n} {n === 1 ? 'option' : 'options'}
              </button>
            ))}
          </div>
          <button className={'chipbtn' + (useScreen ? ' on' : '')} aria-pressed={useScreen} onClick={() => useAI.getState().setUseScreen(!useScreen)}>
            <Layers size={14} /> Use this screen
          </button>
        </div>
        <div className="ai-input">
          <textarea
            aria-label="Describe your design"
            rows={1}
            value={text}
            placeholder={needSetup ? 'Set up Gemini to start' : msgs.length ? 'Ask for changes, e.g. make it darker' : 'Describe the screen you want'}
            disabled={needSetup}
            onChange={(e) => {
              setText(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(120, e.target.scrollHeight) + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send()
            }}
          />
          {busy ? (
            <button className="ai-send stop" aria-label="Stop" onClick={() => useAI.getState().stop()}>
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button className="ai-send" aria-label="Send" disabled={!text.trim() || !cfg} onClick={() => send()}>
              <ArrowUp size={18} />
            </button>
          )}
        </div>
      </div>
      {setup && <AiSetup onClose={() => setSetup(false)} />}
    </div>
  )
}
