/**
 * Google Gemini (Generative Language API) client. The key lives only on this device (IndexedDB prefs) and requests
 * go straight from the phone to Google. In the Android app fetch() runs through the native stack (CapacitorHttp), so CORS is not an issue.
 */
import { getPref, setPref } from '../database/db'

export interface AiCfg {
  key: string
  model: string
}
export const DEFAULT_MODEL = 'gemini-2.5-flash'
const BASE = 'https://generativelanguage.googleapis.com/v1beta'
const PREF = 'ai-cfg'

export async function loadAiCfg(): Promise<AiCfg | null> {
  const c = await getPref<AiCfg | null>(PREF, null)
  return c && typeof c.key === 'string' && c.key ? { key: c.key, model: c.model || DEFAULT_MODEL } : null
}
export const saveAiCfg = (cfg: AiCfg | null) => setPref(PREF, cfg)

export const cleanModel = (m: string) => m.trim().replace(/^models\//, '')

function friendly(msg: string | undefined, status: number): string {
  const m = msg ?? ''
  if (status === 400 && /api key/i.test(m)) return 'That API key was not accepted. Check it and try again.'
  if (status === 401 || status === 403) return 'This key is not allowed to use the Gemini API. Check the key in Gemini setup.'
  if (status === 404) return 'That model was not found. Pick another one in Gemini setup.'
  if (status === 429) return 'Rate or quota limit reached. Wait a minute, or pick another model in Gemini setup.'
  if (status === 503) return 'Gemini is busy right now. Try again in a moment.'
  return m || `Gemini request failed (${status})`
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((res, rej) => {
    const t = setTimeout(res, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      rej(new DOMException('Aborted', 'AbortError'))
    })
  })

/** Models of this key that can generate text. Also proves the key works. */
export async function listModels(key: string): Promise<string[]> {
  const out: string[] = []
  let token = ''
  for (let i = 0; i < 4; i++) {
    const r = await fetch(`${BASE}/models?pageSize=100${token ? '&pageToken=' + encodeURIComponent(token) : ''}`, { headers: { 'x-goog-api-key': key } })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(friendly(j?.error?.message, r.status))
    for (const m of j.models ?? []) {
      const name = cleanModel(String(m.name ?? ''))
      if (!/^gemini/i.test(name)) continue
      if (/(embedding|tts|image|live|audio|robotics|computer-use|vision|aqa)/i.test(name)) continue
      if (Array.isArray(m.supportedGenerationMethods) && !m.supportedGenerationMethods.includes('generateContent')) continue
      out.push(name)
    }
    token = j.nextPageToken ?? ''
    if (!token) break
  }
  const rank = (n: string) => (/flash/i.test(n) && !/lite/i.test(n) ? 0 : /pro/i.test(n) ? 1 : 2)
  return [...new Set(out)].sort((a, b) => rank(a) - rank(b) || b.localeCompare(a))
}

export interface AiImage {
  mime: string
  data: string // base64, no prefix
  url: string // data URL for showing it in the chat
}
export interface Turn {
  role: 'user' | 'model'
  text: string
  images?: AiImage[]
}

/** Downscales a picked image (max 1600px, JPEG) so the request stays small but text stays readable. */
export async function readImage(file: File): Promise<AiImage> {
  const src = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('That file could not be read as an image.'))
      i.src = src
    })
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(img.naturalWidth * k))
    c.height = Math.max(1, Math.round(img.naturalHeight * k))
    const ctx = c.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.drawImage(img, 0, 0, c.width, c.height)
    const url = c.toDataURL('image/jpeg', 0.85)
    return { mime: 'image/jpeg', data: url.split(',')[1], url }
  } finally {
    URL.revokeObjectURL(src)
  }
}

export async function generateJson(cfg: AiCfg, system: string, turns: Turn[], signal?: AbortSignal): Promise<{ text: string; truncated: boolean }> {
  const url = `${BASE}/models/${encodeURIComponent(cleanModel(cfg.model))}:generateContent`
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: turns.map((t) => ({ role: t.role, parts: [...(t.images ?? []).map((im) => ({ inlineData: { mimeType: im.mime, data: im.data } })), { text: t.text }] })),
    generationConfig: { responseMimeType: 'application/json', temperature: 0.9 },
  }
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key }, body: JSON.stringify(body), signal })
    const j: any = await r.json().catch(() => ({}))
    if ((r.status === 503 || r.status === 429) && attempt === 0) {
      await wait(1800, signal)
      continue
    }
    if (!r.ok) throw new Error(friendly(j?.error?.message, r.status))
    const cand = j.candidates?.[0]
    const text = (cand?.content?.parts ?? []).map((p: any) => (typeof p.text === 'string' ? p.text : '')).join('')
    if (!text) throw new Error(j.promptFeedback?.blockReason ? `Gemini blocked this request (${j.promptFeedback.blockReason}). Try rephrasing.` : 'Gemini returned an empty answer. Try again.')
    return { text, truncated: cand?.finishReason === 'MAX_TOKENS' }
  }
}
