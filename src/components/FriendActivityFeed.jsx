import React, { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import { collection, query, where, getDocs, getDoc, doc, onSnapshot, orderBy, limit } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import './FriendActivityFeed.css'

const timeAgo = (timestamp) => {
  if (!timestamp) return ''
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp)
  const diff = (Date.now() - date.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

const FriendActivityFeed = () => {
  const { user } = useAuth()
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) return

    const fetchActivities = async (friendIds) => {
      if (friendIds.length === 0) {
        setActivities([])
        setLoading(false)
        return
      }

      try {
        console.log('[FriendFeed] Fetching profiles for:', friendIds)
        const profileMap = {}
        try {
          const profileDocs = await Promise.all(
            friendIds.map(uid => getDoc(doc(db, 'profiles', uid)))
          )
          profileDocs.forEach(d => { if (d.exists()) profileMap[d.id] = d.data() })
        } catch (pErr) {
          console.error('[FriendFeed] Profile fetch failed:', pErr.message)
          throw pErr // rethrow to be caught by the outer catch
        }

        const all = []
        const chunks = []
        for (let i = 0; i < friendIds.length; i += 10) chunks.push(friendIds.slice(i, i + 10))

        for (const chunk of chunks) {
          console.log('[FriendFeed] Querying activities for chunk:', chunk)
          try {
            const snap = await getDocs(query(
              collection(db, 'activities'),
              where('user_id', 'in', chunk),
              // orderBy('created_at', 'desc'),
              limit(20)
            ))
            snap.docs.forEach(d => {
              const act = d.data()
              all.push({
                id:        d.id,
                userId:    act.user_id,
                name:      profileMap[act.user_id]?.full_name || 'A friend',
                photo:     profileMap[act.user_id]?.photo_url || null,
                emoji:     profileMap[act.user_id]?.avatar_emoji || null,
                action:    act.action,
                detail:    act.detail,
                timestamp: act.created_at,
                icon:      act.icon,
              })
            })
          } catch (qErr) {
            console.error('[FriendFeed] Activities query failed for chunk', chunk, ':', qErr.message)
            throw qErr
          }
        }

        all.sort((a, b) => {
          const ta = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0)
          const tb = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0)
          return tb - ta
        })

        setActivities(all.slice(0, 15))
      } catch (err) {
        console.warn('FriendFeed error:', err.message)
      } finally {
        setLoading(false)
      }
    }

    // ── Listen for friend list changes in real time ──
    const q1 = query(collection(db, 'friend_requests'), where('from', '==', user.uid), where('status', '==', 'accepted'))
    const q2 = query(collection(db, 'friend_requests'), where('to',   '==', user.uid), where('status', '==', 'accepted'))

    let sentIds = [], receivedIds = []
    const rebuild = () => {
      const ids = [...new Set([...sentIds, ...receivedIds])]
      fetchActivities(ids)
    }

    const u1 = onSnapshot(q1, snap => { 
      sentIds = snap.docs.map(d => d.data().to || d.data().to_uid).filter(Boolean);   
      rebuild() 
    }, err => console.warn('Sent Requests Listener Failed:', err.message))

    const u2 = onSnapshot(q2, snap => { 
      receivedIds = snap.docs.map(d => d.data().from || d.data().from_uid).filter(Boolean); 
      rebuild() 
    }, err => console.warn('Received Requests Listener Failed:', err.message))

    return () => { u1(); u2() }
  }, [user?.uid])

  if (loading) {
    return (
      <div className="friend-feed-card">
        <div className="friend-feed-header">
          <span className="friend-feed-title">👥 Friend Activity</span>
        </div>
        <div className="friend-feed-loading">
          <div className="feed-skeleton" />
          <div className="feed-skeleton short" />
          <div className="feed-skeleton" />
        </div>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="friend-feed-card">
        <div className="friend-feed-header">
          <span className="friend-feed-title">👥 Friend Activity</span>
        </div>
        <div className="friend-feed-empty">
          <span className="feed-empty-icon">🤝</span>
          <p>Add friends to see their activity here!</p>
          <p className="feed-empty-sub">Visit your Profile to send friend requests.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="friend-feed-card">
      <div className="friend-feed-header">
        <span className="friend-feed-title">👥 Friend Activity</span>
        <span className="friend-feed-count">{activities.length} recent</span>
      </div>
      <div className="friend-feed-list">
        {activities.map((act, i) => (
          <div key={act.id + i} className="feed-item">
            <div className="feed-item-avatar">
              {act.photo ? (
                <img src={act.photo} alt={act.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              ) : (
                act.emoji || act.name?.[0]?.toUpperCase() || '?'
              )}
            </div>
            <div className="feed-item-body">
              <span className="feed-item-name">{act.name.split(' ')[0]}</span>
              <span className="feed-item-action"> {act.action}</span>
              {act.detail && <span className="feed-item-detail"> · {act.detail}</span>}
            </div>
            <div className="feed-item-meta">
              <span className="feed-item-emoji">{act.emoji}</span>
              <span className="feed-item-time">{timeAgo(act.timestamp)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default FriendActivityFeed
