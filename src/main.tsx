import { StrictMode, Component } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/500.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'
import './styles.css'

class Boundary extends Component<{ children: ReactNode }, { err: string }> {
  state = { err: '' }
  static getDerivedStateFromError(e: Error) {
    return { err: e.message }
  }
  componentDidCatch() {
    // a crashed screen would otherwise stay blank/stuck: reload once automatically (projects autosave)
    try {
      const last = Number(sessionStorage.getItem('tuika-reload') ?? 0)
      if (Date.now() - last > 20000) {
        sessionStorage.setItem('tuika-reload', String(Date.now()))
        location.reload()
      }
    } catch {
      /* ignore */
    }
  }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div style={{ padding: 24, font: '14px system-ui' }}>
        <strong>Something went wrong.</strong>
        <p>Your project was saved automatically. Reload the app to continue.</p>
        <pre style={{ whiteSpace: 'pre-wrap', color: '#737373' }}>{this.state.err}</pre>
        <button onClick={() => location.reload()}>Reload</button>
      </div>
    )
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </StrictMode>,
)
