import React, { useState, useEffect, useRef, useCallback } from 'react'
import { db } from '../../lib/firebase'
import {
  collection, doc, addDoc, setDoc, onSnapshot,
  deleteDoc, serverTimestamp, query, where, getDocs, orderBy
} from 'firebase/firestore'
import { useToast } from '../../contexts/ToastContext'
import { getArchetype } from '../../constants/archetypes'
import './VoiceChannel.css'

// ─── Config ─────────────────────────────────────────────────────────────────
const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }

const VoiceChannel = ({ roomId, channelId, channelName, user, members }) => {
  const toast = useToast()
  const [joined, setJoined] = useState(false)
  const [muted, setMuted] = useState(false)
  const [deafened, setDeafened] = useState(false)
  const [voiceUsers, setVoiceUsers] = useState([])   // users currently in voice
  const [speaking, setSpeaking] = useState({})        // uid -> boolean

  const localStreamRef = useRef(null)
  const peersRef = useRef({})                         // uid -> RTCPeerConnection
  const audioRefs = useRef({})                        // uid -> HTMLAudioElement
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animFrameRef = useRef(null)
  const candidateQueueRef = useRef({})                // uid -> RTCIceCandidate[]
  const presenceUnsub = useRef(null)
  const signalsUnsub = useRef(null)

  const voicePresencePath = `room_voice_presence`
  const presenceDocId = `${roomId}_${channelId}_${user.uid}`
  const signalsPath = `room_voice_signals`

  // ── WebRTC Setup for a Peer ────────────────────────────────────────────────
  const createPeer = useCallback((remoteUid) => {
    if (peersRef.current[remoteUid]) return peersRef.current[remoteUid]

    const pc = new RTCPeerConnection(ICE_SERVERS)
    peersRef.current[remoteUid] = pc

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current))
    }

    // Send ICE candidates to signaling server
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(collection(db, signalsPath), {
          room_id: roomId,
          channel_id: channelId,
          sender: user.uid,
          receiver: remoteUid,
          type: 'candidate',
          data: JSON.stringify(event.candidate),
          created_at: serverTimestamp()
        }).catch(() => {})
      }
    }

    // Receive remote tracks
    pc.ontrack = (event) => {
      const stream = event.streams[0]
      if (!audioRefs.current[remoteUid]) {
        audioRefs.current[remoteUid] = new Audio()
      }
      audioRefs.current[remoteUid].srcObject = stream
      audioRefs.current[remoteUid].autoplay = true
      audioRefs.current[remoteUid].play().catch(e => console.warn('Audio play failed', e))
    }

    return pc
  }, [roomId, channelId, user.uid])

  // Flush queued candidates once remote description is set
  const flushCandidateQueue = useCallback(async (uid, pc) => {
    if (pc && pc.remoteDescription && candidateQueueRef.current[uid]) {
      for (const c of candidateQueueRef.current[uid]) {
        await pc.addIceCandidate(c).catch(() => {})
      }
      candidateQueueRef.current[uid] = []
    }
  }, [])

  // ── Join Voice ─────────────────────────────────────────────────────────────
  const joinVoice = useCallback(async () => {
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    } catch (err) {
      toast('Microphone permission denied or not available.', 'error')
      return
    }

    localStreamRef.current = stream

    // Write presence
    setDoc(doc(db, voicePresencePath, presenceDocId), {
      room_id: roomId,
      channel_id: channelId,
      user_id: user.uid,
      display_name: user.displayName || 'Scholar',
      avatar_id: user.avatarId || 'owl',
      photo_url: user.photoUrl || null,
      joined_at: serverTimestamp(),
    }).catch(() => {})

    // Mic visualizer
    try {
      audioContextRef.current = new AudioContext()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      source.connect(analyserRef.current)
      detectSpeaking()
    } catch (_) { }

    setJoined(true)
    toast('Joined voice channel 🎙️', 'success')

    // Find who is already in the room and initiate calls (offers)
    getDocs(query(
      collection(db, voicePresencePath),
      where('room_id', '==', roomId),
      where('channel_id', '==', channelId)
    )).then(snap => {
      snap.docs.forEach(async (d) => {
        const remoteUid = d.data().user_id
        if (remoteUid !== user.uid) {
          const pc = createPeer(remoteUid)
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          
          addDoc(collection(db, signalsPath), {
            room_id: roomId,
            channel_id: channelId,
            sender: user.uid,
            receiver: remoteUid,
            type: 'offer',
            data: JSON.stringify(offer),
            created_at: serverTimestamp()
          }).catch(() => {})
        }
      })
    })

    // Listen for incoming signals (offers, answers, candidates)
    const signalsQuery = query(
      collection(db, signalsPath),
      where('room_id', '==', roomId),
      where('channel_id', '==', channelId),
      where('receiver', '==', user.uid)
    )

    signalsUnsub.current = onSnapshot(signalsQuery, snap => {
      snap.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const signal = change.doc.data()
          const sender = signal.sender
          // Payload extraction
          const payload = JSON.parse(signal.data)

          if (signal.type === 'offer') {
            const pc = createPeer(sender)
            await pc.setRemoteDescription(new RTCSessionDescription(payload))
            flushCandidateQueue(sender, pc)
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            await addDoc(collection(db, signalsPath), {
              room_id: roomId,
              channel_id: channelId,
              sender: user.uid,
              receiver: sender,
              type: 'answer',
              data: JSON.stringify(answer),
              created_at: serverTimestamp()
            }).catch(() => {})
          } else if (signal.type === 'answer') {
            const pc = peersRef.current[sender]
            if (pc) {
              await pc.setRemoteDescription(new RTCSessionDescription(payload))
              flushCandidateQueue(sender, pc)
            }
          } else if (signal.type === 'candidate') {
            const pc = peersRef.current[sender]
            const candidate = new RTCIceCandidate(payload)
            if (pc && pc.remoteDescription) {
              await pc.addIceCandidate(candidate).catch(()=> {})
            } else {
              if (!candidateQueueRef.current[sender]) candidateQueueRef.current[sender] = []
              candidateQueueRef.current[sender].push(candidate)
            }
          }

          // Delete signal only AFTER successful processing
          await deleteDoc(change.doc.ref).catch(() => {})
        }
      })
    })
  }, [roomId, channelId, user, toast, presenceDocId, createPeer, flushCandidateQueue])

  // ── Leave Voice ────────────────────────────────────────────────────────────
  const leaveVoice = useCallback(async () => {
    cancelAnimationFrame(animFrameRef.current)
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    // Guard against closing an already-closed AudioContext (InvalidStateError)
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {})
    }
    audioContextRef.current = null
    
    Object.values(peersRef.current).forEach(pc => pc.close())
    peersRef.current = {}
    
    Object.values(audioRefs.current).forEach(audio => {
      audio.pause()
      audio.srcObject = null
    })
    audioRefs.current = {}

    await deleteDoc(doc(db, voicePresencePath, presenceDocId)).catch(() => {})

    presenceUnsub.current?.()
    signalsUnsub.current?.()

    localStreamRef.current = null
    setJoined(false)
    setSpeaking({})
    toast('Left voice channel', 'info')
  }, [presenceDocId, toast])

  // ── Speaking Detector ─────────────────────────────────────────────────────
  const detectSpeaking = () => {
    const buf = new Uint8Array(analyserRef.current?.frequencyBinCount || 128)
    const tick = () => {
      analyserRef.current?.getByteFrequencyData(buf)
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length
      setSpeaking(prev => ({ ...prev, [user.uid]: avg > 10 }))
      animFrameRef.current = requestAnimationFrame(tick)
    }
    tick()
  }

  // ── Watch Presence & Update Voice Users ───────────────────────────────────
  useEffect(() => {
    let unsub = null
    try {
      const q = query(
        collection(db, voicePresencePath),
        where('room_id', '==', roomId),
        where('channel_id', '==', channelId)
      )
      unsub = onSnapshot(q, snap => {
        const users = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        // Pre-fill local user if we are joined but firestore hasn't synced
        if (joined && !users.some(u => u.user_id === user.uid)) {
          users.push({
            id: presenceDocId,
            user_id: user.uid,
            display_name: user.displayName || 'Scholar',
            avatar_id: user.avatarId || 'owl',
            photo_url: user.photoUrl || null,
          })
        }
        setVoiceUsers(users)
        
        // Clean up peers who left
        const currentUids = users.map(u => u.user_id)
        Object.keys(peersRef.current).forEach(uid => {
          if (!currentUids.includes(uid)) {
            peersRef.current[uid].close()
            delete peersRef.current[uid]
            if (audioRefs.current[uid]) {
              audioRefs.current[uid].pause()
              audioRefs.current[uid].srcObject = null
              delete audioRefs.current[uid]
            }
          }
        })
      })
      presenceUnsub.current = unsub
    } catch (_) { }
    return () => unsub?.()
  }, [roomId, channelId, joined, user, presenceDocId])

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (joined) leaveVoice()
    }
  }, [joined, leaveVoice])

  // ── Toggle Mute / Deafen ──────────────────────────────────────────────────
  const toggleMute = () => {
    if (!localStreamRef.current) return
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = muted })
    setMuted(!muted)
  }

  const toggleDeafen = () => {
    Object.values(audioRefs.current).forEach(audio => {
      audio.muted = !deafened
    })
    setDeafened(!deafened)
  }

  return (
    <div className="voice-channel-panel">
      <div className="voice-users-list">
        {voiceUsers.length === 0 ? (
          <div className="voice-empty">
            <div className="voice-empty-icon">🎙️</div>
            <p>No one in voice yet</p>
            <p className="voice-empty-sub">Be the first to join!</p>
          </div>
        ) : (
          voiceUsers.map(vu => {
            const arche = getArchetype(vu.avatar_id)
            const isTalking = speaking[vu.user_id]
            const isMe = vu.user_id === user.uid
            return (
              <div key={vu.user_id} className={`voice-user-pill ${isTalking ? 'speaking' : ''}`}>
                <div className={`voice-avatar ${isTalking ? 'speaking' : ''}`}>
                  {vu.photo_url ? (
                    <img src={vu.photo_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  ) : (
                    <span>{arche.emoji}</span>
                  )}
                  {isTalking && <div className="speaking-ring" />}
                </div>
                <div className="voice-user-info">
                  <span className="voice-user-name">{isMe ? 'You' : vu.display_name}</span>
                  {isMe && muted && <span className="voice-muted-tag">Muted</span>}
                </div>
                {isMe && muted && <span className="voice-mute-icon">🔇</span>}
              </div>
            )
          })
        )}
      </div>

      <div className="voice-controls">
        {!joined ? (
          <button className="voice-join-btn" onClick={joinVoice}>
            <span>🎙️</span>
            <span>Join Voice</span>
          </button>
        ) : (
          <div className="voice-active-controls">
            <div className="voice-status-bar">
              <div className="voice-status-dot" />
              <span className="voice-status-text">Voice Connected</span>
            </div>
            <div className="voice-btn-group">
              <button
                className={`voice-ctrl-btn ${muted ? 'active' : ''}`}
                onClick={toggleMute}
                title={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? '🔇' : '🎙️'}
              </button>
              <button
                className={`voice-ctrl-btn ${deafened ? 'active' : ''}`}
                onClick={toggleDeafen}
                title={deafened ? 'Undeafen' : 'Deafen'}
              >
                {deafened ? '🔕' : '🔊'}
              </button>
              <button
                className="voice-ctrl-btn leave"
                onClick={leaveVoice}
                title="Disconnect"
              >
                📵
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default VoiceChannel
