import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { deleteProject, listProjects, loadDoc, saveDoc } from '../database/db'
import { newDoc, newEl } from '../engine/doc'

describe('project database', () => {
  it('saves, lists, reloads and deletes a project', async () => {
    const doc = newDoc('Persisted', 360, 800)
    doc.artboards[0].els.push(newEl('text', { text: 'hello' }))
    await saveDoc(doc, 'data:image/jpeg;base64,AAAA')
    const list = await listProjects()
    expect(list.find((p) => p.id === doc.id)?.thumb).toContain('data:image')
    const back = await loadDoc(doc.id)
    expect(back.doc.artboards[0].els[0].text).toBe('hello')
    // a later save without thumbnail keeps the old one
    await saveDoc({ ...doc, name: 'Renamed', updatedAt: Date.now() })
    const again = (await listProjects()).find((p) => p.id === doc.id)!
    expect(again.name).toBe('Renamed')
    expect(again.thumb).toContain('data:image')
    await deleteProject(doc.id)
    await expect(loadDoc(doc.id)).rejects.toThrow('not found')
  })
})
