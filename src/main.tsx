// Starts the React app.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './ui/App.tsx'
import { initAutoSave } from './project/saveLoad.ts'

// Load the auto-saved project (if any) before anything reads it.
initAutoSave()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
