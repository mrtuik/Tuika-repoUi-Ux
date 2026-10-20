import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { generateJson, loadAiCfg, saveAiCfg } from '../services/gemini'
import type { AiCfg, Turn } from '../services/gemini'
import { parseReply, resolveDesigns, screenContext, systemPrompt } from '../services/aiDesign'
import type { AiDesign } from '../services/aiDesign'
import { useEditor } from './editor'

export interface Msg {
  id: string
  role: 'user' | 'ai' | 'error'
  text: string
  designs?: AiDesign[]
  raw?: string
}

interface AIState {
  cfg: AiCfg | null
  ready: boolean
  msgs: Msg[]
  busy: boolean
  step: string
  options: 1 | 2 | 3
  useScreen: boolean
  init: () => Promise<void>
  setCfg: (c: AiCfg | null) => Promise<void>
  setOptions: (n: 1 | 2 | 3) => void
  setUseScreen: (v: boolean) => void
  clear: () => void
  send: (prompt: string) => Promise<void>
  stop: () => void
}

let ctl: AbortController | null = null

export const useAI = create<AIState>((set, get) => ({
  cfg: null,
  ready: false,
  msgs: [],
  busy: false,
  step: '',
  options: 2,
  useScreen: false,
  init: async () => {
    if (get().ready) return
    set({ cfg: await loadAiCfg(), ready: true })
  },
  setCfg: async (cfg) => {
    await saveAiCfg(cfg)
    set({ cfg, ready: true })
  },
  setOptions: (options) => set({ options }),
  setUseScreen: (useScreen) => set({ useScreen }),
  clear: () => {
    ctl?.abort()
    set({ msgs: [], busy: false, step: '' })
  },
  stop: () => ctl?.abort(),
  send: async (prompt) => {
    const { cfg, busy, options, useScreen, msgs } = get()
    const text = prompt.trim()
    if (!text || busy) return
    const push = (m: Omit<Msg, 'id'>) => set((s) => ({ msgs: [...s.msgs, { ...m, id: nanoid(6) }] }))
    if (!cfg) return push({ role: 'error', text: 'Set up your Gemini key first.' })
    const st = useEditor.getState()
    const ab = st.doc?.artboards.find((a) => a.id === st.sel.abId) ?? st.doc?.artboards[0]
    const dev = { w: Math.round(ab?.w ?? 360), h: Math.round(ab?.h ?? 800) }

    // earlier exchanges (your request + the design JSON Gemini returned) so "make it darker" works
    const turns: Turn[] = []
    const pairs: Turn[][] = []
    for (let i = 0; i < msgs.length - 1; i++)
      if (msgs[i].role === 'user' && msgs[i + 1].role === 'ai' && msgs[i + 1].raw) pairs.push([{ role: 'user', text: msgs[i].text }, { role: 'model', text: msgs[i + 1].raw!.slice(0, 14000) }])
    for (const p of pairs.slice(-3)) turns.push(...p)
    turns.push({ role: 'user', text: text + (useScreen && ab ? `\n\nCurrent screen (JSON):\n${screenContext(ab)}` : '') })

    push({ role: 'user', text: useScreen ? text + '  (with current screen)' : text })
    ctl = new AbortController()
    set({ busy: true, step: 'Designing...' })
    try {
      const r = await generateJson(cfg, systemPrompt(dev, options), turns, ctl.signal)
      const parsed = parseReply(r.text)
      set({ step: 'Drawing icons...' })
      const designs = await resolveDesigns(parsed.designs, dev, ctl.signal)
      push({ role: 'ai', text: parsed.message || 'Here are your designs.', designs, raw: r.text })
    } catch (e: any) {
      if (e?.name !== 'AbortError') push({ role: 'error', text: e?.message ?? 'Something went wrong.' })
    } finally {
      ctl = null
      set({ busy: false, step: '' })
    }
  },
}))
