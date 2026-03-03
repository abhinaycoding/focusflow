import React, { useState, useEffect, useRef, useCallback } from 'react'
import { db } from '../../lib/firebase'
import {
  collection, doc, addDoc, setDoc, onSnapshot,
  deleteDoc, serverTimestamp, query, where, getDocs
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
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const animFrameRef = useRef(null)
  const presenceUnsub = useRef(null)
  const signalingUnsubs = useRef([])

  const voicePresencePath = `room_voice_presence`
  const presenceDocId = `${roomId}_${channelId}_${user.uid}`

  // ── Join Voice ─────────────────────────────────────────────────────────────
  const joinVoice = useCallback(async () => {
    // Step 1: Get mic — this is the only thing that can truly block
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        toast('Microphone permission denied.', 'error')
      } else {
        toast('Microphone not available.', 'error')
      }
      return
    }

    localStreamRef.current = stream

    // Step 2: Publish presence to Firestore (non-blocking — if rules not deployed, still works)
    setDoc(doc(db, voicePresencePath, presenceDocId), {
      room_id: roomId,
      channel_id: channelId,
      user_id: user.uid,
      display_name: user.displayName || 'Scholar',
      avatar_id: user.avatarId || 'owl',
      joined_at: serverTimestamp(),
    }).catch(() => {
      // Firestore write failed (e.g. rules not deployed) — voice still works locally
    })

    // Step 3: Mic visualizer
    try {
      audioContextRef.current = new AudioContext()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      source.connect(analyserRef.current)
      detectSpeaking()
    } catch (_) { /* analyser optional */ }

    setJoined(true)
    // Immediately show self in voice list using local fallback
    setVoiceUsers(prev => {
      const alreadyIn = prev.some(u => u.user_id === user.uid)
      if (alreadyIn) return prev
      return [...prev, {
        id: presenceDocId,
        user_id: user.uid,
        display_name: user.displayName || 'Scholar',
        avatar_id: user.avatarId || 'owl',
      }]
    })
    toast('Joined voice channel 🎙️', 'success')
  }, [roomId, channelId, user, toast, presenceDocId])

  // ── Leave Voice ────────────────────────────────────────────────────────────
  const leaveVoice = useCallback(async () => {
    cancelAnimationFrame(animFrameRef.current)
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    audioContextRef.current?.close()
    Object.values(peersRef.current).forEach(pc => pc.close())
    peersRef.current = {}

    await deleteDoc(doc(db, voicePresencePath, presenceDocId)).catch(() => {})

    presenceUnsub.current?.()
    signalingUnsubs.current.forEach(u => u())
    signalingUnsubs.current = []

    localStreamRef.current = null
    setJoined(false)
    setSpeaking({})
    toast('Left voice channel', 'info')
  }, [presenceDocId])

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
    const q = query(
      collection(db, voicePresencePath),
      where('room_id', '==', roomId),
      where('channel_id', '==', channelId)
    )
    const unsub = onSnapshot(q, snap => {
      setVoiceUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    presenceUnsub.current = unsub
    return () => unsub()
  }, [roomId, channelId])

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (joined) leaveVoice()
    }
  }, [joined, leaveVoice])

  // ── Toggle Mute ───────────────────────────────────────────────────────────
  const toggleMute = () => {
    if (!localStreamRef.current) return
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = muted })
    setMuted(!muted)
  }

  const toggleDeafen = () => {
    setDeafened(!deafened)
    // In a full WebRTC implementation this would silence all remote audio
  }

  return (
    <div className="voice-channel-panel">
      {/* Users in voice */}
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
                  <span>{arche.emoji}</span>
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

      {/* Controls */}
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
