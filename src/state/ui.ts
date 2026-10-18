import { create } from 'zustand'

export type Sheet = null | 'props' | 'layers' | 'assets' | 'export' | 'more'
export type AssetTab = 'icons' | 'online' | 'library' | 'images'

interface UI {
  sheet: Sheet
  assetTab: AssetTab
  grid: boolean
  preview: boolean
  toast: string
  setSheet: (s: Sheet) => void
  setAssetTab: (t: AssetTab) => void
  toggleGrid: () => void
  setPreview: (v: boolean) => void
  say: (m: string) => void
}

let t: ReturnType<typeof setTimeout> | null = null

export const useUI = create<UI>((set) => ({
  sheet: null,
  assetTab: 'icons',
  grid: false,
  preview: false,
  toast: '',
  setSheet: (sheet) => set({ sheet }),
  setAssetTab: (assetTab) => set({ assetTab }),
  toggleGrid: () => set((s) => ({ grid: !s.grid })),
  setPreview: (preview) => set({ preview }),
  say: (toast) => {
    set({ toast })
    if (t) clearTimeout(t)
    t = setTimeout(() => set({ toast: '' }), 3500)
  },
}))
