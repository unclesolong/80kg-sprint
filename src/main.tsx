import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/planner.css'
import './styles/responsive.css'
import './styles/v6.css'

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
