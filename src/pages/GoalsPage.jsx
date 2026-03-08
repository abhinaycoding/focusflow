import React, { useState, useEffect, useRef, useMemo } from 'react'

import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { usePlan } from '../contexts/PlanContext'
import { useNotifications } from '../contexts/NotificationContext'
import { useTranslation } from '../contexts/LanguageContext'
import ProGate from '../components/ProGate'
import Confetti from '../components/Confetti'
import './GoalsPage.css'

import { db } from '../lib/firebase'
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, serverTimestamp } from 'firebase/firestore'

const BADGES = [
  { id: 'firstSession', icon: '🎯', labelKey: 'goals.badges.firstSession.label', descKey: 'goals.badges.firstSession.desc', check: (s, t, h) => s >= 1 },
  { id: 'fiveSessions', icon: '🔥', labelKey: 'goals.badges.fiveSessions.label', descKey: 'goals.badges.fiveSessions.desc', check: (s, t, h) => s >= 5 },
  { id: 'tenTasks', icon: '✅', labelKey: 'goals.badges.tenTasks.label', descKey: 'goals.badges.tenTasks.desc', check: (s, t, h) => t >= 10 },
  { id: 'tenHours', icon: '⏳', labelKey: 'goals.badges.tenHours.label', descKey: 'goals.badges.tenHours.desc', check: (s, t, h) => h >= 10 },
  { id: 'twentyFiveHours', icon: '🎓', labelKey: 'goals.badges.twentyFiveHours.label', descKey: 'goals.badges.twentyFiveHours.desc', check: (s, t, h) => h >= 25 },
  { id: 'fiftyTasks', icon: '🏆', labelKey: 'goals.badges.fiftyTasks.label', descKey: 'goals.badges.fiftyTasks.desc', check: (s, t, h) => t >= 50 }
]

const GoalsPage = ({ onNavigate }) => {
  const { user } = useAuth()
  const { isPro } = usePlan()
  const toast = useToast()
  const { addNotification } = useNotifications()
  const { t } = useTranslation()
  const [goals, setGoals] = useState([])
  
  const hasReachedLimit = !isPro && goals.length >= 5
  const [newGoal, setNewGoal] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [stats, setStats] = useState({ sessions: 0, tasks: 0, hours: 0 })
  const [loading, setLoading] = useState(true)
  const [celebrate, setCelebrate] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      if (!user?.uid) return
      
      try {
        setLoading(true)
        // Load Goals (Tasks with due_date == 'goal')
        const qTasks = query(
          collection(db, 'tasks'), 
          where('user_id', '==', user.uid)
        )
        const tasksSnap = await getDocs(qTasks)
        const allTasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => {
            const da = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at)
            const db = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at)
            return da - db
          })
        
        if (isMounted) {
          const goalsData = allTasks.filter(t => t.due_date === 'goal')
          setGoals(goalsData)
        }
        
        // Load Sessions
        const qSessions = query(collection(db, 'sessions'), where('user_id', '==', user.uid))
        const sessionsSnap = await getDocs(qSessions)
        const sessionsData = sessionsSnap.docs.map(doc => doc.data())

        if (isMounted) {
          const completedTasks = allTasks.filter(t => t.completed === true)
          const hours = sessionsData.reduce((a, s) => a + (s.duration_seconds || 0), 0) / 3600
          setStats({ 
            sessions: sessionsData.length, 
            tasks: completedTasks.length, 
            hours 
          })
          setErrorMsg('')
          setLoading(false)
        }
      } catch (err) {
        if (isMounted) {
          console.error("Goals Fetch Error:", err)
          setErrorMsg(t('goals.fetchFailed') + (err.message || String(err)))
          setLoading(false)
        }
      }
    }

    loadData()

    return () => { isMounted = false }
  }, [user?.uid])

  const addGoal = async () => {
    if (!newGoal.trim() || !user?.uid) return
    try {
      const payload = {
        user_id: user.uid,
        title: newGoal.trim(),
        due_date: 'goal',
        priority: newTarget || '0',
        completed: false,
        created_at: serverTimestamp()
      }

      const docRef = await addDoc(collection(db, 'tasks'), payload)
      setGoals(prev => [...prev, { id: docRef.id, ...payload }])
      
      setNewGoal('')
      setNewTarget('')
      toast(t('goals.goalAdded'), 'success')
    } catch (err) {
      toast(t('goals.goalFailed'), 'error')
      console.error(err)
    }
  }

  // Track previously unlocked badges
  const unlockedBadges = useMemo(() => BADGES.filter(b => b.check(stats.sessions, stats.tasks, stats.hours)), [stats.sessions, stats.tasks, stats.hours])
  const prevBadgesCount = useRef(0)

  useEffect(() => {
    if (!loading && unlockedBadges.length > prevBadgesCount.current && prevBadgesCount.current > 0) {
      const newBadges = unlockedBadges.slice(prevBadgesCount.current)
      newBadges.forEach(badge => {
        addNotification(
          t('goals.milestoneUnlocked'),
          t('goals.badgeEarned')
            .replace('{label}', t(badge.labelKey))
            .replace('{desc}', t(badge.descKey)),
          'success'
        )
      })
    }
    prevBadgesCount.current = unlockedBadges.length
  }, [unlockedBadges.length, loading, addNotification, unlockedBadges])

  const toggleGoal = async (id, current) => {
    if (!user?.uid) return
    setGoals(prev => prev.map(g => g.id === id ? { ...g, completed: !current } : g))
    
    try {
      await updateDoc(doc(db, 'tasks', id), { completed: !current })
      
      // Award XP: 50 XP per task and total tasks done
      if (!current) {
        await updateDoc(doc(db, 'profiles', user.uid), {
          xp: increment(50),
          total_tasks_done: increment(1)
        })
      }
      if (!current) {
        toast(t('goals.goalAchieved'), 'success')
        addNotification(t('goals.goalAchieved'), t('goals.goalAchievedNotif'), 'success')
        setCelebrate(true)
        setTimeout(() => setCelebrate(false), 3500)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const deleteGoal = async (id) => {
    if (!user?.uid) return
    setGoals(prev => prev.filter(g => g.id !== id))
    try {
      await deleteDoc(doc(db, 'tasks', id))
      toast(t('goals.goalRemoved'), 'info')
    } catch (err) {
      console.error(err)
    }
  }



  return (
    <div className="canvas-layout">
      <Confetti active={celebrate} />
      <Confetti active={celebrate} />
      <main className="goals-main container">
        <div className="goals-grid">

          {/* Left: Goals */}
          <div>
            <h3 className="section-label">{t('goals.monthlyGoals')}</h3>

            {hasReachedLimit ? (
              <ProGate feature="goals" inline onNavigatePricing={onNavigate} />
            ) : (
              <div className="add-goal-row">
                <input
                  type="text"
                  placeholder={t('goals.setNewGoal')}
                  value={newGoal}
                  onChange={e => setNewGoal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addGoal()}
                  className="goal-input"
                />
                <input
                  type="text"
                  placeholder={t('goals.target')}
                  value={newTarget}
                  onChange={e => setNewTarget(e.target.value)}
                  className="goal-target-input"
                />
                <button onClick={addGoal} className="btn-icon">+</button>
              </div>
            )}

            {errorMsg && (
              <div className="p-4 mb-4 bg-red-900/20 border border-red-500/50 text-red-200 text-sm rounded">
                <strong>Debug Error:</strong> {errorMsg}
              </div>
            )}

            {loading ? (
              <p className="text-xs text-muted italic">{t('goals.loadingGoals')}</p>
            ) : goals.length === 0 ? (
              <p className="text-xs text-muted italic">{t('goals.noGoals')}</p>
            ) : (
              <div className="goals-list">
                {goals.map(goal => (
                  <div key={goal.id} className={`goal-row aura-glass holographic-foil ${goal.completed ? 'done' : ''}`}>
                    <div
                      className={`ledger-check cursor-pointer ${goal.completed ? 'done' : ''}`}
                      onClick={() => toggleGoal(goal.id, goal.completed)}
                    />
                    <div className="goal-info" onClick={() => toggleGoal(goal.id, goal.completed)}>
                      <div className="goal-title">{goal.title}</div>
                      {goal.priority && goal.priority !== '0' && (
                        <div className="goal-target">Target: {goal.priority}</div>
                      )}
                    </div>
                    <button onClick={() => deleteGoal(goal.id)} className="note-delete-btn" style={{ opacity: 0.4 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Progress Summary */}
            <div className="progress-summary border-t border-ink pt-6 mt-8">
              <h3 className="section-label">{t('goals.yourProgress')}</h3>
              <div className="progress-stats">
                <div className="progress-stat">
                  <span className="stat-num">{stats.sessions}</span>
                  <span className="stat-lbl">{t('goals.sessions')}</span>
                </div>
                <div className="progress-stat">
                  <span className="stat-num">{stats.tasks}</span>
                  <span className="stat-lbl">{t('goals.tasksDone')}</span>
                </div>
                <div className="progress-stat">
                  <span className="stat-num">{parseFloat(stats.hours).toFixed(1)}</span>
                  <span className="stat-lbl">{t('goals.hours')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Badges */}
          <div>
            <h3 className="section-label">{t('goals.achievements')}</h3>
            <div className="badges-grid">
              {BADGES.map(badge => {
                const unlocked = badge.check(stats.sessions, stats.tasks, stats.hours)
                return (
                  <div key={badge.id} className={`badge-card aura-glass holographic-foil ${unlocked ? 'unlocked' : 'locked'}`}>
                    <div className="badge-icon">{badge.icon}</div>
                    <div className="badge-label">{t(badge.labelKey)}</div>
                    <div className="badge-desc">{t(badge.descKey)}</div>
                    {unlocked && <div className="badge-status">{t('goals.earned')}</div>}
                  </div>
                )
              })}
            </div>

            {unlockedBadges.length > 0 && (
              <div className="mt-6 font-serif italic text-muted text-lg">
                "{unlockedBadges.length === BADGES.length
                  ? t('goals.allMastered')
                  : `${unlockedBadges.length} / ${BADGES.length} ${t('goals.milestonesReached')}`}"
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}

export default GoalsPage

