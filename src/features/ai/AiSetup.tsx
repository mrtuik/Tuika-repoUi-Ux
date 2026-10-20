import { useState } from 'react'
import { Check, ChevronDown, Eye, EyeOff, X } from 'lucide-react'
import { useAI } from '../../state/ai'
import { DEFAULT_MODEL, cleanModel, listModels } from '../../services/gemini'
import { useBackHandler } from '../../services/back'
import { Field, Section } from '../inspector/controls'

/** "Set up your Gemini": API key + model. Used from Home > Settings and from the Ask AI screen. */
export default function AiSetup({ onClose }: { onClose: () => void }) {
  const cfg = useAI((s) => s.cfg)
  const setCfg = useAI((s) => s.setCfg)
  const [key, setKey] = useState(cfg?.key ?? '')
  const [show, setShow] = useState(false)
  const [model, setModel] = useState(cfg?.model ?? DEFAULT_MODEL)
  const [models, setModels] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  useBackHandler(true, onClose)

  const check = async () => {
    if (!key.trim()) return setMsg({ ok: false, text: 'Paste your API key first.' })
    setBusy(true)
    setMsg(null)
    try {
      const m = await listModels(key.trim())
      setModels(m)
      setMsg({ ok: true, text: m.length ? `Key works. ${m.length} models available.` : 'Key works, but no text models were listed. Type a model name below.' })
      if (m.length) {
        setOpen(true)
        if (!m.includes(cleanModel(model))) setModel(m.find((x) => x === DEFAULT_MODEL) ?? m[0])
      }
    } catch (e: any) {
      setMsg({ ok: false, text: navigator.onLine ? e?.message ?? 'Could not check the key.' : 'You are offline.' })
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!key.trim()) return setMsg({ ok: false, text: 'Paste your API key first.' })
    await setCfg({ key: key.trim(), model: cleanModel(model) || DEFAULT_MODEL })
    onClose()
  }

  const remove = async () => {
    await setCfg(null)
    onClose()
  }

  return (
    <div className="modal-back top" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Set up your Gemini" onClick={(e) => e.stopPropagation()}>
        <div className="grab" aria-hidden />
        <div className="sheet-head">
          <strong>Set up your Gemini</strong>
          <button className="ic fill" aria-label="Close" onClick={onClose}>
            <X size={17} />
          </button>
        </div>
        <div className="modal-body">
          <div className="props np">
            <Section title="API key">
              <div className="keyrow">
                <input
                  className="txt wide"
                  aria-label="Gemini API key"
                  type={show ? 'text' : 'password'}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder="Paste your Gemini API key"
                  value={key}
                  onChange={(e) => {
                    setKey(e.target.value)
                    setMsg(null)
                  }}
                />
                <button className="ic fill" aria-label={show ? 'Hide key' : 'Show key'} onClick={() => setShow((s) => !s)}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button className="mini" onClick={() => window.open('https://aistudio.google.com/apikey', '_blank')}>
                Get a free key (Google AI Studio)
              </button>
              <p className="hint flush">The key stays on this phone. Requests go directly from the app to Google. Your prompt (and the current screen, if you switch that on) is sent to Gemini.</p>
            </Section>

            <Section title="Model">
              <Field label="Model">
                <button className={'dev-field' + (open ? ' open' : '')} aria-expanded={open} onClick={() => (models.length ? setOpen((o) => !o) : void check())}>
                  <span className="dev-name">{cleanModel(model) || DEFAULT_MODEL}</span>
                  <span className="dev-size">{busy ? 'Loading...' : models.length ? `${models.length} models` : 'Tap to load'}</span>
                  <ChevronDown size={16} />
                </button>
                {open && models.length > 0 && (
                  <div className="dev-list" role="listbox" aria-label="Gemini models">
                    {models.map((m) => (
                      <button
                        key={m}
                        role="option"
                        aria-selected={m === cleanModel(model)}
                        className={'dev-row' + (m === cleanModel(model) ? ' on' : '')}
                        onClick={() => {
                          setModel(m)
                          setOpen(false)
                        }}
                      >
                        <span className="dev-name">{m}</span>
                        {m === cleanModel(model) && <Check size={16} />}
                      </button>
                    ))}
                  </div>
                )}
              </Field>
              <Field label="Or type a model name">
                <input className="txt wide" aria-label="Model name" spellCheck={false} autoCapitalize="off" value={model} onChange={(e) => setModel(e.target.value)} placeholder={DEFAULT_MODEL} />
              </Field>
              <p className="hint flush">Flash models are fast and cheap. Pro models make more careful layouts but are slower.</p>
            </Section>
            {msg && <div className={msg.ok ? 'okmsg' : 'warn'}>{msg.text}</div>}
          </div>
        </div>
        <div className="modal-foot foot2">
          {cfg && (
            <button className="big ghost" onClick={() => void remove()}>
              Remove key
            </button>
          )}
          <button className="big ghost" disabled={busy} onClick={() => void check()}>
            {busy ? 'Checking...' : 'Test key'}
          </button>
          <button className="big primary" onClick={() => void save()}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
