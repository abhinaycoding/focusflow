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
import { useNotifications } from '../contexts/NotificationContext'
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
  const { addNotification } = useNotifications()
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
  
  // Custom welcome notification
  useEffect(() => {
    if (!profile) return
    const sent = sessionStorage.getItem('ff_welcome_notif')
    if (sent) return

    const hour = new Date().getHours()
    let msg = "Ready for a productive session? ☀️"
    if (hour >= 12 && hour < 18) msg = "Keep the momentum going! 🚀"
    if (hour >= 18) msg = "Evening focus time? You've got this! 🌙"

    addNotification("Welcome back, " + profile.full_name.split(' ')[0], msg, "info")
    sessionStorage.setItem('ff_welcome_notif', 'true')
  }, [profile, addNotification])

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
              className={`exam-chip ${isEditing ? 'active' : ''}`}
              style={{ marginLeft: 'auto', borderRadius: '24px', fontSize: '0.65rem' }}
            >
              {isEditing ? t('dashboard.saveLayout') : t('dashboard.customize')} 
              {!isPro && <span className="pro-lock-badge" style={{ verticalAlign: 'middle', marginLeft: '0.5rem' }}>Pro</span>}
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

        {/* Daily Quote Widget */}
        <div className="dashboard-quote-card" style={{
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 10%, var(--bg-card)), var(--bg-card))',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          padding: '1.5rem',
          marginTop: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'absolute', top: '-10px', left: '10px', fontSize: '4rem', opacity: 0.05, fontFamily: 'serif' }}>"</div>
          <p style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: 'var(--text-primary)', margin: 0, position: 'relative', zIndex: 1 }}>
            {(() => {
              const quotes = [
                "The secret of getting ahead is getting started.",
                "It always seems impossible until it's done.",
                "The way to get started is to quit talking and begin doing.",
                "Don't let yesterday take up too much of today.",
                "You don't have to be great to start, but you have to start to be great.",
                "The only way to do great work is to love what you do.",
                "Believe you can and you're halfway there."
              ];
              const day = new Date().getDay();
              return quotes[day % quotes.length];
            })()}
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
            <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, color: 'var(--primary)' }}>Daily Motivation</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>— NoteNook Scholar</span>
          </div>
        </div>

        <main className="canvas-main" style={{ marginTop: '2.5rem', paddingBottom: '5rem' }}>
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
