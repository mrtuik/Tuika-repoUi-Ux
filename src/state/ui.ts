import { create } from 'zustand'

export type Sheet = null | 'props' | 'layers' | 'assets' | 'export' | 'more'
/** Panels of the contextual (Canva-style) toolbar that appears when an element is selected. */
export type CtxPanel = 'edit' | 'font' | 'colour' | 'format' | 'stroke' | 'corners' | 'opacity' | 'shadow' | 'position' | 'link' | 'arrange' | 'all'
export type ElemPage = 'home' | 'shapes' | 'icons' | 'online' | 'photos' | 'library' | 'upload'

interface UI {
  sheet: Sheet
  elemPage: ElemPage
  ctx: CtxPanel | null
  grid: boolean
  preview: boolean
  toast: string
  setSheet: (s: Sheet) => void
  setElemPage: (p: ElemPage) => void
  openElements: (p?: ElemPage) => void
  setCtx: (c: CtxPanel | null) => void
  toggleGrid: () => void
  setPreview: (v: boolean) => void
  say: (m: string) => void
}

let t: ReturnType<typeof setTimeout> | null = null

export const useUI = create<UI>((set) => ({
  sheet: null,
  elemPage: 'home',
  ctx: null,
  grid: false,
  preview: false,
  toast: '',
  setSheet: (sheet) => set({ sheet, ctx: null }),
  setElemPage: (elemPage) => set({ elemPage }),
  openElements: (p = 'home') => set({ sheet: 'assets', elemPage: p, ctx: null }),
  setCtx: (ctx) => set({ ctx }),
  toggleGrid: () => set((s) => ({ grid: !s.grid })),
  setPreview: (preview) => set({ preview }),
  say: (toast) => {
    set({ toast })
    if (t) clearTimeout(t)
    t = setTimeout(() => set({ toast: '' }), 3500)
  },
}))
