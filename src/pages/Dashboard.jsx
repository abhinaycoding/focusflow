import React, { useState, useEffect } from 'react'
import TaskPlanner from '../components/TaskPlanner'
import NotesPreview from '../components/NotesPreview'
import FocusTimer from '../components/FocusTimer'
import AnalyticsCards from '../components/AnalyticsCards'
import DraggableDashboard from '../components/DraggableDashboard'
import NotificationBell from '../components/NotificationBell'
import { useAuth } from '../contexts/AuthContext'
import { usePlan } from '../contexts/PlanContext'
import { useTranslation } from '../contexts/LanguageContext'
import OnboardingTour from '../components/OnboardingTour'
import DangerZone from '../components/DangerZone'
import MobileBottomNav from '../components/MobileBottomNav'
import StreakFlame from '../components/StreakFlame'
import XPBar from '../components/XPBar'
import DailyScore from '../components/DailyScore'
import { db } from '../lib/firebase'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import './Dashboard.css'

const Dashboard = ({ onNavigate }) => {
  const { user, profile, signOut } = useAuth()
  const { isPro } = usePlan()
  const { t, language } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [streak, setStreak] = useState(0)
  const [showTour, setShowTour] = useState(() => !localStorage.getItem('ff_onboarding_done'))

  // Compute greeting
  const hour = new Date().getHours()
  const timeGreeting = hour < 12 ? t('dashboard.goodMorning') : hour < 17 ? t('dashboard.goodAfternoon') : t('dashboard.goodEvening')
  const userName = profile?.full_name?.split(' ')[0] || t('dashboard.scholar')
  
  // Use locale-aware date formatting
  const localeMap = { en: 'en-US', hi: 'hi-IN', es: 'es-ES' }
  const dateStr = new Date().toLocaleDateString(localeMap[language] || 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  // Calculate streak
  useEffect(() => {
    if (!user?.uid) return
    const calcStreak = async () => {
      try {
        const q = query(
          collection(db, 'sessions'),
          where('user_id', '==', user.uid),
          where('completed', '==', true)
        )

        const querySnapshot = await getDocs(q)
        if (querySnapshot.empty) return

        const data = querySnapshot.docs
          .map(doc => doc.data())
          .sort((a, b) => {
            const da = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at)
            const db = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at)
            return db - da
          })

        // Get unique dates
        const dates = [...new Set(data.map(s => {
          const date = s.created_at?.toDate ? s.created_at.toDate() : new Date(s.created_at)
          return date.toDateString()
        }))]
        
        let count = 0
        const today = new Date()
        for (let i = 0; i < dates.length; i++) {
          const expected = new Date(today)
          expected.setDate(today.getDate() - i)
          if (dates[i] === expected.toDateString()) count++
          else break
        }
        setStreak(count)
      } catch (err) {
        console.warn('Streak calc failed:', err.message)
      }
    }
    calcStreak()
  }, [user?.uid])

  return (
    <>
      <div className="dashboard-content">
        {/* Welcome Greeting */}
        <div className="dashboard-greeting-section">
          <div className="welcome-greeting">
            {timeGreeting}, {userName}.
            {streak > 0 && <StreakFlame streak={streak} />}
          </div>
          <div className="welcome-date">{dateStr}</div>
          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ maxWidth: '280px', flex: '1 1 200px' }}>
              <XPBar />
            </div>
            <DailyScore />
            
            <button 
              onClick={() => isPro ? setIsEditing(!isEditing) : onNavigate('pricing')}
              className={`dash-nav-btn ${isEditing ? 'text-primary border-b border-primary' : ''}`}
              style={{ marginLeft: 'auto' }}
            >
              {isEditing ? t('dashboard.saveLayout') : t('dashboard.customize')} {!isPro && <span className="pro-lock-badge">Pro</span>}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {isMobileMenuOpen && (
          <div className="mobile-nav-menu flex flex-col gap-4 mt-6 border-b border-ink pb-6 tracking-widest">
            <div className="uppercase text-xs font-bold font-serif italic text-primary mb-4">
              {t('dashboard.edition')} {isPro ? t('dashboard.pro') : t('dashboard.free')}
            </div>
            
            <button 
              onClick={() => { setIsMobileMenuOpen(false); if(isPro) setIsEditing(!isEditing); else onNavigate('pricing'); }}
              className={`text-left text-sm uppercase hover:text-primary transition-colors ${isEditing ? 'text-primary' : ''}`}
            >
              {isEditing ? t('dashboard.saveLayout') : t('dashboard.customize')} {!isPro && <span className="pro-lock-badge">Pro</span>}
            </button>
            <button onClick={() => { setIsMobileMenuOpen(false); onNavigate('analytics'); }} className="text-left text-sm uppercase hover:text-primary transition-colors">{t('dashboard.analytics')}</button>
            <button onClick={() => { setIsMobileMenuOpen(false); onNavigate('calendar'); }} className="text-left text-sm uppercase hover:text-primary transition-colors">{t('dashboard.calendar')}</button>
            <button onClick={() => { setIsMobileMenuOpen(false); onNavigate('exams'); }} className="text-left text-sm uppercase hover:text-primary transition-colors">
              {t('dashboard.exams')} {!isPro && <span className="pro-lock-badge">Pro</span>}
            </button>
            <button onClick={() => { setIsMobileMenuOpen(false); onNavigate('goals'); }} className="text-left text-sm uppercase hover:text-primary transition-colors">{t('dashboard.goals')}</button>
            <button onClick={() => { setIsMobileMenuOpen(false); onNavigate('resume'); }} className="text-left text-sm uppercase hover:text-primary transition-colors">
              {t('dashboard.resume')} {!isPro && <span className="pro-lock-badge">Pro</span>}
            </button>
            <button
              onClick={async () => { await signOut(); onNavigate('landing') }}
              className="text-left text-sm uppercase hover:text-primary transition-colors"
              style={{ opacity: 0.6 }}
            >
              ↪ Sign Out
            </button>
          </div>
        )}

        <main className="canvas-main" style={{ marginTop: '3rem', paddingBottom: '5rem' }}>
          <DangerZone />
          <DraggableDashboard 
            onNavigate={onNavigate}
            isPro={isPro}
            isEditing={isEditing}
          />
        </main>
      </div>

      {/* Onboarding Tour — first visit only */}
      {showTour && <OnboardingTour onComplete={() => setShowTour(false)} />}

      {/* Mobile Bottom Nav */}
      <MobileBottomNav onNavigate={onNavigate} currentPage="dashboard" />
    </>
  )
}

export default Dashboard
