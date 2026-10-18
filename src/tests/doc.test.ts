import { describe, expect, it } from 'vitest'
import { brokenLinks, newDoc, newEl, parseProject, serializeProject, validateDoc } from '../engine/doc'

describe('document validation', () => {
  it('round-trips a project through backup format', () => {
    const doc = newDoc('Demo', 360, 800, '#FFFFFF', 2)
    doc.artboards[0].els.push(newEl('rect', { name: 'Card', x: 10, y: 20 }))
    const { doc: back, warnings } = parseProject(serializeProject(doc))
    expect(warnings).toEqual([])
    expect(back.artboards).toHaveLength(2)
    expect(back.artboards[0].els[0].name).toBe('Card')
    expect(back.artboards[0].els[0].x).toBe(10)
  })

  it('rejects non-project files', () => {
    expect(() => validateDoc(null)).toThrow()
    expect(() => validateDoc({ version: 1, artboards: [] })).toThrow()
    expect(() => parseProject('not json')).toThrow('not valid JSON')
    expect(() => parseProject(JSON.stringify({ hello: 1 }))).toThrow('not a Tuika backup')
  })

  it('rejects projects from a newer version', () => {
    expect(() => validateDoc({ version: 999, artboards: [{}] })).toThrow(/newer/)
  })

  it('reports unsupported elements instead of silently dropping them', () => {
    const doc: any = newDoc('X', 100, 100)
    doc.artboards[0].els.push({ id: 'z', type: 'hologram', name: 'Mystery' })
    const { doc: out, warnings } = validateDoc(doc)
    expect(out.artboards[0].els).toHaveLength(0)
    expect(warnings.join()).toContain('Mystery')
  })

  it('sanitises bad numbers and unsafe image sources', () => {
    const doc: any = newDoc('X', 100, 100)
    doc.artboards[0].els.push({ ...newEl('image'), x: NaN, opacity: 5, src: 'javascript:alert(1)' })
    const { doc: out, warnings } = validateDoc(doc)
    const e = out.artboards[0].els[0]
    expect(e.x).toBe(0)
    expect(e.opacity).toBe(1)
    expect(e.src).toBeUndefined()
    expect(warnings.length).toBe(1)
  })

  it('finds broken prototype links', () => {
    const doc = newDoc('X', 100, 100, '#fff', 2)
    doc.artboards[0].els.push(newEl('rect', { link: doc.artboards[1].id }), newEl('rect', { link: 'gone' }))
    expect(brokenLinks(doc)).toHaveLength(1)
  })
})
