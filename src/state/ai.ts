import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { generateJson, loadAiCfg, saveAiCfg } from '../services/gemini'
import type { AiCfg, AiImage, Turn } from '../services/gemini'
import { parseReply, resolveDesigns, screenContext, systemPrompt } from '../services/aiDesign'
import type { AiDesign } from '../services/aiDesign'
import { useEditor } from './editor'

export interface Msg {
  id: string
  role: 'user' | 'ai' | 'error'
  text: string
  designs?: AiDesign[]
  raw?: string
  images?: string[]
  pics?: AiImage[]
  thought?: { secs: number; steps: string[] }
}

interface AIState {
  cfg: AiCfg | null
  ready: boolean
  msgs: Msg[]
  busy: boolean
  step: string
  steps: string[]
  startedAt: number
  options: 1 | 2 | 3
  useScreen: boolean
  init: () => Promise<void>
  setCfg: (c: AiCfg | null) => Promise<void>
  setOptions: (n: 1 | 2 | 3) => void
  setUseScreen: (v: boolean) => void
  clear: () => void
  send: (prompt: string, images?: AiImage[]) => Promise<void>
  edit: (id: string, prompt: string, images: AiImage[]) => Promise<void>
  stop: () => void
}

let ctl: AbortController | null = null

export const useAI = create<AIState>((set, get) => ({
  cfg: null,
  ready: false,
  msgs: [],
  busy: false,
  step: '',
  steps: [],
  startedAt: 0,
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
    set({ msgs: [], busy: false, step: '', steps: [] })
  },
  stop: () => ctl?.abort(),
  edit: async (id, prompt, images) => {
    if (get().busy) return
    const i = get().msgs.findIndex((m) => m.id === id)
    if (i < 0) return
    // editing a message drops it and everything after it, then sends the edited version
    set((s) => ({ msgs: s.msgs.slice(0, i) }))
    await get().send(prompt, images)
  },
  send: async (prompt, images = []) => {
    const { cfg, busy, options, useScreen, msgs } = get()
    const text = prompt.trim() || (images.length ? 'Recreate this design.' : '')
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
    const refNote = images.length
      ? `\n\n[${images.length} reference image${images.length > 1 ? 's are' : ' is'} attached. Follow that design closely: same layout, sections, colours, typography, corner radii, spacing and wording, rebuilt as editable elements at the canvas size. If it is a screenshot of an app screen, recreate it faithfully, then you may improve small details. Use icons that match the ones you see.]`
      : ''
    turns.push({ role: 'user', text: text + refNote + (useScreen && ab ? `\n\nCurrent screen (JSON):\n${screenContext(ab)}` : ''), images })

    push({ role: 'user', text: useScreen ? text + '  (with current screen)' : text, images: images.map((i) => i.url), pics: images })
    ctl = new AbortController()
    const t0 = Date.now()
    const log: string[] = []
    const note = (t: string) => {
      log.push(t)
      set({ step: t, steps: [...log] })
    }
    const thought = () => ({ secs: Math.max(1, Math.round((Date.now() - t0) / 1000)), steps: [...log] })
    set({ busy: true, step: '', steps: [], startedAt: t0 })
    try {
      note(`Reading your request: "${text.length > 60 ? text.slice(0, 57) + '...' : text}"`)
      if (images.length) note(`Studying the ${images.length > 1 ? images.length + ' reference images' : 'reference image'} for layout, colours and type`)
      if (useScreen && ab) note('Checking what is already on the current screen')
      note(`Designing ${options} ${options === 1 ? 'option' : 'options'} for a ${dev.w} x ${dev.h} canvas`)
      const r = await generateJson(cfg, systemPrompt(dev, options), turns, ctl.signal)
      note('Reading the design Gemini returned')
      const parsed = parseReply(r.text)
      note('Drawing icons and placing elements')
      const designs = await resolveDesigns(parsed.designs, dev, ctl.signal)
      note('Done')
      push({ role: 'ai', text: parsed.message || 'Here are your designs.', designs, raw: r.text, thought: thought() })
    } catch (e: any) {
      if (e?.name !== 'AbortError') push({ role: 'error', text: e?.message ?? 'Something went wrong.', thought: thought() })
    } finally {
      ctl = null
      set({ busy: false, step: '', steps: [] })
    }
  },
}))
