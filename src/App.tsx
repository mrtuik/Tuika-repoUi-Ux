import { useCallback, useEffect, useState } from 'react'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import Home from './features/projects/Home'
import Editor from './features/editor/Editor'
import { useEditor } from './state/editor'
import { useUI } from './state/ui'
import { getPref } from './database/db'
import { resetSaveState, startAutosave } from './database/persistence'
import { runBack } from './services/back'
import type { Doc } from './engine/types'

function applyTheme(t: string) {
  const dark = t === 'dark' || (t === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

export default function App() {
  const [screen, setScreen] = useState<'home' | 'editor'>('home')
  const [theme, setThemeState] = useState('light')
  const hasDoc = useEditor((s) => !!s.doc)

  const setTheme = useCallback((t: string) => {
    setThemeState(t)
    applyTheme(t)
  }, [])

  useEffect(() => {
    void getPref('theme', 'light').then(setTheme)
    return startAutosave()
  }, [setTheme])

  const onOpen = useCallback((doc: Doc, warnings: string[]) => {
    resetSaveState()
    useEditor.getState().open(doc)
    setScreen('editor')
    if (warnings.length) useUI.getState().say(`Opened with ${warnings.length} note(s): ${warnings[0]}`)
  }, [])

  const onExit = useCallback(() => {
    useEditor.getState().close()
    setScreen('home')
  }, [])

  // Android hardware back button: close sheets/dialogs first, then leave editor, then exit app.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    const sub = CapApp.addListener('backButton', () => {
      if (runBack()) return
      void CapApp.exitApp()
    })
    return () => {
      void sub.then((h) => h.remove())
    }
  }, [])

  if (screen === 'editor' && hasDoc) return <Editor onExit={onExit} />
  return <Home onOpen={onOpen} theme={theme} setTheme={setTheme} />
}
