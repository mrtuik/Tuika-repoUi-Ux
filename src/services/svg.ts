import type { Artboard, El } from '../engine/types'

const MAX_SVG = 200_000

/** Sanitises untrusted SVG markup. Returns null if unusable. */
export function sanitizeSvg(input: string): string | null {
  if (!input || input.length > MAX_SVG) return null
  const doc = new DOMParser().parseFromString(input, 'image/svg+xml')
  const root = doc.documentElement
  if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) return null
  doc.querySelectorAll('script,foreignObject,iframe,object,embed,style,audio,video,animate,set').forEach((n) => n.remove())
  doc.querySelectorAll('*').forEach((n) => {
    for (const a of Array.from(n.attributes)) {
      const name = a.name.toLowerCase()
      if (name.startsWith('on')) n.removeAttribute(a.name)
      else if ((name === 'href' || name === 'xlink:href') && !a.value.startsWith('#')) n.removeAttribute(a.name)
      else if (/javascript:|data:text\/html/i.test(a.value)) n.removeAttribute(a.name)
    }
  })
  if (!root.getAttribute('xmlns')) root.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  if (root.getAttribute('viewBox')) {
    root.setAttribute('width', '256')
    root.setAttribute('height', '256')
  } else if (!root.getAttribute('width') || !root.getAttribute('height')) return null
  return new XMLSerializer().serializeToString(root)
}

export function svgToDataUrl(svg: string, color: string): string {
  const colored = svg.replace(/currentColor/g, color)
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(colored)
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function exportArtboardSvg(ab: Artboard): { svg: string; warnings: string[] } {
  const warnings: string[] = []
  const defs: string[] = []
  const body: string[] = []
  ab.els.forEach((e: El, i) => {
    if (!e.visible) return
    const tf = e.rotation ? ` transform="rotate(${e.rotation} ${e.x} ${e.y})"` : ''
    let filter = ''
    if (e.shadow.enabled) {
      defs.push(`<filter id="s${i}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${e.shadow.x}" dy="${e.shadow.y}" stdDeviation="${e.shadow.blur / 2}" flood-color="${esc(e.shadow.color)}" flood-opacity="${e.shadow.opacity}"/></filter>`)
      filter = ` filter="url(#s${i})"`
    }
    const common = `opacity="${e.opacity}"${tf}${filter}`
    const stroke = e.strokeOn ? ` stroke="${esc(e.stroke)}" stroke-width="${e.strokeWidth}"` : ''
    if (e.type === 'rect') body.push(`<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="${e.radius}" fill="${esc(e.fill)}"${stroke} ${common}/>`)
    else if (e.type === 'ellipse') body.push(`<ellipse cx="${e.x + e.w / 2}" cy="${e.y + e.h / 2}" rx="${e.w / 2}" ry="${e.h / 2}" fill="${esc(e.fill)}"${stroke} ${common}/>`)
    else if (e.type === 'line' || e.type === 'arrow') {
      if (e.type === 'arrow') warnings.push(`"${e.name}": arrow exported as a plain line`)
      body.push(`<line x1="${e.x}" y1="${e.y}" x2="${e.x + e.w}" y2="${e.y + e.h}" stroke="${esc(e.stroke)}" stroke-width="${e.strokeWidth}" stroke-linecap="round" ${common}/>`)
    } else if (e.type === 'text') {
      const size = e.fontSize ?? 16
      const lh = size * (e.lineHeight ?? 1.2)
      const anchor = e.align === 'center' ? 'middle' : e.align === 'right' ? 'end' : 'start'
      const tx = e.align === 'center' ? e.x + e.w / 2 : e.align === 'right' ? e.x + e.w : e.x
      const lines = (e.text ?? '').split('\n')
      warnings.push(`"${e.name}": automatic text wrapping is not preserved in SVG`)
      body.push(
        `<text font-family="${esc(e.fontFamily ?? 'sans-serif')}" font-size="${size}" font-weight="${e.fontWeight ?? 400}" fill="${esc(e.fill)}" text-anchor="${anchor}"${e.italic ? ' font-style="italic"' : ''}${e.underline || e.strike ? ` text-decoration="${[e.underline ? 'underline' : '', e.strike ? 'line-through' : ''].filter(Boolean).join(' ')}"` : ''} ${common}>` +
          lines.map((l, k) => `<tspan x="${tx}" y="${e.y + size + k * lh}">${esc(l)}</tspan>`).join('') +
          '</text>',
      )
    } else if ((e.type === 'image' && e.src) || (e.type === 'icon' && e.svg)) {
      const href = e.type === 'image' ? e.src! : svgToDataUrl(e.svg!, e.fill)
      body.push(`<image x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" href="${esc(href)}" preserveAspectRatio="none" ${common}/>`)
    }
  })
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ab.w}" height="${ab.h}" viewBox="0 0 ${ab.w} ${ab.h}">` +
    (defs.length ? `<defs>${defs.join('')}</defs>` : '') +
    `<rect width="${ab.w}" height="${ab.h}" fill="${esc(ab.bg)}"/>${body.join('')}</svg>`
  return { svg, warnings: Array.from(new Set(warnings)) }
}
