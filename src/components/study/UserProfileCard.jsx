import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { db } from '../../lib/firebase'
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore'
import { useAuth } from '../../contexts/AuthContext'
import { getArchetype } from '../../constants/archetypes'
import './UserProfileCard.css'

// Friend Status: 'none' | 'pending_sent' | 'pending_received' | 'friends'
const UserProfileCard = ({ userId, displayName, photoUrl, avatarId, onClose }) => {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [friendStatus, setFriendStatus] = useState('none')
  const [requestDocId, setRequestDocId] = useState(null)
  const [friendActionLoading, setFriendActionLoading] = useState(false)

  const isSelf = user?.uid === userId

  useEffect(() => {
    if (!userId) return
    const fetchAll = async () => {
      try {
        // Fetch profile
        const q = query(collection(db, 'profiles'), where('user_id', '==', userId))
        const snap = await getDocs(q)
        if (!snap.empty) setProfile({ id: snap.docs[0].id, ...snap.docs[0].data() })

        // Fetch friend request status
        if (!isSelf && user?.uid) {
          // Check if I sent a request
          const sentQ = query(
            collection(db, 'friend_requests'),
            where('from_uid', '==', user.uid),
            where('to_uid', '==', userId)
          )
          const sentSnap = await getDocs(sentQ)
          if (!sentSnap.empty) {
            const reqData = sentSnap.docs[0].data()
            setRequestDocId(sentSnap.docs[0].id)
            setFriendStatus(reqData.status === 'accepted' ? 'friends' : 'pending_sent')
            setLoading(false)
            return
          }
          // Check if they sent me a request
          const receivedQ = query(
            collection(db, 'friend_requests'),
            where('from_uid', '==', userId),
            where('to_uid', '==', user.uid)
          )
          const receivedSnap = await getDocs(receivedQ)
          if (!receivedSnap.empty) {
            const reqData = receivedSnap.docs[0].data()
            setRequestDocId(receivedSnap.docs[0].id)
            setFriendStatus(reqData.status === 'accepted' ? 'friends' : 'pending_received')
          }
        }
      } catch (err) {
        console.warn('Could not load profile:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [userId, user?.uid, isSelf])

  const sendFriendRequest = async () => {
    if (!user?.uid || friendActionLoading) return
    setFriendActionLoading(true)
    try {
      const docRef = await addDoc(collection(db, 'friend_requests'), {
        from_uid: user.uid,
        to_uid: userId,
        status: 'pending',
        created_at: serverTimestamp()
      })
      setRequestDocId(docRef.id)
      setFriendStatus('pending_sent')
    } catch (err) { console.error(err) }
    setFriendActionLoading(false)
  }

  const acceptFriendRequest = async () => {
    if (!requestDocId || friendActionLoading) return
    setFriendActionLoading(true)
    try {
      await updateDoc(doc(db, 'friend_requests', requestDocId), { status: 'accepted' })
      setFriendStatus('friends')
    } catch (err) { console.error(err) }
    setFriendActionLoading(false)
  }

  const removeFriend = async () => {
    if (!requestDocId || friendActionLoading) return
    setFriendActionLoading(true)
    try {
      await deleteDoc(doc(db, 'friend_requests', requestDocId))
      setFriendStatus('none')
      setRequestDocId(null)
    } catch (err) { console.error(err) }
    setFriendActionLoading(false)
  }

  const arche = getArchetype(profile?.avatar_id || avatarId || 'owl')
  const photo = profile?.photo_url || photoUrl
  const name = profile?.full_name || displayName || 'Scholar'
  const banner = profile?.banner_color || '#1e293b'

  const FriendButton = () => {
    if (isSelf) return null
    if (friendStatus === 'friends') return (
      <button className="upc-friend-btn upc-friend-btn--friends" onClick={removeFriend} disabled={friendActionLoading}>
        ✓ Friends
        <span className="upc-friend-btn-hover">Unfriend</span>
      </button>
    )
    if (friendStatus === 'pending_sent') return (
      <button className="upc-friend-btn upc-friend-btn--pending" onClick={removeFriend} disabled={friendActionLoading}>
        ⏳ Pending...
        <span className="upc-friend-btn-hover">Cancel</span>
      </button>
    )
    if (friendStatus === 'pending_received') return (
      <div className="upc-friend-incoming">
        <span className="upc-friend-label">Wants to be your friend!</span>
        <div className="upc-friend-actions">
          <button className="upc-friend-btn upc-friend-btn--accept" onClick={acceptFriendRequest} disabled={friendActionLoading}>✓ Accept</button>
          <button className="upc-friend-btn upc-friend-btn--decline" onClick={removeFriend} disabled={friendActionLoading}>✕ Decline</button>
        </div>
      </div>
    )
    return (
      <button className="upc-friend-btn upc-friend-btn--add" onClick={sendFriendRequest} disabled={friendActionLoading}>
        {friendActionLoading ? '...' : '+ Add Friend'}
      </button>
    )
  }

  return createPortal(
    <div className="upc-overlay" onClick={onClose}>
      <div className="upc-card" onClick={e => e.stopPropagation()}>
        {/* Banner */}
        <div
          className="upc-banner"
          style={{
            background: banner.startsWith('#')
              ? `linear-gradient(135deg, ${banner}, color-mix(in srgb, ${banner} 60%, #000))`
              : banner
          }}
        />

        {/* Close */}
        <button className="upc-close" onClick={onClose}>✕</button>

        {/* Avatar */}
        <div className="upc-avatar-wrap">
          <div className="upc-avatar">
            {photo ? (
              <img src={photo} alt="Avatar" />
            ) : (
              <span>{arche.emoji}</span>
            )}
          </div>
          {profile?.status_emoji && (
            <span className="upc-status-badge">{profile.status_emoji}</span>
          )}
        </div>

        <div className="upc-body">
          <div className="upc-name-row">
            <h2 className="upc-name">{name}</h2>
            {profile?.rank_title && (
              <span className="upc-rank">{profile.rank_title}</span>
            )}
          </div>

          <FriendButton />

          {loading && (
            <div className="upc-loading">
              <div className="upc-skeleton" style={{ width: '70%', height: '12px' }} />
              <div className="upc-skeleton" style={{ width: '55%', height: '12px' }} />
            </div>
          )}

          {!loading && (
            <>
              {profile?.status_text && (
                <div className="upc-section">
                  <div className="upc-label">STATUS</div>
                  <div className="upc-value">{profile.status_text}</div>
                </div>
              )}

              {profile?.bio && (
                <div className="upc-section">
                  <div className="upc-label">ABOUT ME</div>
                  <div className="upc-value">{profile.bio}</div>
                </div>
              )}

              {profile?.anthem && (
                <div className="upc-section">
                  <div className="upc-label">🎵 STUDY ANTHEM</div>
                  <a
                    href={profile.anthem}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="upc-anthem-link"
                  >
                    {profile.anthem.replace(/https?:\/\/(www\.)?/, '').slice(0, 45)}
                    {profile.anthem.length > 45 && '...'}
                  </a>
                </div>
              )}

              {!profile?.bio && !profile?.anthem && !profile?.status_text && !isSelf && (
                <p className="upc-empty">This scholar prefers mystery. 📚</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default UserProfileCard
