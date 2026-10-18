import { StrictMode, Component } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

class Boundary extends Component<{ children: ReactNode }, { err: string }> {
  state = { err: '' }
  static getDerivedStateFromError(e: Error) {
    return { err: e.message }
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
