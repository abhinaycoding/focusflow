import React, { useState, useEffect, useRef } from 'react'
import { db } from '../lib/firebase'
import {
  collection, query, where, getDocs, onSnapshot,
  addDoc, setDoc, doc, getDoc, serverTimestamp, orderBy
} from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { usePlan } from '../contexts/PlanContext'
import './DirectMessages.css'

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic conversation ID: sorted alphabetically so both participants
// always produce the same key: "lowerUid_higherUid"
// ─────────────────────────────────────────────────────────────────────────────
const getConvoId = (uid1, uid2) => [uid1, uid2].sort().join('_')

const DirectMessages = ({ isOpen, onClose, onUnreadChange, initialFriend }) => {
  const { user, profile } = useAuth()
  const { isPro } = usePlan()

  const [friends, setFriends]               = useState([])
  const [unreadDMs, setUnreadDMs]           = useState(new Set()) // Set of convoIds with unread
  const [lastMsgMap, setLastMsgMap]         = useState({})        // uid → {text, time, fromMe}
  const [selectedFriend, setSelectedFriend] = useState(null)
  const [messages, setMessages]             = useState([])
  const [newMsg, setNewMsg]                 = useState('')
  const [sending, setSending]               = useState(false)
  const [isFriendTyping, setIsFriendTyping] = useState(false)

  const messagesEndRef   = useRef(null)
  const unsubMsgsRef     = useRef(null)
  const unsubConvoRef    = useRef(null)
  const typingTimeoutRef = useRef(null)
  const fileInputRef     = useRef(null)

  // ── Auto-select a friend passed in from PeopleSearch ──────────────────────
  useEffect(() => {
    if (isOpen && initialFriend && initialFriend.uid !== selectedFriend?.uid) {
      setSelectedFriend(initialFriend)
    }
  }, [isOpen, initialFriend])

  // ─────────────────────────────────────────────────────────────────────────
  // CONVERSATION LIST (Instagram-style)
  //
  // HOW IT WORKS:
  //   • We listen to /profiles/{myUid}/unread_dms — this subcollection
  //     gets a document written by the SENDER every time they message us.
  //     That document has the convoId as its ID, so we know who messaged us
  //     without ever needing to query the top-level dms collection.
  //   • We also load accepted friend UIDs so friends appear even before
  //     the first message.
  //   • Both sources are merged, deduplicated and sorted by recency.
  //
  // WHY NOT QUERY /dms DIRECTLY:
  //   Firestore collection-level list rules don't work well with regex on
  //   document IDs — permission-denied errors occur on old docs. Using a
  //   user-owned subcollection (/profiles/{uid}/unread_dms) sidesteps this
  //   and has always been correctly secured.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid || !isOpen) return
    let active = true

    const unsubUnread = onSnapshot(
      collection(db, 'profiles', user.uid, 'unread_dms'),
      async (snap) => {
        // ── 1. Track unread badges ──────────────────────────────────────────
        const unreadConvoIds = snap.docs.filter(d => d.data().unread).map(d => d.id)
        setUnreadDMs(new Set(unreadConvoIds))
        if (onUnreadChange) onUnreadChange(unreadConvoIds.length > 0)

        // ── 2. Extract the other user's UID from each convoId in unread_dms ─
        // convoId = "uid1_uid2" (alphabetically sorted). Since Firebase UIDs
        // never contain underscores, splitting by '_' gives exactly two UIDs.
        const timeMap = {}   // uid → last activity timestamp (ms)
        const recentUids = []
        snap.docs.forEach(d => {
          const parts    = d.id.split('_')
          const otherUid = parts.find(p => p !== user.uid)
          if (otherUid) {
            recentUids.push(otherUid)
            const data = d.data()
            timeMap[otherUid] =
              data.last_message_time?.toMillis?.() ||
              data.touched?.toMillis?.() ||
              1
          }
        })

        try {
          // ── 3. Also get accepted friend UIDs (so they show before any chat) ─
          const [s1, s2, s3, s4] = await Promise.all([
            getDocs(query(collection(db, 'friend_requests'), where('from_uid', '==', user.uid), where('status', '==', 'accepted'))),
            getDocs(query(collection(db, 'friend_requests'), where('to_uid',   '==', user.uid), where('status', '==', 'accepted'))),
            getDocs(query(collection(db, 'friend_requests'), where('from',     '==', user.uid), where('status', '==', 'accepted'))),
            getDocs(query(collection(db, 'friend_requests'), where('to',       '==', user.uid), where('status', '==', 'accepted'))),
          ])

          const friendIds = [
            ...s1.docs.map(d => d.data().to_uid   || d.id.split('_').find(id => id !== user.uid)),
            ...s2.docs.map(d => d.data().from_uid  || d.id.split('_').find(id => id !== user.uid)),
            ...s3.docs.map(d => d.data().to        || d.id.split('_').find(id => id !== user.uid)),
            ...s4.docs.map(d => d.data().from      || d.id.split('_').find(id => id !== user.uid)),
          ].filter(id => !!id && id !== user.uid)

          // ── 4. Merge both sources: recent chats first, then friends ────────
          const allUids = [...new Set([...recentUids, ...friendIds])]
          if (!active) return
          if (allUids.length === 0) { setFriends([]); return }

          // ── 5. Fetch profiles ───────────────────────────────────────────────
          const profileSnaps = await Promise.all(
            allUids.map(uid => getDoc(doc(db, 'profiles', uid)))
          )
          let loadedFriends = profileSnaps
            .filter(s => s.exists())
            .map(s => ({ uid: s.id, ...s.data() }))

          // Sort: most recent conversation first, then alphabetically
          loadedFriends.sort((a, b) =>
            (timeMap[b.uid] || 0) - (timeMap[a.uid] || 0) ||
            (a.full_name?.localeCompare(b.full_name) ?? 0)
          )
          if (active) setFriends(loadedFriends)

          // ── 6. Fetch last-message preview for sidebar ──────────────────────
          const msgPreviews = {}
          await Promise.all(recentUids.map(async (otherUid) => {
            const convoId = getConvoId(user.uid, otherUid)
            try {
              const snap = await getDocs(
                query(collection(db, 'dms', convoId, 'messages'), orderBy('timestamp', 'desc'))
              )
              if (!snap.empty) {
                const msg = snap.docs[0].data()
                msgPreviews[otherUid] = {
                  text:   msg.image_url ? '📷 Image' : (msg.text || ''),
                  time:   msg.timestamp?.toMillis?.() || 0,
                  fromMe: msg.from === user.uid,
                }
              }
            } catch (_) {}
          }))
          if (active) setLastMsgMap(msgPreviews)

        } catch (err) {
          console.warn('DM: sidebar load error —', err.message)
        }
      },
      (err) => console.warn('DM: unread_dms listener error —', err.message)
    )

    return () => { active = false; unsubUnread() }
  }, [user?.uid, isOpen, onUnreadChange])

  // ─────────────────────────────────────────────────────────────────────────
  // OPEN A CONVERSATION
  //
  // ⚡ KEY FIX: No orderBy in the messages query.
  //    Firestore silently drops documents where timestamp is still null
  //    (pending serverTimestamp resolution). We sort on the client instead
  //    so freshly sent & freshly received messages are always visible.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedFriend || !user?.uid) return

    if (unsubMsgsRef.current)  unsubMsgsRef.current()
    if (unsubConvoRef.current) unsubConvoRef.current()

    const convoId = getConvoId(user.uid, selectedFriend.uid)

    // Mark as read when opened
    if (isOpen) {
      setDoc(
        doc(db, 'profiles', user.uid, 'unread_dms', convoId),
        { unread: false, touched: serverTimestamp() },
        { merge: true }
      ).catch(() => {})
    }

    // Real-time message listener (no server-side orderBy → sort on client)
    unsubMsgsRef.current = onSnapshot(
      collection(db, 'dms', convoId, 'messages'),
      (snap) => {
        const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        // Pending timestamps sort to "now" → appear at the bottom, not invisible
        msgs.sort((a, b) => {
          const ta = a.timestamp?.toMillis?.() ?? Date.now()
          const tb = b.timestamp?.toMillis?.() ?? Date.now()
          return ta - tb
        })
        setMessages(msgs)
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

        // Auto-clear unread badge while this chat is actively open
        if (isOpen) {
          setDoc(
            doc(db, 'profiles', user.uid, 'unread_dms', convoId),
            { unread: false },
            { merge: true }
          ).catch(() => {})
        }
      },
      (err) => console.warn('DM: messages error —', err.message)
    )

    // Typing indicator listener
    unsubConvoRef.current = onSnapshot(doc(db, 'dms', convoId), snap => {
      setIsFriendTyping(snap.exists() ? !!snap.data()[`typing_${selectedFriend.uid}`] : false)
    })

    return () => {
      if (unsubMsgsRef.current)  unsubMsgsRef.current()
      if (unsubConvoRef.current) unsubConvoRef.current()
    }
  }, [selectedFriend, user?.uid, isOpen])

  // ─────────────────────────────────────────────────────────────────────────
  // SEND A TEXT MESSAGE
  //
  // After writing the message, we write metadata to BOTH participants'
  // unread_dms subcollections so the conversation appears in BOTH inboxes
  // immediately — this is the core of the "Instagram-style" behaviour.
  // ─────────────────────────────────────────────────────────────────────────
  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMsg.trim() || !selectedFriend || sending) return
    setSending(true)
    try {
      const convoId = getConvoId(user.uid, selectedFriend.uid)

      // Clear typing indicator first
      setDoc(doc(db, 'dms', convoId), { [`typing_${user.uid}`]: false }, { merge: true }).catch(() => {})

      // Write the message
      await addDoc(collection(db, 'dms', convoId, 'messages'), {
        from:      user.uid,
        fromName:  profile?.full_name || 'Scholar',
        text:      newMsg.trim(),
        timestamp: serverTimestamp(),
      })

      // ↓ Recipient sees this conversation in THEIR inbox immediately
      await setDoc(
        doc(db, 'profiles', selectedFriend.uid, 'unread_dms', convoId),
        { unread: true, last_message_time: serverTimestamp() },
        { merge: true }
      ).catch(err => console.warn('DM: notify recipient error —', err.message))

      // ↓ Keep my own inbox entry fresh (sorted by recency)
      await setDoc(
        doc(db, 'profiles', user.uid, 'unread_dms', convoId),
        { unread: false, last_message_time: serverTimestamp() },
        { merge: true }
      ).catch(err => console.warn('DM: pin to sidebar error —', err.message))

      setNewMsg('')
    } catch (err) {
      console.warn('DM: send error —', err.message)
    } finally {
      setSending(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SEND AN IMAGE (Pro gated)
  // ─────────────────────────────────────────────────────────────────────────
  const handleImageClick = () => {
    if (!isPro) { alert('Image sharing is a Pro feature! Please upgrade.'); return }
    fileInputRef.current?.click()
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('Image must be smaller than 2MB'); return }
    setSending(true)
    try {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const convoId = getConvoId(user.uid, selectedFriend.uid)
        await addDoc(collection(db, 'dms', convoId, 'messages'), {
          from: user.uid, fromName: profile?.full_name || 'Scholar',
          text: '', image_url: reader.result, timestamp: serverTimestamp(),
        })
        await setDoc(doc(db, 'profiles', selectedFriend.uid, 'unread_dms', convoId),
          { unread: true, last_message_time: serverTimestamp() }, { merge: true }).catch(() => {})
        await setDoc(doc(db, 'profiles', user.uid, 'unread_dms', convoId),
          { unread: false, last_message_time: serverTimestamp() }, { merge: true }).catch(() => {})
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.warn('DM: image upload failed —', err.message)
    } finally {
      setSending(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TYPING INDICATOR (debounced 2s)
  // ─────────────────────────────────────────────────────────────────────────
  const handleInputChange = (e) => {
    setNewMsg(e.target.value)
    if (!selectedFriend || !user) return
    const convoId = getConvoId(user.uid, selectedFriend.uid)
    setDoc(doc(db, 'dms', convoId), { [`typing_${user.uid}`]: true }, { merge: true }).catch(() => {})
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      setDoc(doc(db, 'dms', convoId), { [`typing_${user.uid}`]: false }, { merge: true }).catch(() => {})
    }, 2000)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UTILITIES
  // ─────────────────────────────────────────────────────────────────────────
  const isOnline = (ts) => {
    if (!ts) return false
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return Date.now() - d.getTime() < 3 * 60 * 1000
  }

  const timeLabel = (ms) => {
    if (!ms) return ''
    const d = new Date(ms)
    const diffH = (Date.now() - d) / 3600000
    return diffH < 24
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  if (!isOpen) return null

  return (
    <>
      <div className="dm-backdrop" onClick={onClose} />
      <div className="dm-panel">
        <div className="dm-panel-inner">

          {/* ── Left: conversation list ── */}
          <div className="dm-friends-list">
            <div className="dm-panel-header">
              <span>💬 Messages</span>
              <button className="dm-close-btn" onClick={onClose}>×</button>
            </div>

            <div className="dm-friends-scroll">
              {friends.length === 0 ? (
                <div className="dm-empty">
                  <span>💬</span>
                  <p>No conversations yet.<br />Use the 👥 button to find people!</p>
                </div>
              ) : (
                friends.map(f => {
                  const convoId  = getConvoId(user.uid, f.uid)
                  const isUnread = unreadDMs.has(convoId)
                  const preview  = lastMsgMap[f.uid]
                  const isActive = selectedFriend?.uid === f.uid

                  return (
                    <button
                      key={f.uid}
                      className={`dm-chat-row ${isActive ? 'dm-chat-row-active' : ''} ${isUnread ? 'dm-chat-row-unread' : ''}`}
                      onClick={() => setSelectedFriend(f)}
                    >
                      <div className="dm-chat-row-avatar">
                        {f.photo_url
                          ? <img src={f.photo_url} alt={f.full_name} />
                          : <span>{f.avatar_emoji || f.full_name?.[0]?.toUpperCase() || '?'}</span>
                        }
                        {isOnline(f.last_active) && <span className="dm-online-dot" />}
                      </div>
                      <div className="dm-chat-row-info">
                        <div className="dm-chat-row-top">
                          <span className="dm-chat-row-name">{f.full_name || 'Scholar'}</span>
                          {preview?.time ? <span className="dm-chat-row-time">{timeLabel(preview.time)}</span> : null}
                        </div>
                        <div className="dm-chat-row-preview">
                          {preview ? (
                            <span className={isUnread ? 'dm-preview-bold' : ''}>
                              {preview.fromMe ? 'You: ' : ''}{preview.text}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No messages yet</span>
                          )}
                          {isUnread && <span className="dm-chat-unread-dot" />}
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* ── Right: active chat ── */}
          <div className="dm-chat-area">
            {!selectedFriend ? (
              <div className="dm-chat-placeholder">
                <span>👈</span>
                <p>Select a conversation to start chatting</p>
              </div>
            ) : (
              <>
                <div className="dm-chat-header">
                  <div className="dm-friend-avatar sm">
                    {selectedFriend.photo_url
                      ? <img src={selectedFriend.photo_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      : (selectedFriend.avatar_emoji || selectedFriend.full_name?.[0]?.toUpperCase())
                    }
                    {isOnline(selectedFriend.last_active) && <span className="dm-online-dot sm" />}
                  </div>
                  <span className="dm-chat-name">{selectedFriend.full_name}</span>
                </div>

                <div className="dm-messages">
                  {messages.length === 0 && <div className="dm-no-msgs">Say hi! 👋</div>}
                  {messages.map(m => (
                    <div key={m.id} className={`dm-msg ${m.from === user.uid ? 'dm-msg-me' : 'dm-msg-them'}`}>
                      {m.image_url && <img src={m.image_url} alt="Shared" className="dm-msg-img" />}
                      {m.text && <div className="dm-msg-bubble">{m.text}</div>}
                    </div>
                  ))}
                  {isFriendTyping && (
                    <div className="dm-typing-indicator">
                      <span /><span /><span />
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form className="dm-input-row" onSubmit={sendMessage}>
                  <button type="button" className="dm-attach-btn" onClick={handleImageClick} title={isPro ? 'Send Image' : 'Image Sharing (Pro)'}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                    </svg>
                    {!isPro && (
                      <div className="dm-pro-lock">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM8.9 6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2H8.9V6zM18 20H6V10h12v10z"/>
                        </svg>
                      </div>
                    )}
                  </button>
                  <input type="file" accept="image/*" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImageUpload} />

                  <input
                    className="dm-input"
                    placeholder="Type a message..."
                    value={newMsg}
                    onChange={handleInputChange}
                    disabled={sending}
                    autoFocus
                  />
                  <button type="submit" className="dm-send-btn" disabled={!newMsg.trim() || sending}>
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default DirectMessages
