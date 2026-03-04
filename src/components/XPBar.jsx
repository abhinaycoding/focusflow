import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import './XPBar.css'

// ── Levels ──────────────────────────────────────────────────────────────────
export const LEVELS = [
  { name: 'Freshman',  minXP: 0,    icon: '🌱', color: '#22c55e' },
  { name: 'Student',   minXP: 100,  icon: '📖', color: '#3b82f6' },
  { name: 'Scholar',   minXP: 300,  icon: '🎓', color: '#8b5cf6' },
  { name: 'Professor', minXP: 600,  icon: '🧪', color: '#f59e0b' },
  { name: 'Sage',      minXP: 1000, icon: '🔮', color: '#ec4899' },
  { name: 'Luminary',  minXP: 1500, icon: '⭐', color: '#f97316' },
]

// ── Badges ───────────────────────────────────────────────────────────────────
export const ALL_BADGES = [
  // === Tasks ===
  { id: 'first_task',     emoji: '✅', name: 'First Step',    desc: 'Complete your first task',    check: (stats) => stats.tasksCompleted >= 1 },
  { id: 'task_10',        emoji: '🎯', name: 'Task Hunter',   desc: '10 tasks completed',          check: (stats) => stats.tasksCompleted >= 10 },
  { id: 'task_50',        emoji: '💎', name: 'Task Master',   desc: '50 tasks completed',          check: (stats) => stats.tasksCompleted >= 50 },
  { id: 'task_100',       emoji: '👑', name: 'Century',       desc: '100 tasks completed',         check: (stats) => stats.tasksCompleted >= 100 },
  // === Sessions ===
  { id: 'first_session',  emoji: '⏱️', name: 'Focused',       desc: 'Log your first study session',check: (stats) => stats.sessionsCompleted >= 1 },
  { id: 'session_10',     emoji: '🧠', name: 'Deep Thinker',  desc: '10 sessions completed',       check: (stats) => stats.sessionsCompleted >= 10 },
  { id: 'session_50',     emoji: '🚀', name: 'Rocket Scholar', desc: '50 sessions completed',      check: (stats) => stats.sessionsCompleted >= 50 },
  // === Streaks ===
  { id: 'streak_3',       emoji: '🔥', name: 'On Fire',       desc: '3-day study streak',          check: (stats) => stats.streak >= 3 },
  { id: 'streak_7',       emoji: '🌟', name: 'Week Warrior',  desc: '7-day study streak',          check: (stats) => stats.streak >= 7 },
  { id: 'streak_30',      emoji: '🏆', name: 'Iron Will',     desc: '30-day study streak',         check: (stats) => stats.streak >= 30 },
  // === XP ===
  { id: 'xp_100',         emoji: '⚡', name: 'Spark',         desc: 'Earn 100 XP',                 check: (stats) => stats.totalXP >= 100 },
  { id: 'xp_500',         emoji: '💫', name: 'Rising Star',   desc: 'Earn 500 XP',                 check: (stats) => stats.totalXP >= 500 },
  { id: 'xp_1000',        emoji: '🌙', name: 'Night Scholar', desc: 'Earn 1000 XP',                check: (stats) => stats.totalXP >= 1000 },
  // === Study Rooms ===
  { id: 'first_room',     emoji: '🤝', name: 'Team Player',   desc: 'Join a study room',           check: (stats) => stats.roomsJoined >= 1 },
  { id: 'room_5',         emoji: '🏫', name: 'Social Scholar', desc: 'Join 5 study rooms',         check: (stats) => stats.roomsJoined >= 5 },
  // === Hours ===
  { id: 'hours_1',        emoji: '⌚', name: 'Clock In',       desc: '1 hour of total study time', check: (stats) => stats.totalMinutes >= 60 },
  { id: 'hours_10',       emoji: '📚', name: 'Bookworm',       desc: '10 hours of total study',    check: (stats) => stats.totalMinutes >= 600 },
  { id: 'hours_50',       emoji: '🎖️', name: 'Veteran',        desc: '50 hours of total study',    check: (stats) => stats.totalMinutes >= 3000 },
]

const STORAGE_XP_KEY = 'notenook_xp'
const STORAGE_STATS_KEY = 'notenook_stats'
const STORAGE_BADGES_KEY = 'notenook_badges'

const getLevel = (xp) => {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return { ...LEVELS[i], index: i }
  }
  return { ...LEVELS[0], index: 0 }
}

const loadStats = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_STATS_KEY) || '{}') } catch { return {} }
}

const saveStats = (stats) => {
  localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(stats))
}

const loadEarnedBadges = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_BADGES_KEY) || '[]') } catch { return [] }
}

const saveEarnedBadges = (badges) => {
  localStorage.setItem(STORAGE_BADGES_KEY, JSON.stringify(badges))
}

// ── XP Gained Toast ──────────────────────────────────────────────────────────
const XPToast = ({ amount, onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 2200); return () => clearTimeout(t) }, [onDone])
  return <div className="xp-gained-toast">⚡ +{amount} XP</div>
}

// ── Level Up Toast ────────────────────────────────────────────────────────────
const LevelUpToast = ({ level, onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t) }, [onDone])
  return (
    <div className="xp-levelup-toast">
      {level.icon} Level Up! You're now a <strong>&nbsp;{level.name}</strong>! 🎉
    </div>
  )
}

// ── Badge New Unlock Toast ────────────────────────────────────────────────────
const BadgeToast = ({ badge, onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t) }, [onDone])
  return (
    <div className="xp-levelup-toast" style={{ background: 'linear-gradient(135deg, #b45309, #f59e0b, #fbbf24)' }}>
      {badge.emoji} Badge Unlocked: <strong>&nbsp;{badge.name}</strong>!
    </div>
  )
}

// ── Badges Modal ──────────────────────────────────────────────────────────────
const BadgesModal = ({ onClose, xp, stats, earnedBadgeIds }) => {
  const level = getLevel(xp)
  const nextLevel = LEVELS[level.index + 1]
  const xpInLevel = xp - level.minXP
  const xpForNext = nextLevel ? nextLevel.minXP - level.minXP : 1
  const progress = nextLevel ? Math.min((xpInLevel / xpForNext) * 100, 100) : 100

  const earnedBadges = ALL_BADGES.filter(b => earnedBadgeIds.includes(b.id))
  const lockedBadges = ALL_BADGES.filter(b => !earnedBadgeIds.includes(b.id))

  return (
    <div className="badges-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="badges-modal">
        <button className="badges-modal-close" onClick={onClose}>✕</button>
        <h2 className="badges-modal-title">Your Progress</h2>
        <p className="badges-modal-sub">{earnedBadges.length}/{ALL_BADGES.length} badges earned</p>

        {/* XP Stats */}
        <div className="badges-xp-row">
          <div className="badges-xp-stat">
            <strong>{level.icon} {level.name}</strong>
            <span>Current Level</span>
          </div>
          <div className="badges-xp-stat">
            <strong>{xp}</strong>
            <span>Total XP</span>
          </div>
          <div className="badges-xp-stat">
            <strong>{stats.tasksCompleted || 0}</strong>
            <span>Tasks Done</span>
          </div>
          <div className="badges-xp-stat">
            <strong>{stats.sessionsCompleted || 0}</strong>
            <span>Sessions</span>
          </div>
        </div>

        {/* Level progress bar */}
        <div className="badges-level-bar-row">
          <div className="badges-level-label">
            <span>{level.name}</span>
            <span>{nextLevel ? `${xpInLevel}/${xpForNext} XP → ${nextLevel.name}` : 'MAX LEVEL ⭐'}</span>
          </div>
          <div className="badges-level-track">
            <div className="badges-level-fill" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Earned Badges */}
        {earnedBadges.length > 0 && (
          <>
            <p className="badges-section-title">🏅 Earned ({earnedBadges.length})</p>
            <div className="badges-grid">
              {earnedBadges.map(badge => (
                <div key={badge.id} className="badge-card earned">
                  <div className="badge-earned-mark">✓</div>
                  <div className="badge-emoji">{badge.emoji}</div>
                  <div className="badge-name">{badge.name}</div>
                  <div className="badge-desc">{badge.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Locked Badges */}
        {lockedBadges.length > 0 && (
          <>
            <p className="badges-section-title">🔒 Locked ({lockedBadges.length})</p>
            <div className="badges-grid">
              {lockedBadges.map(badge => (
                <div key={badge.id} className="badge-card locked">
                  <div className="badge-lock-icon">🔒</div>
                  <div className="badge-emoji">{badge.emoji}</div>
                  <div className="badge-name">{badge.name}</div>
                  <div className="badge-desc">{badge.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main XPBar Component ──────────────────────────────────────────────────────
const XPBar = () => {
  const { profile } = useAuth()
  const xp = profile?.xp || 0
  const stats = {
    tasksCompleted: profile?.total_tasks_done || 0,
    sessionsCompleted: profile?.total_sessions_done || 0, // Note: We might need to add total_sessions_done pulse if applicable, for now it maps to tasks/hours
    roomsJoined: profile?.rooms_joined || 0,
    totalMinutes: Math.round((profile?.total_study_seconds || 0) / 60),
    totalXP: xp,
  }
  const [earnedBadgeIds, setEarnedBadgeIds] = useState(() => loadEarnedBadges())

  const [showModal, setShowModal] = useState(false)
  const [xpToast, setXpToast] = useState(null)
  const [levelUpToast, setLevelUpToast] = useState(null)
  const [badgeToast, setBadgeToast] = useState(null)
  const [prevLevelIdx, setPrevLevelIdx] = useState(() => getLevel(xp).index)

  // Listen for XP events (For UI Toasts ONLY)
  useEffect(() => {
    const handleXP = (e) => {
      const amount = e.detail?.amount || 0
      setXpToast(amount)
      
      // Secondary check for badge unlocks on event
      const newBadges = [...earnedBadgeIds]
      let newUnlock = null
      ALL_BADGES.forEach(badge => {
        if (!newBadges.includes(badge.id) && badge.check(stats)) {
          newBadges.push(badge.id)
          newUnlock = badge
        }
      })
      if (newUnlock) {
        setEarnedBadgeIds(newBadges)
        saveEarnedBadges(newBadges)
        setTimeout(() => setBadgeToast(newUnlock), 500)
      }
    }
    window.addEventListener('xp-earned', handleXP)
    return () => window.removeEventListener('xp-earned', handleXP)
  }, [earnedBadgeIds, stats])

  // Listen for task/session events
  useEffect(() => {
    const onTask = (e) => {
      if (e.detail?.completed) {
        window.dispatchEvent(new CustomEvent('xp-earned', { detail: { amount: 10, stats: { tasksCompleted: 1 } } }))
      }
    }
    const onSession = (e) => {
      const mins = Math.round((e.detail?.duration_seconds || 0) / 60)
      const xpAmount = Math.max(5, Math.round(mins / 5)) // 1 XP per 5 mins studied, min 5
      window.dispatchEvent(new CustomEvent('xp-earned', { detail: { amount: xpAmount, stats: { sessionsCompleted: 1, totalMinutes: mins } } }))
    }
    const onRoom = () => {
      window.dispatchEvent(new CustomEvent('xp-earned', { detail: { amount: 5, stats: { roomsJoined: 1 } } }))
    }
    window.addEventListener('task-updated', onTask)
    window.addEventListener('session-saved', onSession)
    window.addEventListener('room-joined', onRoom)
    return () => {
      window.removeEventListener('task-updated', onTask)
      window.removeEventListener('session-saved', onSession)
      window.removeEventListener('room-joined', onRoom)
    }
  }, [])

  // Detect level up
  const currentLevel = getLevel(xp)
  useEffect(() => {
    if (currentLevel.index > prevLevelIdx) {
      setLevelUpToast(currentLevel)
      setPrevLevelIdx(currentLevel.index)
    }
  }, [xp, currentLevel.index, prevLevelIdx])

  const nextLevel = LEVELS[currentLevel.index + 1]
  const xpInLevel = xp - currentLevel.minXP
  const xpForNext = nextLevel ? nextLevel.minXP - currentLevel.minXP : 1
  const progress = nextLevel ? Math.min((xpInLevel / xpForNext) * 100, 100) : 100

  return (
    <>
      {/* XP Bar Row */}
      <div className="xp-bar-wrap" onClick={() => setShowModal(true)} title="View badges & progress">
        <div className="xp-bar-inner">
          <div className="xp-level-chip">
            <span className="xp-level-icon">{currentLevel.icon}</span>
            <span className="xp-level-name">{currentLevel.name}</span>
          </div>
          <div className="xp-bar-track">
            <div className="xp-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="xp-label">{xp} XP</span>
        </div>
      </div>

      {/* Toasts */}
      {xpToast && <XPToast amount={xpToast} onDone={() => setXpToast(null)} />}
      {levelUpToast && <LevelUpToast level={levelUpToast} onDone={() => setLevelUpToast(null)} />}
      {badgeToast && <BadgeToast badge={badgeToast} onDone={() => setBadgeToast(null)} />}

      {/* Badges Modal */}
      {showModal && (
        <BadgesModal
          onClose={() => setShowModal(false)}
          xp={xp}
          stats={stats}
          earnedBadgeIds={earnedBadgeIds}
        />
      )}
    </>
  )
}

export default XPBar
