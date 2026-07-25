// Self-hosted via Fontsource: ADR-0001's no-third-party-contact posture rules out a runtime
// request to fonts.googleapis.com. Display and mono are latin-only — they render app copy,
// headings and room codes. Public Sans deliberately keeps every subset: it is the face that
// renders participant names and agenda titles, which people type in their own script.
import '@fontsource/playfair-display/latin-500.css';
import '@fontsource/playfair-display/latin-600.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/playfair-display/latin-500-italic.css';
import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/500.css';
import '@fontsource/public-sans/600.css';
import '@fontsource/public-sans/700.css';
import '@fontsource/space-mono/latin-400.css';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { applyTheme, loadTheme } from './theme/theme'

applyTheme(loadTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
