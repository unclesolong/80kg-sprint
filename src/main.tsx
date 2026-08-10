import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AppErrorBoundary, showMissingRootError } from './components/AppErrorBoundary'
import { applyDocumentTheme, readThemeMirror } from './theme'
import './styles.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/planner.css'
import './styles/responsive.css'
import './styles/v6.css'

applyDocumentTheme(readThemeMirror())

const root = document.getElementById('root')

if (!root) {
  showMissingRootError(document.body)
} else {
  createRoot(root).render(<StrictMode><AppErrorBoundary><App /></AppErrorBoundary></StrictMode>)
}
