import React, { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import {
  collection, query, where, onSnapshot,
  updateDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import './DuelInvitePopup.css'

// ─── Global Duel Challenge Popup ─────────────────────────────────────────────
// Listens for incoming pending duels anywhere in the app. Shows a cinematic
// toaster popup with challenger info — user can Accept or Decline inline.
const DuelInvitePopup = ({ onNavigate }) => {
  const { user } = useAuth()
  const [challenges, setChallenges] = useState([])
  const [dismissedIds, setDismissedIds]  = useState(new Set())

  useEffect(() => {
    if (!user?.uid) return
    const q = query(
      collection(db, 'duels'),
      where('opponent_uid',  '==', user.uid),
      where('status',        '==', 'pending')
    )
    const unsub = onSnapshot(q, snap => {
      setChallenges(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [user?.uid])

  const handleAccept = async (duel) => {
    try {
      await updateDoc(doc(db, 'duels', duel.id), {
        status:     'active',
        started_at: serverTimestamp(),
      })
      dismiss(duel.id)
      onNavigate?.('duel')
    } catch (err) {
      console.warn('DuelInvitePopup: accept error', err.message)
    }
  }

  const handleDecline = async (duel) => {
    try {
      await updateDoc(doc(db, 'duels', duel.id), { status: 'cancelled' })
    } catch (err) {
      console.warn('DuelInvitePopup: decline error', err.message)
    }
    dismiss(duel.id)
  }

  const dismiss = (id) => {
    setDismissedIds(prev => new Set([...prev, id]))
  }

  const visible = challenges.filter(c => !dismissedIds.has(c.id))
  if (!visible.length) return null

  return (
    <div className="dip-stack">
      {visible.map((duel, idx) => (
        <div
          key={duel.id}
          className="dip-card"
          style={{ '--idx': idx }}
        >
          {/* Animated glow border */}
          <div className="dip-glow-border" />

          {/* Header */}
          <div className="dip-header">
            <span className="dip-badge">⚔️ DUEL REQUEST</span>
            <button className="dip-x" onClick={() => dismiss(duel.id)}>✕</button>
          </div>

          {/* Challenger info */}
          <div className="dip-body">
            <div className="dip-avatar">
              {duel.challenger_photo
                ? <img src={duel.challenger_photo} alt={duel.challenger_name} />
                : duel.challenger_name?.[0]?.toUpperCase() || '?'
              }
              <span className="dip-avatar-ring" />
            </div>
            <div className="dip-info">
              <div className="dip-challenger-name">{duel.challenger_name}</div>
              <div className="dip-details">
                <span className="dip-pill">⏱ {duel.duration_mins} min</span>
                <span className="dip-pill dip-xp-pill">💎 {duel.xp_stake} XP</span>
              </div>
              <div className="dip-stakes-text">
                Winner steals <strong>{duel.xp_stake} XP</strong> from loser
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="dip-actions">
            <button
              className="dip-btn dip-decline"
              onClick={() => handleDecline(duel)}
            >
              Decline
            </button>
            <button
              className="dip-btn dip-accept"
              onClick={() => handleAccept(duel)}
            >
              ⚔️ Accept Duel
            </button>
          </div>

          {/* Auto-dismiss progress bar */}
          <div className="dip-timer-bar" />
        </div>
      ))}
    </div>
  )
}

export default DuelInvitePopup
