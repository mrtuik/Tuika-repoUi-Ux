import { create } from 'zustand'
import { useEditor } from '../state/editor'
import { friendlyDbError, saveDoc } from './db'

type Status = 'idle' | 'saving' | 'saved' | 'error'
export const useSave = create<{ status: Status; msg: string }>(() => ({ status: 'idle', msg: '' }))

let timer: ReturnType<typeof setTimeout> | null = null
let chain: Promise<void> = Promise.resolve()
let savedRev = 0

export function resetSaveState() {
  savedRev = 0
  if (timer) clearTimeout(timer)
  timer = null
  useSave.setState({ status: 'idle', msg: '' })
}

/** Serialised writes: each write reads the LATEST document when it runs, so a stale write can never land after a newer one. */
function enqueue(thumb?: () => string | undefined, force = false) {
  chain = chain.then(async () => {
    const { doc, rev } = useEditor.getState()
    if (!doc) return
    if (rev === savedRev && !force) {
      if (useSave.getState().status === 'saving') useSave.setState({ status: 'saved', msg: '' })
      return
    }
    useSave.setState({ status: 'saving', msg: '' })
    try {
      await saveDoc(doc, thumb?.())
      savedRev = rev
      useSave.setState({ status: 'saved', msg: '' })
    } catch (e) {
      useSave.setState({ status: 'error', msg: friendlyDbError(e) })
    }
  })
  return chain
}

export function flushSave(thumb?: () => string | undefined, force = false) {
  if (timer) clearTimeout(timer)
  timer = null
  return enqueue(thumb, force)
}

export function startAutosave() {
  return useEditor.subscribe((s, prev) => {
    if (!s.doc || s.rev === prev.rev || s.rev === 0) return
    useSave.setState({ status: 'saving', msg: '' })
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      void enqueue()
    }, 700)
  })
}
