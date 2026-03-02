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
      <div className="flex flex-col h-full overflow-hidden relative z-10">
        <header className="room-header-v2 px-8 py-6 flex justify-between items-center relative z-20">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-serif italic text-primary leading-tight">{roomName}</h1>
              <div className="room-code-badge-new" onClick={() => {
                navigator.clipboard.writeText(roomCode)
                toast('Room code copied!', 'success')
              }}>
                {roomCode}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="live-dot" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-black text-muted/60">
                {members.length} scholars active
              </span>
            </div>
          </div>

          <button onClick={onBack} className="exit-btn-minimal">
            <span className="icon">←</span>
            <span className="label">Leave Room</span>
          </button>
        </header>

        <main className="room-main flex-1 overflow-hidden">
          <div className="room-layout">


            {/* LEFT — Members Panel */}
            <div className="room-panel room-panel--members">
              <div className="members-container">
                <div className="members-list">
                  {members.map(m => {
                    const arche = getArchetype(m.avatar_id)
                    const isMe = m.user_id === guestId
                    const isNudged = (isMe && nudgedMemberId === 'me') || (!isMe && nudgedMemberId === m.user_id)
                    const currentTrack = m.is_zen ? getZenTrack(m.active_track_id) : null

                    return (
                      <div key={m.user_id} className={`member-card ${isMe ? 'member-card--you' : ''} ${m.is_zen ? 'member-card--zen' : ''} ${isNudged ? 'member-card--nudged' : ''} member-card--${m.timer_status || 'idle'}`}>
                        <div className="member-avatar-container">
                          <span className="member-emoji">{arche.emoji}</span>
                        </div>
                        <div className="member-info">
                          <div className="member-name-row">
                            <span className="member-name">{m.display_name}</span>
                            {!isMe && <button onClick={() => sendNudge(m)} className="nudge-btn">🔔</button>}
                          </div>
                          <MiniTimerRing status={m.timer_status} secondsLeft={m.seconds_left} isZen={m.is_zen} />
                          {currentTrack && <div className="zen-track-info">🎵 {currentTrack.name}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* CENTER — Shared Tasks */}
            {showTasksMobile && (
              <div 
                className="mobile-overlay-backdrop"
                onClick={() => setShowTasksMobile(false)}
              />
            )}
            <div className={`room-panel room-panel--tasks ${showTasksMobile ? 'mobile-visible' : ''}`}>
              <div className="panel-header-v2">
                <div className="flex items-center gap-2">
                  <span className="header-title">Shared Tasks</span>
                  <span className="header-count">{incompletes.length}</span>
                </div>
                <button 
                  className="mobile-close-btn" 
                  onClick={() => setShowTasksMobile(false)}
                >
                  ✕
                </button>
              </div>
              
              <div className="task-input-section">
                <div className="room-task-input-container">
                  <input
                    type="text"
                    value={newTask}
                    onChange={e => setNewTask(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTask()}
                    placeholder="Add a focus task..."
                    className="room-task-input"
                  />
                  <button onClick={addTask} disabled={addingTask || !newTask.trim()} className="room-task-add-btn">
                    +
                  </button>
                </div>
              </div>

              <div className="tasks-scroll-area">
                {tasks.length === 0 ? (
                  <div className="room-tasks-empty">
                    <div className="room-tasks-empty-icon">📝</div>
                    <p className="empty-text-main">No shared tasks yet</p>
                    <p className="empty-text-sub">Collaborate and stay focused together</p>
                  </div>
                ) : (
                  <>
                    {incompletes.map(task => (
                      <div key={task.id} className="room-task-item group">
                        <button className="room-task-check" onClick={() => toggleTask(task)} />
                        <span className="room-task-title">{task.title}</span>
                        <button onClick={() => deleteTask(task.id)} className="room-task-delete">✕</button>
                      </div>
                    ))}
                    
                    {completes.length > 0 && (
                      <>
                        <div className="room-tasks-divider">Completed ({completes.length})</div>
                        {completes.map(task => (
                          <div key={task.id} className="room-task-item room-task-item--done">
                            <button className="room-task-check room-task-check--done" onClick={() => toggleTask(task)}>✓</button>
                            <span className="room-task-title">{task.title}</span>
                            <button onClick={() => deleteTask(task.id)} className="room-task-delete">✕</button>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* RIGHT — Chat */}
            <div className="room-panel room-panel--chat">
              <div className="room-panel-header">
                <div className="flex items-center gap-2">
                  <span className="live-dot" />
                  <span className="font-serif italic text-muted">Live Chat</span>
                </div>
              </div>
              
              <div className="chat-messages-container">

                {messages.length === 0 && (
                  <div className="chat-empty-state">
                    <div className="chat-empty-icon">💬</div>
                    <p className="chat-empty-text">No messages yet</p>
                    <p className="chat-empty-subtext">Be the first to say something to your study group!</p>
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
                    <div key={msg.id} className={`chat-msg-row ${isMe ? 'chat-msg-row--you' : ''}`}>
                      <div className="chat-msg-avatar-wrap">
                        {showName && (
                          <div className="chat-msg-avatar">
                            {arche.emoji}
                          </div>
                        )}
                      </div>
                      <div className="chat-msg-content">
                        {showName && (
                          <span className="chat-msg-author">
                            {isMe ? 'You' : msg.display_name}
                          </span>
                        )}
                        <div className="chat-msg-bubble">
                          {msg.text}
                        </div>
                        {timeStr && <span className="chat-msg-time">{timeStr}</span>}
                      </div>
                    </div>
                  )
                })}
                {typingUsers.length > 0 && (
                  <div className="chat-typing-indicator">
                    <div className="typing-dots-bubble">
                      <span className="typing-dot" />
                      <span className="typing-dot" style={{ animationDelay: '0.2s' }} />
                      <span className="typing-dot" style={{ animationDelay: '0.4s' }} />
                    </div>
                    <span className="typing-text">{typingUsers.join(', ')} typing…</span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>
              {/* Input area area — pinned at bottom */}
              <div className="chat-input-area">
                <div className="chat-input-wrapper">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={handleChatInput}
                    onKeyDown={e => e.key === 'Enter' && sendChat()}
                    placeholder="Say something…"
                    className="chat-input-field"
                  />
                  <button
                    onClick={sendChat}
                    disabled={!chatInput.trim()}
                    className={`chat-send-btn-new ${chatInput.trim() ? 'active' : ''}`}
                  >
                    <span>Send</span>
                    <span className="ml-1">→</span>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* FIXED BOTTOM ACTION — Whiteboard */}
      <button 
        onClick={() => setShowWhiteboard(true)}
        className="whiteboard-btn-bottom"
      >
        <span className="icon">🎨</span>
        <span className="text">Collaboration Board</span>
      </button>

      {/* Mobile Tasks Toggle FAB (Hidden on Desktop via CSS) */}
      <button 
        className="mobile-tasks-toggle-btn"
        onClick={() => setShowTasksMobile(true)}
      >
        <span className="icon">📝</span> Tasks 
        {incompletes.length > 0 && <span className="mobile-tasks-badge">{incompletes.length}</span>}
      </button>

      {showWhiteboard && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
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
