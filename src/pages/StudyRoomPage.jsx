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
  const [showWhiteboard, setShowWhiteboard] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [activeEmotes, setActiveEmotes] = useState([])
  const [groupMomentum, setGroupMomentum] = useState(0)
  const chatBottomRef = useRef(null)
  const channelRef = useRef(null)

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

  // 4. Chat Messages
  useEffect(() => {
    if (!roomId) return
    const q = query(
      collection(db, 'room_messages'), 
      where('room_id', '==', roomId)
    )
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => {
        const da = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at)
        const db = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at)
        return da - db
      }).slice(-50))
    })
    return () => unsubscribe()
  }, [roomId])

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
    try {
      await addDoc(collection(db, 'room_messages'), {
        room_id: roomId,
        user_id: user.uid,
        display_name: displayName,
        text,
        created_at: serverTimestamp(),
      })
    } catch (err) {
      console.error(err)
    }
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

            {/* CENTER — Shared Tasks */}
            <div className="room-panel room-panel--tasks flex flex-col h-full border-r border-ink">
              <div className="p-4 border-b border-ink font-serif italic text-muted">Shared Tasks</div>
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
            <div className="room-panel room-panel--chat flex flex-col h-full">
               <div className="p-4 border-b border-ink font-serif italic text-muted">Live Chat</div>
               <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.map(msg => {
                    const isMe = msg.user_id === guestId
                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <span className="text-[10px] text-muted mb-1">{msg.display_name}</span>
                        <div className={`px-3 py-1.5 rounded-2xl text-sm max-w-[80%] ${isMe ? 'bg-primary text-white rounded-tr-none' : 'bg-ink/30 text-primary rounded-tl-none'}`}>
                          {msg.text}
                        </div>
                      </div>
                    )
                  })}
                  <div ref={chatBottomRef} />
               </div>
               <div className="p-4 border-t border-ink bg-ink/5">
                 <div className="flex gap-2 mb-3 justify-center">
                   {EMOTES.map(emoji => (
                     <button key={emoji} onClick={() => broadcastEmote(emoji)} className="text-lg hover:scale-125 transition-transform">{emoji}</button>
                   ))}
                 </div>
                 <div className="flex gap-2 bg-black/20 rounded-full px-3 py-1 border border-ink">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendChat()}
                      placeholder="Say something..."
                      className="flex-1 bg-transparent border-none outline-none text-sm text-primary py-1"
                    />
                    <button onClick={sendChat} disabled={!chatInput.trim()} className="text-primary text-xs font-bold">SEND</button>
                 </div>
               </div>
            </div>

          </div>
        </main>
      </div>

      {showWhiteboard && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full h-full max-w-6xl bg-bg-card rounded-2xl border border-ink overflow-hidden flex flex-col">
              <SharedWhiteboard 
                channel={channelRef.current} 
                user={{ id: guestId, ...guestProfile }} 
                onClose={() => setShowWhiteboard(false)} 
              />
            </div>
        </div>
      )}
    </>
  )
}

export default StudyRoomPage
