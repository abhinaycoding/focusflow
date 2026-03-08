import React, { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import { collection, query, where, onSnapshot, or, and } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import './ActiveDuelBanner.css'

const ActiveDuelBanner = ({ onNavigate }) => {
  const { user } = useAuth()
  const [activeDuel, setActiveDuel] = useState(null)
  const [timeLeft, setTimeLeft] = useState(0)

  useEffect(() => {
    if (!user?.uid) return
    const q = query(
      collection(db, 'duels'),
      and(
        where('status', '==', 'active'),
        or(
          where('challenger_uid', '==', user.uid),
          where('opponent_uid', '==', user.uid)
        )
      )
    )

    const unsub = onSnapshot(q, snap => {
      if (!snap.empty) {
        setActiveDuel({ id: snap.docs[0].id, ...snap.docs[0].data() })
      } else {
        setActiveDuel(null)
      }
    })
    return () => unsub()
  }, [user?.uid])

  useEffect(() => {
    if (!activeDuel?.started_at) return
    
    const tick = () => {
      const startMs = activeDuel.started_at.toMillis()
      const totalSecs = activeDuel.duration_mins * 60
      const elapsedSecs = Math.floor((Date.now() - startMs) / 1000)
      const remaining = Math.max(0, totalSecs - elapsedSecs)
      setTimeLeft(remaining)
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [activeDuel])

  if (!activeDuel || timeLeft <= 0) return null

  const amChallenger = activeDuel.challenger_uid === user.uid
  const opponentName = amChallenger ? activeDuel.opponent_name : activeDuel.challenger_name
  
  const pad = (n) => String(n).padStart(2, '0')
  const fmt = (secs) => `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`

  return (
    <div className="active-duel-banner" onClick={() => onNavigate('duel')}>
      <div className="adb-content">
        <div className="adb-info">
          <span className="adb-icon">⚔️</span>
          <div className="adb-text">
            <span className="adb-title">Duel in Progress</span>
            <span className="adb-sub">Vs {opponentName?.split(' ')[0]} · {fmt(timeLeft)} remaining</span>
          </div>
        </div>
        <button className="adb-btn">Jump to Arena</button>
      </div>
      <div className="adb-progress-track">
        <div 
          className="adb-progress-bar" 
          style={{ width: `${(timeLeft / (activeDuel.duration_mins * 60)) * 100}%` }} 
        />
      </div>
    </div>
  )
}

export default ActiveDuelBanner
