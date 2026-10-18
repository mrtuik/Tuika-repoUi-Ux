import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { Doc, ProjectMeta } from '../engine/types'
import { validateDoc } from '../engine/doc'

export interface DocRow {
  id: string
  doc: Doc
}
export interface PrefRow {
  key: string
  value: any
}

class TuikaDB extends Dexie {
  projects!: Table<ProjectMeta, string>
  docs!: Table<DocRow, string>
  prefs!: Table<PrefRow, string>
  constructor(name = 'tuika') {
    super(name)
    // v1 schema. Add new versions below with .upgrade() — never edit v1 in place.
    this.version(1).stores({
      projects: 'id, name, updatedAt, createdAt',
      docs: 'id',
      prefs: 'key',
    })
  }
}

export const db = new TuikaDB()

export async function saveDoc(doc: Doc, thumb?: string) {
  await db.transaction('rw', db.docs, db.projects, async () => {
    const prev = await db.projects.get(doc.id)
    await db.docs.put({ id: doc.id, doc })
    await db.projects.put({
      id: doc.id,
      name: doc.name,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      artboards: doc.artboards.length,
      thumb: thumb ?? prev?.thumb,
    })
  })
}

export async function loadDoc(id: string): Promise<{ doc: Doc; warnings: string[] }> {
  const row = await db.docs.get(id)
  if (!row) throw new Error('Project not found')
  return validateDoc(row.doc)
}

export async function deleteProject(id: string) {
  await db.transaction('rw', db.docs, db.projects, async () => {
    await db.docs.delete(id)
    await db.projects.delete(id)
  })
}

export async function listProjects(): Promise<ProjectMeta[]> {
  return db.projects.toArray()
}

export async function getPref<T>(key: string, fallback: T): Promise<T> {
  try {
    const r = await db.prefs.get(key)
    return r ? (r.value as T) : fallback
  } catch {
    return fallback
  }
}

export async function setPref(key: string, value: unknown) {
  try {
    await db.prefs.put({ key, value })
  } catch {
    /* prefs are best-effort */
  }
}

export function friendlyDbError(e: unknown): string {
  const name = (e as any)?.name
  if (name === 'QuotaExceededError') return 'Storage is full. Export a backup and free some space.'
  return (e as any)?.message ? String((e as any).message) : 'Could not save'
}
