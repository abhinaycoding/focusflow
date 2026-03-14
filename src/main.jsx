import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { PlanProvider } from './contexts/PlanContext'
import { NotificationProvider } from './contexts/NotificationContext'
import { ZenProvider } from './contexts/ZenContext'
import { TimerProvider } from './contexts/TimerContext'
import { LanguageProvider } from './contexts/LanguageContext'


import AudioFixer from './utils/AudioFixer'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <PlanProvider>
              <TimerProvider>
                <ZenProvider>
                  <NotificationProvider>
                    <AudioFixer />
                    <App />
                  </NotificationProvider>
                </ZenProvider>
              </TimerProvider>
            </PlanProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  </StrictMode>,
)

