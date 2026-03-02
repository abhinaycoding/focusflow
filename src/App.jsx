import { useState, useEffect } from 'react'
import LandingPage from './pages/LandingPage'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import ProfileSetup from './pages/ProfileSetup'
import LibraryPage from './pages/LibraryPage'
import AnalyticsPage from './pages/AnalyticsPage'
import ExamPlannerPage from './pages/ExamPlannerPage'
import GoalsPage from './pages/GoalsPage'
import ResumeBuilderPage from './pages/ResumeBuilderPage'
import PricingPage from './pages/PricingPage'
import CalendarPage from './pages/CalendarPage'
import StudyRoomsListPage from './pages/StudyRoomsListPage'
import StudyRoomPage from './pages/StudyRoomPage'
import PublicProfilePage from './pages/PublicProfilePage'
import CustomCursor from './components/CustomCursor'
import ProGate from './components/ProGate'
import ZenMode from './components/ZenMode'
import CommandPalette from './components/CommandPalette'
import Layout from './components/Layout'
import Confetti from './components/Confetti'
import MobileBarrier from './components/MobileBarrier'
import { useAuth } from './contexts/AuthContext'
import { useTheme } from './contexts/ThemeContext'
import { useTranslation } from './contexts/LanguageContext'
import './App.css'

const ProtectedRoute = ({ user, profile, profileReady, currentPage, onRedirect, children }) => {
  useEffect(() => {
    if (!user) {
      onRedirect('auth')
      return
    }

    if (profileReady && !profile && currentPage !== 'setup') {
      onRedirect('setup')
    }
  }, [user, profile, profileReady, currentPage, onRedirect])

  if (!user) return null
  if (!profileReady) return null
  if (!profile && currentPage !== 'setup') return null
  return children
}

function App() {
  const [currentPage, setCurrentPage] = useState('landing')
  const [activeRoomId, setActiveRoomId] = useState(null)
  const [activeRoomName, setActiveRoomName] = useState('')
  const { user, profile, profileReady, loading: authLoading } = useAuth()
  const { isDark, toggle, theme, setThemeById, themes } = useTheme()
  const { language, setLanguage, languages } = useTranslation()
  const [themePanelOpen, setThemePanelOpen] = useState(false)
  const [langPanelOpen, setLangPanelOpen] = useState(false)

  const enterRoom = (id, name) => {
    setActiveRoomId(id)
    setActiveRoomName(name)
    setCurrentPage('room')
  }

  const navigateTo = (page) => {
    setCurrentPage(page)
  }

  // Auto-redirect authenticated users from public pages to protected dashboard
  useEffect(() => {
    if (user && profileReady && (currentPage === 'landing' || currentPage === 'auth')) {
      if (profile) {
        navigateTo('dashboard')
      } else {
        navigateTo('setup')
      }
    }
  }, [user, profile, profileReady, currentPage])

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-color, #0a0a0a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--border, rgba(255,255,255,0.1))', borderTopColor: 'var(--accent, #ea580c)', animation: 'spin 0.7s linear infinite' }} />
      </div>
    )
  }

  const pageToRender = currentPage === 'auth' && user && profileReady
    ? (profile ? 'dashboard' : 'setup')
    : currentPage

  return (
    <>
      <CustomCursor />
      <ZenMode />
      <Confetti />

      <MobileBarrier>
        <div key={pageToRender} className="page-transition">
          {pageToRender === 'landing' && <LandingPage onNavigate={navigateTo} />}
          {pageToRender === 'auth' && <AuthPage onNavigate={navigateTo} />}
          {pageToRender === 'pricing' && <PricingPage onNavigate={navigateTo} />}

          {pageToRender === 'setup' && (
            <ProtectedRoute user={user} profile={profile} profileReady={profileReady} currentPage={pageToRender} onRedirect={navigateTo}>
              <ProfileSetup onNavigate={navigateTo} />
            </ProtectedRoute>
          )}

          {(['dashboard', 'library', 'analytics', 'goals', 'calendar', 'rooms', 'room', 'exams', 'resume', 'profile'].includes(pageToRender)) && (
            <ProtectedRoute user={user} profile={profile} profileReady={profileReady} currentPage={pageToRender} onRedirect={navigateTo}>
              <Layout onNavigate={navigateTo} activeTab={pageToRender} fullBleed={pageToRender === 'room'}>

                {pageToRender === 'dashboard' && <Dashboard onNavigate={navigateTo} />}
                {pageToRender === 'library' && <LibraryPage onNavigate={navigateTo} />}
                {pageToRender === 'analytics' && <AnalyticsPage onNavigate={navigateTo} />}
                {pageToRender === 'goals' && <GoalsPage onNavigate={navigateTo} />}
                {pageToRender === 'calendar' && <CalendarPage onNavigate={navigateTo} />}
                {pageToRender === 'rooms' && <StudyRoomsListPage onNavigate={navigateTo} onEnterRoom={enterRoom} />}
                {pageToRender === 'room' && activeRoomId && (
                  <StudyRoomPage
                    roomId={activeRoomId}
                    roomName={activeRoomName}
                    onNavigate={navigateTo}
                    onBack={() => navigateTo('rooms')}
                  />
                )}
                {pageToRender === 'exams' && (
                  <ProGate feature="Exam Planner" onNavigatePricing={navigateTo}>
                    <ExamPlannerPage onNavigate={navigateTo} />
                  </ProGate>
                )}
                {pageToRender === 'resume' && (
                  <ProGate feature="Resume Builder" onNavigatePricing={navigateTo}>
                    <ResumeBuilderPage onNavigate={navigateTo} />
                  </ProGate>
                )}
                {pageToRender === 'profile' && (
                  <PublicProfilePage onNavigate={navigateTo} />
                )}
              </Layout>
            </ProtectedRoute>
          )}
        </div>

        <CommandPalette
          onNavigate={navigateTo}
          onAction={(action) => {
            if (action === 'toggle-theme') toggle()
            if (action === 'zen') {
              window.dispatchEvent(new CustomEvent('activate-zen'))
            }
            if (action === 'focus-task') {
              navigateTo('dashboard')
              setTimeout(() => {
                document.querySelector('.task-add-input')?.focus()
              }, 300)
            }
          }}
        />
      </MobileBarrier>
    </>
  )
}

export default App
