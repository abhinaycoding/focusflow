import React, { useState, useEffect, useMemo } from 'react'
import { db } from '../lib/firebase'
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import './DailyScore.css'

const DailyScore = () => {
  const { user } = useAuth()
  const [score, setScore] = useState(null)
  const [breakdown, setBreakdown] = useState({ focus: 0, tasks: 0, streak: 0 })

  useEffect(() => {
    if (!user?.uid) return

    const computeScore = async () => {
      try {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        // Fetch today's sessions and all tasks
        const [sessSnap, taskSnap] = await Promise.all([
          getDocs(query(collection(db, 'sessions'), where('user_id', '==', user.uid))),
          getDocs(query(collection(db, 'tasks'), where('user_id', '==', user.uid)))
        ])

        const todayStart = today.getTime()
        const sessions = sessSnap.docs
          .map(doc => doc.data())
          .filter(s => {
            const date = s.created_at?.toDate ? s.created_at.toDate() : new Date(s.created_at)
            return date.getTime() >= todayStart
          })
        const tasks = taskSnap.docs.map(doc => doc.data())

        const totalFocusMin = sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / 60
        const completedTasks = tasks.filter(t => t.completed).length
        const totalTasks = tasks.length

        // Score: 40% focus (up to 120min = max), 40% tasks, 20% consistency
        const focusScore = Math.min(totalFocusMin / 120, 1) * 40
        const taskScore = totalTasks > 0 ? (completedTasks / totalTasks) * 40 : 0
        const streakBonus = totalFocusMin > 0 ? 20 : 0

        const total = Math.round(focusScore + taskScore + streakBonus)
        setScore(total)
        setBreakdown({
          focus: Math.round(focusScore),
          tasks: Math.round(taskScore),
          streak: Math.round(streakBonus),
        })
      } catch (err) {
        console.error('Score calculation error:', err)
      }
    }

    computeScore()
    // Refresh every 60s
    const interval = setInterval(computeScore, 60000)
    return () => clearInterval(interval)
  }, [user?.uid])

  const grade = useMemo(() => {
    if (score === null) return { label: '...', color: '#888' }
    if (score >= 90) return { label: 'S', color: '#ffaa33' }
    if (score >= 75) return { label: 'A', color: '#10b981' }
    if (score >= 50) return { label: 'B', color: '#0ea5e9' }
    if (score >= 30) return { label: 'C', color: '#f59e0b' }
    return { label: 'D', color: '#ef4444' }
  }, [score])

  if (score === null) return null

  const circumference = 2 * Math.PI * 28
  const dashoffset = circumference * (1 - score / 100)

  return (
    <div className="daily-score">
      <div className="daily-score-ring">
        <svg viewBox="0 0 64 64">
          <circle className="score-track" cx="32" cy="32" r="28" />
          <circle
            className="score-fill"
            cx="32" cy="32" r="28"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            style={{ stroke: grade.color }}
          />
        </svg>
        <div className="score-grade" style={{ color: grade.color }}>{grade.label}</div>
      </div>
      <div className="daily-score-info">
        <div className="score-title">Daily Score</div>
        <div className="score-value">{score}<span className="score-max">/100</span></div>
        <div className="score-breakdown">
          <span title="Focus time (max 40pts)">🎯{breakdown.focus}</span>
          <span title="Task completion (max 40pts)">✅{breakdown.tasks}</span>
          <span title="Active today (20pts)">⚡{breakdown.streak}</span>
        </div>
      </div>
    </div>
  )
}

export default DailyScore
