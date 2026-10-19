import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result).split(',')[1] ?? '')
    r.onerror = () => rej(r.error)
    r.readAsDataURL(b)
  })
}

function dataUrlToBlob(url: string): Blob {
  const [head, data] = url.split(',')
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream'
  const bin = atob(data)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

/** Web: browser download. Android: write to cache and open the share sheet (Save to Files / Drive / etc). */
export async function saveBlob(name: string, blob: Blob) {
  if (Capacitor.isNativePlatform()) {
    const data = await blobToBase64(blob)
    const f = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache })
    await Share.share({ title: name, url: f.uri })
    return
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

export const saveDataUrl = (name: string, url: string) => saveBlob(name, dataUrlToBlob(url))
export const saveText = (name: string, text: string, mime: string) => saveBlob(name, new Blob([text], { type: mime }))

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}

const IMG_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_BYTES = 20 * 1024 * 1024

/** Validates, decodes and downsizes (max 1600px by default, big bitmaps are what kills a phone WebView) an image file. */
export async function readImage(file: File, max = 1600): Promise<{ src: string; w: number; h: number; name: string }> {
  if (!IMG_TYPES.includes(file.type)) throw new Error('Unsupported image type. Use PNG, JPEG, WebP or GIF.')
  if (file.size > MAX_BYTES) throw new Error('Image is larger than 20 MB.')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = () => rej(new Error('Could not decode image'))
      i.src = url
    })
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * k))
    const h = Math.max(1, Math.round(img.naturalHeight * k))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d')!.drawImage(img, 0, 0, w, h)
    const png = file.type === 'image/png' || file.type === 'image/gif' || file.type === 'image/webp'
    return { src: c.toDataURL(png ? 'image/png' : 'image/jpeg', 0.9), w, h, name: file.name.replace(/\.[^.]+$/, '') }
  } finally {
    URL.revokeObjectURL(url)
  }
}
