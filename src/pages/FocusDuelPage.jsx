import React, { useState, useEffect, useRef, useCallback } from 'react'
import { db } from '../lib/firebase'
import {
  collection, doc, addDoc, updateDoc, onSnapshot,
  serverTimestamp, query, where, getDocs, getDoc, increment
} from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { usePlan } from '../contexts/PlanContext'
import './FocusDuelPage.css'

// ─── helpers ────────────────────────────────────────────────────────────────
const pad = (n) => String(n).padStart(2, '0')
const fmt = (secs) => `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`

const DURATION_OPTIONS = [15, 25, 45, 60]
const XP_FREE   = [25]
const XP_PRO    = [25, 50, 100, 200]

// ─── Main Component ──────────────────────────────────────────────────────────
const FocusDuelPage = ({ onNavigate, preselectedFriend }) => {
  const { user, profile } = useAuth()
  const { isPro } = usePlan()

  // State machine: 'hub' | 'challenge' | 'waiting' | 'arena' | 'result'
  const [screen, setScreen]               = useState('hub')
  const [friends, setFriends]             = useState([])
  const [loadingFriends, setLoadingFriends] = useState(true)

  // Challenge creation
  const [selectedFriend, setSelectedFriend] = useState(preselectedFriend || null)
  const [duration, setDuration]           = useState(25)
  const [xpStake, setXpStake]             = useState(25)
  const [sending, setSending]             = useState(false)

  // Active duel
  const [duelId, setDuelId]               = useState(null)
  const [duel, setDuel]                   = useState(null)

  // Timer
  const [timeLeft, setTimeLeft]           = useState(0)
  const timerRef                          = useRef(null)

  // Forfeit grace
  const [opponentWarning, setOpponentWarning] = useState(false)
  const [myWarning, setMyWarning]             = useState(false)
  const [graceCount, setGraceCount]           = useState(5)
  const graceRef                              = useRef(null)

  // ── Load friends ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return
    const load = async () => {
      setLoadingFriends(true)
      try {
        const [s1, s2] = await Promise.all([
          getDocs(query(collection(db, 'friend_requests'), where('from', '==', user.uid), where('status', '==', 'accepted'))),
          getDocs(query(collection(db, 'friend_requests'), where('to',   '==', user.uid), where('status', '==', 'accepted')))
        ])
        const uids = [
          ...s1.docs.map(d => d.data().to),
          ...s2.docs.map(d => d.data().from)
        ]
        const profiles = await Promise.all(
          uids.map(uid => getDoc(doc(db, 'profiles', uid)))
        )
        setFriends(profiles.filter(d => d.exists()).map(d => ({ uid: d.id, ...d.data() })))
      } catch (err) {
        console.warn('Duel: load friends error', err.message)
      } finally {
        setLoadingFriends(false)
      }
    }
    load()
  }, [user?.uid])

  // ── Listen to active duel ─────────────────────────────────────────────────
  useEffect(() => {
    if (!duelId) return
    const unsub = onSnapshot(doc(db, 'duels', duelId), (snap) => {
      if (!snap.exists()) return
      const data = { id: snap.id, ...snap.data() }
      setDuel(data)

      if (data.status === 'active' && screen === 'waiting') {
        setScreen('arena')
        setTimeLeft(data.duration_mins * 60)
      }
      if (data.status === 'completed') {
        setScreen('result')
        clearInterval(timerRef.current)
        clearInterval(graceRef.current)
      }

      // Opponent broke focus
      const amChallenger = data.challenger_uid === user.uid
      const oppActive = amChallenger ? data.opponent_active : data.challenger_active
      if (!oppActive && data.status === 'active') {
        setOpponentWarning(true)
      } else {
        setOpponentWarning(false)
      }
    })
    return () => unsub()
  }, [duelId, screen, user?.uid])

  // ── Countdown timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'arena') return
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current)
          handleDuelComplete()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [screen])

  // ── Tab visibility detection ──────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'arena' || !duelId) return

    const amChallenger = duel?.challenger_uid === user.uid
    const myField = amChallenger ? 'challenger_active' : 'opponent_active'

    const handleVisibility = async () => {
      if (document.hidden) {
        // I left the tab
        setMyWarning(true)
        await updateDoc(doc(db, 'duels', duelId), { [myField]: false })

        let count = 5
        setGraceCount(5)
        graceRef.current = setInterval(() => {
          count--
          setGraceCount(count)
          if (count <= 0) {
            clearInterval(graceRef.current)
            handleForfeit()
          }
        }, 1000)
      } else {
        // I came back
        setMyWarning(false)
        setGraceCount(5)
        clearInterval(graceRef.current)
        await updateDoc(doc(db, 'duels', duelId), { [myField]: true })
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      clearInterval(graceRef.current)
    }
  }, [screen, duelId, duel?.challenger_uid, user?.uid])

  // ── Actions ───────────────────────────────────────────────────────────────
  const sendChallenge = async () => {
    if (!selectedFriend || !user?.uid) return
    setSending(true)
    try {
      const docRef = await addDoc(collection(db, 'duels'), {
        challenger_uid:    user.uid,
        challenger_name:   profile.full_name,
        challenger_photo:  profile.photo_url || null,
        opponent_uid:      selectedFriend.uid,
        opponent_name:     selectedFriend.full_name,
        opponent_photo:    selectedFriend.photo_url || null,
        duration_mins:     duration,
        xp_stake:          xpStake,
        status:            'pending',
        winner_uid:        null,
        loser_uid:         null,
        challenger_active: true,
        opponent_active:   true,
        challenger_broke_at: null,
        opponent_broke_at:   null,
        created_at:        serverTimestamp(),
        started_at:        null,
      })
      setDuelId(docRef.id)
      setScreen('waiting')
    } catch (err) {
      console.warn('Duel: send error', err.message)
    } finally {
      setSending(false)
    }
  }

  const acceptDuel = async (incomingDuelId) => {
    try {
      await updateDoc(doc(db, 'duels', incomingDuelId), {
        status:     'active',
        started_at: serverTimestamp(),
      })
      setDuelId(incomingDuelId)
    } catch (err) {
      console.warn('Duel: accept error', err.message)
    }
  }

  const handleForfeit = useCallback(async () => {
    if (!duelId || !duel) return
    const amChallenger = duel.challenger_uid === user.uid
    const winnerUid    = amChallenger ? duel.opponent_uid : duel.challenger_uid
    const loserUid     = user.uid
    try {
      await updateDoc(doc(db, 'duels', duelId), {
        status:    'completed',
        winner_uid: winnerUid,
        loser_uid:  loserUid,
        [amChallenger ? 'challenger_broke_at' : 'opponent_broke_at']: serverTimestamp()
      })
      // XP transfer
      await updateDoc(doc(db, 'profiles', loserUid),  { xp: increment(-duel.xp_stake) })
      await updateDoc(doc(db, 'profiles', winnerUid), { xp: increment(duel.xp_stake)  })
    } catch (err) {
      console.warn('Duel: forfeit error', err.message)
    }
  }, [duelId, duel, user?.uid])

  const handleDuelComplete = useCallback(async () => {
    if (!duelId || !duel) return
    // Both survived — both get bonus XP
    try {
      await updateDoc(doc(db, 'duels', duelId), {
        status:     'completed',
        winner_uid: 'both',
        loser_uid:  null,
      })
      const bonus = Math.round(duel.xp_stake * 0.5)
      await updateDoc(doc(db, 'profiles', duel.challenger_uid), { xp: increment(bonus) })
      await updateDoc(doc(db, 'profiles', duel.opponent_uid),   { xp: increment(bonus) })
    } catch (err) {
      console.warn('Duel: complete error', err.message)
    }
  }, [duelId, duel])

  const cancelDuel = async () => {
    if (!duelId) return
    try {
      await updateDoc(doc(db, 'duels', duelId), { status: 'cancelled' })
    } catch (err) {
      console.warn('Duel: cancel error', err.message)
    }
    // Reset local state back to challenge screen
    setDuelId(null)
    setDuel(null)
    setScreen('challenge')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Hub
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === 'hub') return (
    <div className="duel-page">
      <div className="duel-hub">
        <div className="duel-hub-hero">
          <div className="duel-hub-emblem">⚔️</div>
          <h1 className="duel-hub-title">Focus Duel</h1>
          <p className="duel-hub-sub">Lock in. Stay focused. The first one to blink loses their XP.</p>
        </div>

        <div className="duel-hub-friends">
          <div className="duel-hub-section-label">Choose your opponent</div>
          {loadingFriends ? (
            <div className="duel-friends-loading">
              <div className="duel-skeleton"/><div className="duel-skeleton"/><div className="duel-skeleton"/>
            </div>
          ) : friends.length === 0 ? (
            <div className="duel-no-friends">
              <span>🤝</span>
              <p>Add friends first to challenge them!</p>
              <button className="duel-cta-btn" onClick={() => onNavigate('dashboard')}>
                Find Friends
              </button>
            </div>
          ) : (
            <div className="duel-friends-grid">
              {friends.map(f => (
                <button
                  key={f.uid}
                  className={`duel-friend-card ${selectedFriend?.uid === f.uid ? 'duel-friend-card-selected' : ''}`}
                  onClick={() => { setSelectedFriend(f); setScreen('challenge') }}
                >
                  <div className="duel-f-avatar">
                    {f.photo_url
                      ? <img src={f.photo_url} alt={f.full_name} />
                      : (f.avatar_emoji || f.full_name?.[0]?.toUpperCase() || '?')
                    }
                  </div>
                  <div className="duel-f-name">{f.full_name?.split(' ')[0]}</div>
                  <div className="duel-f-xp">{f.xp || 0} XP</div>
                  <div className="duel-challenge-badge">⚔️ Challenge</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Incoming duels listener */}
        <IncomingDuelsBanner uid={user?.uid} onAccept={acceptDuel} />
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Challenge Modal
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === 'challenge') {
    const xpOptions = isPro ? XP_PRO : XP_FREE
    return (
      <div className="duel-page">
        <div className="duel-challenge-screen">
          <button className="duel-back-btn" onClick={() => setScreen('hub')}>← Back</button>

          <div className="duel-vs-row">
            <div className="duel-vs-avatar you">
              {profile?.photo_url ? <img src={profile.photo_url} alt="You" /> : profile?.full_name?.[0] || 'Y'}
              <span className="duel-vs-label">YOU</span>
            </div>
            <div className="duel-vs-center">
              <div className="duel-vs-flame">⚔️</div>
              <div className="duel-vs-text">VS</div>
            </div>
            <div className="duel-vs-avatar opp">
              {selectedFriend?.photo_url ? <img src={selectedFriend.photo_url} alt="Opponent" /> : selectedFriend?.full_name?.[0] || '?'}
              <span className="duel-vs-label">{selectedFriend?.full_name?.split(' ')[0]}</span>
            </div>
          </div>

          <div className="duel-settings-card">
            <div className="duel-setting-group">
              <div className="duel-setting-label">⏱ Duration</div>
              <div className="duel-option-row">
                {DURATION_OPTIONS.map(d => (
                  <button
                    key={d}
                    className={`duel-option-btn ${duration === d ? 'duel-option-active' : ''} ${!isPro && d !== 25 ? 'duel-option-locked' : ''}`}
                    onClick={() => {
                      if (!isPro && d !== 25) return
                      setDuration(d)
                    }}
                  >
                    {d}m
                    {!isPro && d !== 25 && <span className="duel-pro-lock">Pro</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="duel-setting-group">
              <div className="duel-setting-label">💎 XP Stake</div>
              <div className="duel-option-row">
                {(isPro ? XP_PRO : XP_FREE).map(xp => (
                  <button
                    key={xp}
                    className={`duel-option-btn ${xpStake === xp ? 'duel-option-active' : ''}`}
                    onClick={() => setXpStake(xp)}
                  >
                    {xp} XP
                  </button>
                ))}
                {!isPro && (
                  <button className="duel-unlock-btn" onClick={() => onNavigate('pricing')}>
                    🔒 Unlock 50–200 XP
                  </button>
                )}
              </div>
            </div>

            <div className="duel-winner-bar">
              🔥 Winner steals <strong>{xpStake} XP</strong> · Loser loses <strong>{xpStake} XP</strong>
            </div>

            <button
              className={`duel-send-btn ${sending ? 'duel-sending' : ''}`}
              disabled={sending}
              onClick={sendChallenge}
            >
              {sending ? 'Sending Challenge…' : `⚔️ Challenge ${selectedFriend?.full_name?.split(' ')[0]}`}
            </button>
          </div>

          {!isPro && (
            <div className="duel-pro-nudge" onClick={() => onNavigate('pricing')}>
              🚀 <strong>Upgrade to Pro</strong> — unlock all durations &amp; up to 200 XP stakes
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Waiting for opponent
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === 'waiting') return (
    <div className="duel-page duel-dark-bg">
      <div className="duel-waiting">
        <div className="duel-waiting-ring">
          <div className="duel-waiting-avatar">
            {selectedFriend?.photo_url
              ? <img src={selectedFriend.photo_url} alt={selectedFriend.full_name} />
              : selectedFriend?.full_name?.[0] || '?'
            }
          </div>
        </div>
        <h2 className="duel-waiting-title">Waiting for {selectedFriend?.full_name?.split(' ')[0]}…</h2>
        <p className="duel-waiting-sub">Challenge sent! They need to accept to start the duel.</p>
        <div className="duel-waiting-dots"><span/><span/><span/></div>
        <button className="duel-cancel-btn" onClick={cancelDuel}>
          ✕ Cancel Challenge
        </button>
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Arena
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === 'arena' && duel) {
    const amChallenger = duel.challenger_uid === user.uid
    const me  = { name: amChallenger ? duel.challenger_name  : duel.opponent_name,  photo: amChallenger ? duel.challenger_photo : duel.opponent_photo  }
    const opp = { name: amChallenger ? duel.opponent_name    : duel.challenger_name, photo: amChallenger ? duel.opponent_photo   : duel.challenger_photo }
    const oppIsActive = amChallenger ? duel.opponent_active  : duel.challenger_active

    return (
      <div className="duel-page duel-arena">
        {/* Top bar */}
        <div className="duel-arena-topbar">
          <div className="duel-arena-xp-pill">⚔️ {duel.xp_stake} XP on the line</div>
          <div className="duel-arena-label">FOCUS DUEL</div>
          <div className="duel-arena-duration">{duel.duration_mins}:00 session</div>
        </div>

        {/* Main arena grid */}
        <div className="duel-arena-grid">
          {/* ME */}
          <div className={`duel-player-panel duel-player-me ${myWarning ? 'duel-breaking' : 'duel-focused'}`}>
            <div className="duel-player-avatar-wrap">
              <div className="duel-focus-ring" />
              <div className="duel-player-avatar">
                {me.photo ? <img src={me.photo} alt={me.name} /> : me.name?.[0] || 'Y'}
              </div>
            </div>
            <div className="duel-player-name">YOU</div>
            <div className="duel-big-timer">{fmt(timeLeft)}</div>
            {myWarning && (
              <div className="duel-warning-banner">
                ⚠️ Return NOW! <span className="duel-grace-count">{graceCount}</span>
              </div>
            )}
          </div>

          {/* VS Centre */}
          <div className="duel-arena-centre">
            <div className="duel-vs-swords">⚔️</div>
            <div className="duel-vs-label-big">VS</div>
            <div className="duel-xp-badge">{duel.xp_stake}<br/><span>XP</span></div>
          </div>

          {/* OPPONENT */}
          <div className={`duel-player-panel duel-player-opp ${opponentWarning ? 'duel-breaking' : oppIsActive ? 'duel-focused' : 'duel-breaking'}`}>
            <div className="duel-player-avatar-wrap">
              <div className="duel-focus-ring" />
              <div className="duel-player-avatar">
                {opp.photo ? <img src={opp.photo} alt={opp.name} /> : opp.name?.[0] || '?'}
              </div>
            </div>
            <div className="duel-player-name">{opp.name?.split(' ')[0]}</div>
            <div className="duel-big-timer">{fmt(timeLeft)}</div>
            {opponentWarning && (
              <div className="duel-warning-banner opp-warn">👀 They left! Holding breath…</div>
            )}
          </div>
        </div>

        <div className="duel-arena-footer">
          <div className="duel-focus-tip">🔒 Stay on this tab. Leave = instant forfeit.</div>
          <button className="duel-forfeit-btn" onClick={handleForfeit}>Surrender</button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Result
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === 'result' && duel) {
    const bothWon   = duel.winner_uid === 'both'
    const iWon      = duel.winner_uid === user.uid
    const iLost     = duel.loser_uid  === user.uid

    return (
      <div className={`duel-page duel-result-screen ${iWon ? 'result-win' : iLost ? 'result-lose' : 'result-draw'}`}>
        <div className="duel-result-inner">
          {bothWon ? (
            <>
              <div className="duel-result-emoji">🤝</div>
              <h1 className="duel-result-title">Both Focused!</h1>
              <p className="duel-result-sub">Both of you stayed the full {duel.duration_mins} minutes.<br/>+{Math.round(duel.xp_stake * 0.5)} XP bonus each!</p>
            </>
          ) : iWon ? (
            <>
              <div className="duel-result-emoji winner-emoji">🏆</div>
              <h1 className="duel-result-title winner-title">You Won!</h1>
              <p className="duel-result-sub">+{duel.xp_stake} XP stolen from {duel.loser_uid === duel.challenger_uid ? duel.challenger_name : duel.opponent_name}!</p>
              <div className="duel-xp-gained">+{duel.xp_stake} XP</div>
            </>
          ) : (
            <>
              <div className="duel-result-emoji">💀</div>
              <h1 className="duel-result-title loser-title">You Lost</h1>
              <p className="duel-result-sub">You broke focus. -{duel.xp_stake} XP deducted.</p>
              <div className="duel-xp-lost">-{duel.xp_stake} XP</div>
            </>
          )}

          <div className="duel-result-actions">
            <button className="duel-result-btn rematch" onClick={() => {
              setDuelId(null); setDuel(null); setScreen('challenge')
            }}>⚔️ Rematch</button>
            <button className="duel-result-btn home" onClick={() => onNavigate('dashboard')}>
              Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: listens for incoming duel invites
// ─────────────────────────────────────────────────────────────────────────────
const IncomingDuelsBanner = ({ uid, onAccept }) => {
  const [incoming, setIncoming] = useState([])

  useEffect(() => {
    if (!uid) return
    const q = query(
      collection(db, 'duels'),
      where('opponent_uid', '==', uid),
      where('status', '==', 'pending')
    )
    const unsub = onSnapshot(q, snap => {
      setIncoming(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [uid])

  if (!incoming.length) return null

  return (
    <div className="duel-incoming-section">
      <div className="duel-hub-section-label">⚔️ Incoming Challenges</div>
      {incoming.map(d => (
        <div key={d.id} className="duel-incoming-card">
          <div className="duel-incoming-avatar">
            {d.challenger_photo ? <img src={d.challenger_photo} alt={d.challenger_name} /> : d.challenger_name?.[0] || '?'}
          </div>
          <div className="duel-incoming-info">
            <div className="duel-incoming-name">{d.challenger_name}</div>
            <div className="duel-incoming-sub">challenged you · {d.duration_mins} min · {d.xp_stake} XP</div>
          </div>
          <button className="duel-accept-btn" onClick={() => onAccept(d.id)}>
            ⚔️ Accept
          </button>
        </div>
      ))}
    </div>
  )
}

export default FocusDuelPage
