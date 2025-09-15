import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  // <StrictMode>  ← Comentado temporalmente para testing (Plan Híbrido Fase 1.1)
    <App />
  // </StrictMode>
)
