// Renderer-independent document model. No Konva types in here.
export const DOC_VERSION = 1

export type ElType = 'rect' | 'ellipse' | 'text' | 'image' | 'icon' | 'line' | 'arrow'
export const EL_TYPES: ElType[] = ['rect', 'ellipse', 'text', 'image', 'icon', 'line', 'arrow']

export interface Shadow {
  enabled: boolean
  x: number
  y: number
  blur: number
  color: string
  opacity: number
}

export interface Gradient {
  type: 'linear' | 'radial'
  angle: number // degrees, 0 = left to right, 90 = top to bottom (linear only)
  stops: { color: string; pos: number }[] // pos 0..1
}

export interface Crop {
  x: number // normalised 0..1 of the source image
  y: number
  w: number
  h: number
}

export interface El {
  id: string
  type: ElType
  name: string
  x: number
  y: number
  w: number
  h: number
  rotation: number
  visible: boolean
  locked: boolean
  opacity: number
  fill: string
  stroke: string
  strokeWidth: number
  strokeOn: boolean
  radius: number
  text?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: number
  align?: 'left' | 'center' | 'right'
  lineHeight?: number
  letterSpacing?: number
  underline?: boolean
  src?: string // image data URL
  svg?: string // sanitized svg markup (icons)
  shadow: Shadow
  link?: string // prototype: target artboard id
  fillGradient?: Gradient // rect, ellipse, text
  crop?: Crop // images
  mask?: 'circle' // images
  groupId?: string // elements sharing a groupId move/resize/duplicate together
}

export interface Artboard {
  id: string
  name: string
  x: number
  y: number
  w: number
  h: number
  bg: string
  els: El[] // index 0 = bottom of stack
}

export interface Asset {
  id: string
  name: string
  kind: 'icon' | 'image'
  svg?: string
  src?: string
  source?: string
}

export interface Doc {
  version: number
  id: string
  name: string
  artboards: Artboard[]
  startId: string
  palette: string[] // saved color styles
  assets: Asset[]
  createdAt: number
  updatedAt: number
}

export interface ProjectMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  artboards: number
  thumb?: string
}

export interface DevicePreset {
  id: string
  name: string
  w: number
  h: number
}

export const DEVICE_PRESETS: DevicePreset[] = [
  { id: 'android-s', name: 'Android Small', w: 360, h: 640 },
  { id: 'android-m', name: 'Android Medium', w: 360, h: 800 },
  { id: 'pixel', name: 'Pixel', w: 412, h: 915 },
  { id: 'iphone-se', name: 'iPhone SE', w: 375, h: 667 },
  { id: 'iphone-15', name: 'iPhone 15', w: 393, h: 852 },
  { id: 'iphone-max', name: 'iPhone Pro Max', w: 430, h: 932 },
  { id: 'tablet-8', name: 'Tablet 8"', w: 600, h: 960 },
  { id: 'ipad', name: 'iPad', w: 768, h: 1024 },
  { id: 'custom', name: 'Custom', w: 360, h: 800 },
]
