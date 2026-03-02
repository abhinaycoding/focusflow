import React, { useState, useEffect, useRef } from 'react'
import { db } from '../lib/firebase'
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  serverTimestamp,
  limit,
  getDocs,
  Timestamp
} from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { useTimer } from '../contexts/TimerContext'
import { useZen } from '../contexts/ZenContext'
import { useToast } from '../contexts/ToastContext'
import { getArchetype } from '../constants/archetypes'
import { getZenTrack } from '../constants/zenTracks'
import SharedWhiteboard from '../components/study/SharedWhiteboard'
import './StudyRoomPage.css'

// Mini timer ring SVG for each member
const MiniTimerRing = ({ status, secondsLeft, isZen }) => {
  const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return ''
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const color = isZen ? 'var(--primary)' : status === 'focusing' ? 'var(--success)' : 'var(--text-secondary)'
  
  return (
    <div className="mini-timer-wrap">
      <div className="mini-timer-text" style={{ color }}>
        {status === 'focusing' ? formatTime(secondsLeft) : status === 'done' ? 'DONE' : 'IDLE'}
      </div>
      {isZen && <span className="zen-mini-tag">ZEN</span>}
    </div>
  )
}

const StudyRoomPage = ({ roomId, roomName, onNavigate, onBack }) => {
  const { user, profile } = useAuth()
  const { secondsLeft, isRunning, isComplete } = useTimer()
  const { isZenModeActive, activeTrackId } = useZen()
  const toast = useToast()

  const [members, setMembers] = useState([])
  const [nudgedMemberId, setNudgedMemberId] = useState(null)
  const [tasks, setTasks] = useState([])
  const [newTask, setNewTask] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const [showTasksMobile, setShowTasksMobile] = useState(false)
  const [showWhiteboard, setShowWhiteboard] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [typingUsers, setTypingUsers] = useState([])
  const [activeEmotes, setActiveEmotes] = useState([])
  const [groupMomentum, setGroupMomentum] = useState(0)
  const chatBottomRef = useRef(null)
  const typingTimerRef = useRef(null)

  const displayName = profile?.full_name || 'Scholar'
  const guestId = user?.uid
  const guestProfile = profile

  // 1. Fetch Room Code
  useEffect(() => {
    if (!roomId) return
    const unsubscribe = onSnapshot(doc(db, 'study_rooms', roomId), (snap) => {
      if (snap.exists()) setRoomCode(snap.data().code)
    })
    return () => unsubscribe()
  }, [roomId])

  // 2. Presence Heartbeat & Membership Sync
  useEffect(() => {
    if (!user?.uid || !roomId) return

    const updatePresence = async () => {
      const q = query(
        collection(db, 'room_members'), 
        where('room_id', '==', roomId),
        where('user_id', '==', user.uid)
      )
      const snap = await getDocs(q)
      if (!snap.empty) {
        await updateDoc(doc(db, 'room_members', snap.docs[0].id), {
          display_name: displayName,
          avatar_id: profile?.avatar_id || 'owl',
          timer_status: isRunning ? 'focusing' : isComplete ? 'done' : 'idle',
          seconds_left: secondsLeft,
          is_zen: isZenModeActive,
          active_track_id: activeTrackId || null,
          last_seen: serverTimestamp()
        })
      }
    }

    updatePresence()
    const interval = setInterval(updatePresence, 15000)

    const q = query(collection(db, 'room_members'), where('room_id', '==', roomId))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = Date.now()
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setMembers(list.filter(m => {
        const lastSeen = m.last_seen?.toDate ? m.last_seen.toDate().getTime() : now
        return (now - lastSeen) < 120000
      }))
    })

    return () => {
      clearInterval(interval)
      unsubscribe()
    }
  }, [roomId, user?.uid, isRunning, isComplete, secondsLeft, isZenModeActive, activeTrackId, displayName, profile?.avatar_id])

  // Group Momentum Calculation
  useEffect(() => {
    if (members.length === 0) {
      setGroupMomentum(0)
      return
    }
    const focusing = members.filter(m => m.timer_status === 'focusing').length
    setGroupMomentum(Math.round((focusing / members.length) * 100))
  }, [members])

  // 3. Shared Tasks
  useEffect(() => {
    if (!roomId) return
    const q = query(collection(db, 'room_tasks'), where('room_id', '==', roomId))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => {
        const da = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at)
        const db = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at)
        return da - db
      }))
    })
    return () => unsubscribe()
  }, [roomId])

  // 4. Chat Messages — sort client-side so no composite index needed immediately
  useEffect(() => {
    if (!roomId) return
    const q = query(
      collection(db, 'room_messages'),
      where('room_id', '==', roomId),
      limit(80)
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      msgs.sort((a, b) => {
        const ta = a.created_at?.toDate ? a.created_at.toDate().getTime() : 0
        const tb = b.created_at?.toDate ? b.created_at.toDate().getTime() : 0
        return ta - tb
      })
      setMessages(msgs)
    }, (err) => {
      console.error('Chat listener error:', err.message)
    })
    return () => unsubscribe()
  }, [roomId])

  // 4b. Typing Presence (write own status, read others)
  const broadcastTyping = () => {
    if (!roomId || !user?.uid) return
    setDoc(doc(db, 'room_typing', `${roomId}_${user.uid}`), {
      room_id: roomId,
      user_id: user.uid,
      name: displayName,
      ts: serverTimestamp()
    }).catch(() => {})
  }

  const clearTyping = () => {
    if (!roomId || !user?.uid) return
    deleteDoc(doc(db, 'room_typing', `${roomId}_${user.uid}`)).catch(() => {})
  }

  useEffect(() => {
    if (!roomId) return
    const q = query(collection(db, 'room_typing'), where('room_id', '==', roomId))
    const unsub = onSnapshot(q, (snap) => {
      const now = Date.now()
      setTypingUsers(
        snap.docs
          .map(d => d.data())
          .filter(d => d.user_id !== user?.uid && d.ts?.toDate && (now - d.ts.toDate().getTime()) < 5000)
          .map(d => d.name)
      )
    })
    return () => unsub()
  }, [roomId, user?.uid])

  // 5. Ephemeral Events (Nudges, Emotes)
  const triggerEmote = (emoji) => {
    const id = Math.random().toString(36).substring(7)
    const startX = Math.random() * 80 + 10 // 10% to 90%
    setActiveEmotes(prev => [...prev, { id, emoji, startX }])
    setTimeout(() => {
      setActiveEmotes(prev => prev.filter(e => e.id !== id))
    }, 4000)
  }

  useEffect(() => {
    if (!roomId || !user?.uid) return
    const q = query(
      collection(db, 'room_events'), 
      where('room_id', '==', roomId)
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fiveSecondsAgo = Date.now() - 5000
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const event = change.doc.data()
          const eventTime = event.created_at?.toDate ? event.created_at.toDate().getTime() : new Date(event.created_at).getTime()
          if (eventTime < fiveSecondsAgo) return

          if (event.type === 'emote') triggerEmote(event.emoji)
          if (event.type === 'nudge' && event.target_id === user.uid) {
            handleReceivedNudge(event.from_name)
          }
        }
      })
    })
    return () => unsubscribe()
  }, [roomId, user?.uid])

  const addTask = async () => {
    if (!newTask.trim() || !user?.uid) return
    setAddingTask(true)
    try {
      await addDoc(collection(db, 'room_tasks'), {
        room_id: roomId,
        created_by: user.uid,
        title: newTask.trim(),
        completed: false,
        created_at: serverTimestamp()
      })
      setNewTask('')
    } catch (err) {
      toast('Failed to add task.', 'error')
    } finally {
      setAddingTask(false)
    }
  }

  const toggleTask = async (task) => {
    try {
      await updateDoc(doc(db, 'room_tasks', task.id), { completed: !task.completed })
    } catch (err) {
      toast('Failed to update task.', 'error')
    }
  }

  const deleteTask = async (id) => {
    try {
      await deleteDoc(doc(db, 'room_tasks', id))
    } catch (err) {
      toast('Failed to delete task.', 'error')
    }
  }

  const sendChat = async () => {
    if (!chatInput.trim() || !user?.uid) return
    const text = chatInput.trim()
    setChatInput('')
    clearTyping()
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    try {
      await addDoc(collection(db, 'room_messages'), {
        room_id: roomId,
        user_id: user.uid,
        display_name: displayName,
        avatar_id: profile?.avatar_id || 'owl',
        text,
        created_at: serverTimestamp(),
      })
    } catch (err) { console.error(err) }
  }

  const handleChatInput = (e) => {
    setChatInput(e.target.value)
    broadcastTyping()
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => clearTyping(), 3000)
  }

  const broadcastEmote = async (emoji) => {
    triggerEmote(emoji)
    try {
      await addDoc(collection(db, 'room_events'), {
        room_id: roomId,
        type: 'emote',
        emoji,
        user_id: user.uid,
        created_at: serverTimestamp()
      })
    } catch (err) { /* ignore */ }
  }

  const sendNudge = async (targetMember) => {
    try {
      await addDoc(collection(db, 'room_events'), {
        room_id: roomId,
        type: 'nudge',
        target_id: targetMember.user_id,
        from_name: displayName,
        created_at: serverTimestamp()
      })
      toast(`Nudged ${targetMember.display_name}! 🔔`, 'success')
    } catch (err) { /* ignore */ }
  }

  const handleReceivedNudge = (fromName) => {
    setNudgedMemberId('me')
    toast(`${fromName} nudged you! Stay focused! 🔔`, 'info')
    setTimeout(() => setNudgedMemberId(null), 2000)
  }

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Cleanup: delete user's messages on unmount (temporary chat)
  useEffect(() => {
    return () => {
      if (!roomId || !user?.uid) return
      const q = query(
        collection(db, 'room_messages'),
        where('room_id', '==', roomId),
        where('user_id', '==', user.uid)
      )
      getDocs(q).then(snap => {
        snap.docs.forEach(d => deleteDoc(doc(db, 'room_messages', d.id)).catch(() => {}))
      }).catch(() => {})
    }
  }, [roomId, user?.uid])

  const EMOTES = ['🔥', '💯', '🧠', '☕', '💡', '🚀']
  const completes = tasks.filter(t => t.completed)
  const incompletes = tasks.filter(t => !t.completed)

  return (
    <>
      <div className="momentum-container">
        <div className="momentum-fill" style={{ width: `${groupMomentum}%` }} />
        <div className="momentum-glow" />
      </div>

      <div className="floating-emote-layer">
        {activeEmotes.map(emote => (
          <div 
            key={emote.id} 
            className="floating-emote"
            style={{ left: `${emote.startX}%` }}
          >
            {emote.emoji}
          </div>
        ))}
      </div>

      <div className="flex flex-col h-full overflow-hidden">
        <header className="room-header p-4 border-b border-ink flex justify-between items-center">
            <div className="flex items-center gap-4">
               <h1 className="text-xl font-serif text-primary truncate">{roomName}</h1>
               <div className="flex items-center gap-2 text-xs text-muted font-bold tracking-widest uppercase">
                  <span className="live-dot" /> Live {members.length}
               </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowWhiteboard(true)}
                className="open-whiteboard-btn flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-all text-xs font-bold"
              >
                <span>🎨</span> Whiteboard
              </button>
              <button onClick={onBack} className="text-xs uppercase tracking-widest font-bold text-muted hover:text-primary transition-colors">
                ← Exit
              </button>
            </div>
        </header>

        <main className="room-main flex-1 overflow-hidden">
          <div className="room-layout h-full">

            {/* LEFT — Members Panel */}
            <div className="room-panel room-panel--members flex flex-col h-full border-r border-ink">
              <div className="p-4 overflow-y-auto flex-1">
                <div className="members-list grid gap-3">
                  {members.map(m => {
                    const arche = getArchetype(m.avatar_id)
                    const isMe = m.user_id === guestId
                    const isNudged = (isMe && nudgedMemberId === 'me') || (!isMe && nudgedMemberId === m.user_id)
                    const currentTrack = m.is_zen ? getZenTrack(m.active_track_id) : null

                    return (
                      <div key={m.user_id} className={`member-card ${isMe ? 'member-card--you' : ''} ${m.is_zen ? 'member-card--zen' : ''} ${isNudged ? 'member-card--nudged' : ''} member-card--${m.timer_status || 'idle'}`}>
                        <div className="member-avatar">{arche.emoji}</div>
                        <div className="member-info">
                          <div className="member-name-row flex justify-between">
                            <span className="member-name font-bold text-sm truncate">{m.display_name}</span>
                            {!isMe && <button onClick={() => sendNudge(m)} className="text-xs hover:scale-110 transition-transform">🔔</button>}
                          </div>
                          <MiniTimerRing status={m.timer_status} secondsLeft={m.seconds_left} isZen={m.is_zen} />
                          {currentTrack && <div className="text-[10px] text-primary/70 italic mt-1 truncate">🎵 {currentTrack.name}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* CENTER — Shared Tasks (Mobile Drawer / Desktop Panel) */}
            {showTasksMobile && (
              <div 
                className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={() => setShowTasksMobile(false)}
              />
            )}
            <div className={`room-panel room-panel--tasks flex flex-col h-full border-r border-ink ${showTasksMobile ? 'mobile-visible' : ''} z-50`}>
              <div className="p-4 border-b border-ink flex justify-between items-center bg-bg-card md:bg-transparent sticky top-0 z-10">
                <span className="font-serif italic text-muted">Shared Tasks</span>
                <button 
                  className="md:hidden text-muted hover:text-primary transition-colors text-lg" 
                  onClick={() => setShowTasksMobile(false)}
                >
                  ✕
                </button>
              </div>
              <div className="p-4 flex gap-2">
                <input
                  type="text"
                  value={newTask}
                  onChange={e => setNewTask(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTask()}
                  placeholder="Collaborate..."
                  className="flex-1 bg-ink/30 border border-ink rounded px-3 py-1 text-sm text-primary outline-none focus:border-primary/50"
                />
                <button onClick={addTask} disabled={addingTask || !newTask.trim()} className="text-primary font-bold">+</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {incompletes.map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-2 bg-ink/10 rounded group">
                    <button className="w-4 h-4 rounded-full border border-primary/50" onClick={() => toggleTask(task)} />
                    <span className="text-sm flex-1">{task.title}</span>
                    <button onClick={() => deleteTask(task.id)} className="opacity-0 group-hover:opacity-100 text-xs text-danger transition-opacity">✕</button>
                  </div>
                ))}
                {completes.map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-2 bg-primary/5 rounded opacity-50">
                    <button className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-[10px]" onClick={() => toggleTask(task)}>✓</button>
                    <span className="text-sm flex-1 line-through">{task.title}</span>
                    <button onClick={() => deleteTask(task.id)} className="text-xs text-danger">✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT — Chat */}
            <div className="room-panel room-panel--chat" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', overflow: 'hidden', position: 'relative' }}>
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="live-dot" />
                  <span className="font-serif italic text-muted">Live Chat</span>
                </div>
                {/* Mobile Tasks Toggle */}
                <button 
                  className="mobile-tasks-toggle"
                  onClick={() => setShowTasksMobile(true)}
                >
                  <span className="mobile-tasks-badge">{incompletes.length}</span>
                  📝 Tasks
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: 0 }}>
                {messages.length === 0 && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.45, gap: '0.5rem' }}>
                    <div style={{ fontSize: '2rem' }}>💬</div>
                    <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, color: 'var(--text-secondary)' }}>No messages yet</p>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Be the first to say something to your study group!</p>
                  </div>
                )}
                {messages.map((msg, i) => {
                  const isMe = msg.user_id === guestId
                  const arche = getArchetype(msg.avatar_id || 'owl')
                  const ts = msg.created_at?.toDate ? msg.created_at.toDate() : null
                  const timeStr = ts ? ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
                  const prevMsg = messages[i - 1]
                  const showName = !prevMsg || prevMsg.user_id !== msg.user_id
                  return (
                    <div key={msg.id} style={{ display: 'flex', gap: '0.5rem', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                      <div style={{ width: 28, flexShrink: 0 }}>
                        {showName && (
                          <div style={{ width: 28, height: 28, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>
                            {arche.emoji}
                          </div>
                        )}
                      </div>
                      <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: '2px' }}>
                        {showName && (
                          <span style={{ fontSize: '0.6rem', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', paddingLeft: isMe ? 0 : '0.25rem', paddingRight: isMe ? '0.25rem' : 0 }}>
                            {isMe ? 'You' : msg.display_name}
                          </span>
                        )}
                        <div style={{
                          padding: '0.5rem 0.9rem',
                          background: isMe ? 'var(--primary)' : 'var(--bg-card)',
                          color: isMe ? '#fff' : 'var(--text-primary)',
                          border: isMe ? 'none' : '1px solid var(--border)',
                          borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          fontSize: '0.85rem', lineHeight: 1.45, wordBreak: 'break-word',
                          boxShadow: isMe ? '0 2px 8px rgba(0,0,0,0.15)' : 'none'
                        }}>
                          {msg.text}
                        </div>
                        {timeStr && <span style={{ fontSize: '0.5rem', color: 'var(--text-secondary)', opacity: 0.55, padding: '0 0.25rem' }}>{timeStr}</span>}
                      </div>
                    </div>
                  )
                })}
                {typingUsers.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', paddingLeft: '2.4rem' }}>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '0.4rem 0.75rem', display: 'flex', gap: '3px', alignItems: 'center' }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-secondary)', animation: 'typing-dot 1.2s infinite', display: 'inline-block' }} />
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-secondary)', animation: 'typing-dot 1.2s 0.2s infinite', display: 'inline-block' }} />
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-secondary)', animation: 'typing-dot 1.2s 0.4s infinite', display: 'inline-block' }} />
                    </div>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>{typingUsers.join(', ')} typing…</span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>
              {/* Input area — pinned at bottom */}
              <div style={{ flexShrink: 0, padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', justifyContent: 'center' }}>
                  {EMOTES.map(emoji => (
                    <button key={emoji} onClick={() => broadcastEmote(emoji)}
                      style={{ fontSize: '1.2rem', transition: 'transform 0.15s', background: 'none', border: 'none', cursor: 'pointer' }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.3)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >{emoji}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-color)', border: '1px solid var(--border)', borderRadius: '24px', overflow: 'hidden' }}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={handleChatInput}
                    onKeyDown={e => e.key === 'Enter' && sendChat()}
                    placeholder="Say something…"
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '0.65rem 1rem', fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}
                  />
                  <button
                    onClick={sendChat}
                    disabled={!chatInput.trim()}
                    style={{ padding: '0.65rem 1rem', background: chatInput.trim() ? 'var(--primary)' : 'transparent', color: chatInput.trim() ? '#fff' : 'var(--text-secondary)', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', border: 'none', borderRadius: '0 24px 24px 0', cursor: chatInput.trim() ? 'pointer' : 'not-allowed', transition: 'all 0.2s', fontFamily: 'var(--font-sans)' }}
                  >Send →</button>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>

      {showWhiteboard && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ width: '100%', height: '100%', maxWidth: '1200px', background: 'var(--bg-card)', border: '1px solid var(--ink)', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '8px 8px 0 var(--ink)' }}>
            <SharedWhiteboard
              roomId={roomId}
              user={{ uid: guestId, ...guestProfile }}
              onClose={() => setShowWhiteboard(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}

export default StudyRoomPage
