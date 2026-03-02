import React, { useState, useEffect } from 'react'
import './XPBar.css'

const LEVELS = [
  { name: 'Freshman', minXP: 0, icon: '🌱' },
  { name: 'Student', minXP: 100, icon: '📖' },
  { name: 'Scholar', minXP: 300, icon: '🎓' },
  { name: 'Professor', minXP: 600, icon: '🧪' },
  { name: 'Sage', minXP: 1000, icon: '🔮' },
  { name: 'Luminary', minXP: 1500, icon: '⭐' },
]

const getLevel = (xp) => {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return { ...LEVELS[i], index: i }
  }
  return { ...LEVELS[0], index: 0 }
}

const XPBar = () => {
  const [xp, setXP] = useState(() => {
    return parseInt(localStorage.getItem('notenook_xp') || '0', 10)
  })
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [prevLevel, setPrevLevel] = useState(() => getLevel(parseInt(localStorage.getItem('notenook_xp') || '0', 10)).index)

  const currentLevel = getLevel(xp)
  const nextLevel = LEVELS[currentLevel.index + 1]
  const xpInLevel = xp - currentLevel.minXP
  const xpForNext = nextLevel ? nextLevel.minXP - currentLevel.minXP : 1
  const progress = nextLevel ? Math.min((xpInLevel / xpForNext) * 100, 100) : 100

  // Listen for XP events
  useEffect(() => {
    const handleXP = (e) => {
      const amount = e.detail?.amount || 0
      setXP(prev => {
        const newXP = prev + amount
        localStorage.setItem('notenook_xp', String(newXP))
        return newXP
      })
    }

    window.addEventListener('xp-earned', handleXP)
    return () => window.removeEventListener('xp-earned', handleXP)
  }, [])

  // Detect level up
  useEffect(() => {
    const newLevelIdx = currentLevel.index
    if (newLevelIdx > prevLevel) {
      setShowLevelUp(true)
      setPrevLevel(newLevelIdx)
      setTimeout(() => setShowLevelUp(false), 3000)
    }
  }, [xp, currentLevel.index, prevLevel])

  // Listen for task-completed and session-saved events to award XP
  useEffect(() => {
    const onTask = (e) => {
      if (e.detail?.completed) {
        window.dispatchEvent(new CustomEvent('xp-earned', { detail: { amount: 10 } }))
      }
    }
    const onSession = () => {
      window.dispatchEvent(new CustomEvent('xp-earned', { detail: { amount: 5 } }))
    }

    window.addEventListener('task-updated', onTask)
    window.addEventListener('session-saved', onSession)
    return () => {
      window.removeEventListener('task-updated', onTask)
      window.removeEventListener('session-saved', onSession)
    }
  }, [])

  return (
    <div className="xp-bar-wrap">
      {showLevelUp && (
        <div className="xp-levelup">
          🎉 Level Up! You're now a <strong>{currentLevel.name}</strong>!
        </div>
      )}
      <div className="xp-bar-inner">
        <span className="xp-level-icon" title={currentLevel.name}>{currentLevel.icon}</span>
        <div className="xp-bar-track">
          <div
            className="xp-bar-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="xp-label">
          {currentLevel.name} · {xp} XP
        </span>
      </div>
    </div>
  )
}

export default XPBar
