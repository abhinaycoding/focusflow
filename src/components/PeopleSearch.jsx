import React, { useState, useEffect, useCallback } from 'react'
import { db } from '../lib/firebase'
import {
  collection, query, where, getDocs, addDoc,
  serverTimestamp, doc, updateDoc, deleteDoc
} from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import './PeopleSearch.css'

// ─────────────────────────────────────────────────────────────────────────────
// PeopleSearch: A full "People & Friends" hub with two tabs:
//   • Discover — search for new users and send friend requests
//   • My Friends — view + accept incoming requests, see all current friends
// ─────────────────────────────────────────────────────────────────────────────
const PeopleSearch = ({ isOpen, onClose, onStartChat, onStartDuel, initialTab }) => {
  const { user, profile } = useAuth()

  const [activeTab, setActiveTab]             = useState('discover') // 'discover' | 'friends'
  const [searchQuery, setSearchQuery]         = useState('')
  const [results, setResults]                 = useState([])
  const [isSearching, setIsSearching]         = useState(false)
  const [viewingProfile, setViewingProfile]   = useState(null)

  // Keyed by the OTHER user's UID
  const [friendStatuses, setFriendStatuses]   = useState({}) // uid → 'friend' | 'pending' | 'incoming'
  // Maps uid → request document ID (needed to accept/decline)
  const [requestDocIds, setRequestDocIds]     = useState({}) // uid → docId

  // Separate lists for "My Friends" tab
  const [friendList, setFriendList]           = useState([])   // accepted friends
  const [incomingList, setIncomingList]       = useState([])   // pending received requests

  const [loadingFriends, setLoadingFriends]   = useState(false)

  // ─────────────────────────────────────────────────────────────────────────
  // Load all friend states (called on open and after any action)
  // ─────────────────────────────────────────────────────────────────────────
  const loadFriendData = useCallback(async () => {
    if (!user?.uid) return
    setLoadingFriends(true)
    try {
      // Use the two most-reliable field names (from/to AND from_uid/to_uid)
      const [sentPend, recvPend, sentAccepted, recvAccepted] = await Promise.all([
        getDocs(query(collection(db, 'friend_requests'), where('from', '==', user.uid), where('status', '==', 'pending'))),
        getDocs(query(collection(db, 'friend_requests'), where('to',   '==', user.uid), where('status', '==', 'pending'))),
        getDocs(query(collection(db, 'friend_requests'), where('from', '==', user.uid), where('status', '==', 'accepted'))),
        getDocs(query(collection(db, 'friend_requests'), where('to',   '==', user.uid), where('status', '==', 'accepted'))),
      ])

      const statuses  = {}
      const docIdMap  = {}

      // Pending sent
      sentPend.docs.forEach(d => {
        const uid = d.data().to
        if (uid) { statuses[uid] = 'pending'; docIdMap[uid] = d.id }
      })
      // Incoming (pending from others)
      recvPend.docs.forEach(d => {
        const uid = d.data().from
        if (uid) { statuses[uid] = 'incoming'; docIdMap[uid] = d.id }
      })
      // Accepted (I sent)
      sentAccepted.docs.forEach(d => {
        const uid = d.data().to
        if (uid) { statuses[uid] = 'friend'; docIdMap[uid] = d.id }
      })
      // Accepted (they sent)
      recvAccepted.docs.forEach(d => {
        const uid = d.data().from
        if (uid) { statuses[uid] = 'friend'; docIdMap[uid] = d.id }
      })

      setFriendStatuses(statuses)
      setRequestDocIds(docIdMap)

      // ── Build the friends list UI data ──────────────────────────────────
      const friendUids = Object.entries(statuses)
        .filter(([, s]) => s === 'friend').map(([uid]) => uid)
      const incomingUids = Object.entries(statuses)
        .filter(([, s]) => s === 'incoming').map(([uid]) => uid)

      // Fetch profiles for both
      const fetchProfiles = async (uids) => {
        if (!uids.length) return []
        const snaps = await Promise.all(
          uids.map(uid => getDocs(query(collection(db, 'profiles'), where('__name__', '==', uid))))
        )
        return snaps.flatMap(s => s.docs.map(d => ({ uid: d.id, ...d.data() })))
      }

      const [friends, incoming] = await Promise.all([
        fetchProfiles(friendUids),
        fetchProfiles(incomingUids),
      ])
      setFriendList(friends)
      setIncomingList(incoming)

    } catch (err) {
      console.warn('PeopleSearch: loadFriendData error —', err.message)
    } finally {
      setLoadingFriends(false)
    }
  }, [user?.uid])

  useEffect(() => {
    if (isOpen) loadFriendData()
  }, [isOpen, loadFriendData])

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab)
    }
  }, [isOpen, initialTab])

  // ─────────────────────────────────────────────────────────────────────────
  // Search debounce (Discover tab)
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'discover') return
    if (!searchQuery.trim()) { setResults([]); return }
    const doSearch = async () => {
      setIsSearching(true)
      try {
        const term = searchQuery.toLowerCase()
        const snap = await getDocs(collection(db, 'profiles'))
        const found = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(p => p.uid !== user?.uid && p.full_name?.toLowerCase().includes(term))
          .slice(0, 15)
        setResults(found)
      } catch (err) {
        console.warn('PeopleSearch: search error —', err.message)
      } finally {
        setIsSearching(false)
      }
    }
    const t = setTimeout(doSearch, 350)
    return () => clearTimeout(t)
  }, [searchQuery, user?.uid, activeTab])

  // ─────────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────────
  const sendFriendRequest = async (targetUid) => {
    try {
      const docRef = await addDoc(collection(db, 'friend_requests'), {
        from: user.uid, from_uid: user.uid,
        to: targetUid,  to_uid: targetUid,
        status: 'pending',
        timestamp: serverTimestamp(),
      })
      setFriendStatuses(s => ({ ...s, [targetUid]: 'pending' }))
      setRequestDocIds(s => ({ ...s, [targetUid]: docRef.id }))
    } catch (err) {
      console.warn('PeopleSearch: send request error —', err.message)
    }
  }

  const acceptFriendRequest = async (fromUid) => {
    const reqId = requestDocIds[fromUid]
    if (!reqId) return
    try {
      await updateDoc(doc(db, 'friend_requests', reqId), { status: 'accepted' })
      await loadFriendData()
    } catch (err) {
      console.warn('PeopleSearch: accept error —', err.message)
    }
  }

  const declineFriendRequest = async (fromUid) => {
    const reqId = requestDocIds[fromUid]
    if (!reqId) return
    try {
      await deleteDoc(doc(db, 'friend_requests', reqId))
      await loadFriendData()
    } catch (err) {
      console.warn('PeopleSearch: decline error —', err.message)
    }
  }

  const unfriend = async (friendUid) => {
    const reqId = requestDocIds[friendUid]
    if (!reqId) return
    try {
      await deleteDoc(doc(db, 'friend_requests', reqId))
      await loadFriendData()
    } catch (err) {
      console.warn('PeopleSearch: unfriend error —', err.message)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Button labels for Discover tab
  // ─────────────────────────────────────────────────────────────────────────
  const statusLabel = (uid) => {
    const s = friendStatuses[uid]
    if (s === 'friend')   return { label: '✓ Friends',   disabled: true,  cls: 'ps-btn-friend' }
    if (s === 'pending')  return { label: 'Requested',   disabled: true,  cls: 'ps-btn-pending' }
    if (s === 'incoming') return { label: '+ Accept',    disabled: false, cls: 'ps-btn-incoming' }
    return { label: '+ Add',                              disabled: false, cls: 'ps-btn-add' }
  }

  const handleDiscoverAction = (uid) => {
    const s = friendStatuses[uid]
    if (s === 'incoming') acceptFriendRequest(uid)
    else if (!s)          sendFriendRequest(uid)
  }

  if (!isOpen) return null

  return (
    <>
      <div className="ps-backdrop" onClick={onClose} />
      <div className="ps-panel">

        {/* Header */}
        <div className="ps-header">
          <div className="ps-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            People &amp; Friends
          </div>
          <button className="ps-close" onClick={onClose}>×</button>
        </div>

        {/* Tabs */}
        <div className="ps-tabs">
          <button
            className={`ps-tab ${activeTab === 'discover' ? 'ps-tab-active' : ''}`}
            onClick={() => { setActiveTab('discover'); setViewingProfile(null) }}
          >
            🔍 Discover
          </button>
          <button
            className={`ps-tab ${activeTab === 'friends' ? 'ps-tab-active' : ''}`}
            onClick={() => { setActiveTab('friends'); setViewingProfile(null) }}
          >
            👥 My Friends
            {incomingList.length > 0 && (
              <span className="ps-tab-badge">{incomingList.length}</span>
            )}
          </button>
        </div>

        {/* ── DISCOVER TAB ── */}
        {activeTab === 'discover' && (
          <>
            <div className="ps-search-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                autoFocus
                type="text"
                className="ps-search-input"
                placeholder="Search by name…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && <button className="ps-clear-btn" onClick={() => setSearchQuery('')}>×</button>}
            </div>

            {viewingProfile ? (
              <div className="ps-profile-view">
                <button className="ps-back-btn" onClick={() => setViewingProfile(null)}>← Back</button>
                <div className="ps-profile-header">
                  <div className="ps-profile-avatar">
                    {viewingProfile.photo_url
                      ? <img src={viewingProfile.photo_url} alt={viewingProfile.full_name} />
                      : (viewingProfile.avatar_emoji || viewingProfile.full_name?.[0]?.toUpperCase() || '?')
                    }
                  </div>
                  <div className="ps-profile-info">
                    <div className="ps-profile-name">{viewingProfile.full_name}</div>
                    <div className="ps-profile-type">{viewingProfile.student_type || 'Student'}</div>
                  </div>
                </div>
                <div className="ps-profile-stats">
                  {viewingProfile.xp !== undefined && <div className="ps-stat"><span>{viewingProfile.xp || 0}</span>XP</div>}
                  {viewingProfile.tasks_completed !== undefined && <div className="ps-stat"><span>{viewingProfile.tasks_completed || 0}</span>Tasks</div>}
                  {viewingProfile.study_hours !== undefined && <div className="ps-stat"><span>{viewingProfile.study_hours || 0}</span>Hours</div>}
                </div>
                {viewingProfile.bio && (
                  <div className="ps-profile-bio">
                    <div className="ps-profile-bio-label">Bio</div>
                    <p>{viewingProfile.bio}</p>
                  </div>
                )}
                {viewingProfile.interests?.length > 0 && (
                  <div className="ps-profile-bio">
                    <div className="ps-profile-bio-label">Interests</div>
                    <div className="ps-interests">
                      {viewingProfile.interests.map((i, idx) => <span key={idx} className="ps-interest-tag">{i}</span>)}
                    </div>
                  </div>
                )}
                <div className="ps-profile-actions">
                  {(() => {
                    const s = statusLabel(viewingProfile.uid)
                    return (
                      <button
                        className={`ps-action-btn ${s.cls}`}
                        disabled={s.disabled}
                        onClick={() => !s.disabled && handleDiscoverAction(viewingProfile.uid)}
                      >{s.label}</button>
                    )
                  })()}
                  <button className="ps-action-btn ps-btn-msg" onClick={() => onStartChat?.(viewingProfile)}>
                    💬 Message
                  </button>
                </div>
              </div>
            ) : (
              <div className="ps-results-list">
                {!searchQuery.trim() ? (
                  <div className="ps-empty"><span>🔍</span><p>Search for someone by name to connect!</p></div>
                ) : isSearching ? (
                  <div className="ps-empty"><p>Searching…</p></div>
                ) : results.length === 0 ? (
                  <div className="ps-empty"><p>No users found for "{searchQuery}"</p></div>
                ) : (
                  results.map(person => {
                    const s = statusLabel(person.uid)
                    return (
                      <div key={person.uid} className="ps-result-row">
                        <button className="ps-result-profile" onClick={() => setViewingProfile(person)}>
                          <div className="ps-avatar">
                            {person.photo_url
                              ? <img src={person.photo_url} alt={person.full_name} />
                              : (person.avatar_emoji || person.full_name?.[0]?.toUpperCase() || '?')
                            }
                          </div>
                          <div className="ps-info">
                            <div className="ps-name">{person.full_name}</div>
                            <div className="ps-type">{person.student_type || 'Student'} · View Profile →</div>
                          </div>
                        </button>
                        <div className="ps-row-actions">
                          <button className="ps-btn-icon" title="Message" onClick={() => onStartChat?.(person)}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                          </button>
                          <button
                            className={`ps-btn ${s.cls}`}
                            disabled={s.disabled}
                            onClick={() => !s.disabled && handleDiscoverAction(person.uid)}
                          >{s.label}</button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </>
        )}

        {/* ── MY FRIENDS TAB ── */}
        {activeTab === 'friends' && (
          <div className="ps-friends-tab">
            {loadingFriends ? (
              <div className="ps-empty"><p>Loading…</p></div>
            ) : (
              <>
                {/* Incoming Requests */}
                {incomingList.length > 0 && (
                  <div className="ps-section">
                    <div className="ps-section-header">
                      <span className="ps-section-dot ps-dot-incoming" />
                      Incoming Requests ({incomingList.length})
                    </div>
                    {incomingList.map(person => (
                      <div key={person.uid} className="ps-friend-row ps-incoming-row">
                        <div className="ps-avatar sm">
                          {person.photo_url
                            ? <img src={person.photo_url} alt={person.full_name} />
                            : (person.avatar_emoji || person.full_name?.[0]?.toUpperCase() || '?')
                          }
                        </div>
                        <div className="ps-info flex-1">
                          <div className="ps-name">{person.full_name || 'Scholar'}</div>
                          <div className="ps-type">{person.student_type || 'Student'}</div>
                        </div>
                        <div className="ps-row-actions">
                          <button
                            className="ps-btn ps-btn-incoming"
                            onClick={() => acceptFriendRequest(person.uid)}
                          >✓ Accept</button>
                          <button
                            className="ps-btn ps-btn-decline"
                            onClick={() => declineFriendRequest(person.uid)}
                          >✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Current Friends */}
                <div className="ps-section">
                  <div className="ps-section-header">
                    <span className="ps-section-dot ps-dot-friend" />
                    Friends ({friendList.length})
                  </div>
                  {friendList.length === 0 ? (
                    <div className="ps-empty sm">
                      <span>👥</span>
                      <p>No friends yet.<br />Use Discover to find people!</p>
                    </div>
                  ) : (
                    friendList.map(person => (
                      <div key={person.uid} className="ps-friend-row">
                        <div className="ps-avatar sm">
                          {person.photo_url
                            ? <img src={person.photo_url} alt={person.full_name} />
                            : (person.avatar_emoji || person.full_name?.[0]?.toUpperCase() || '?')
                          }
                        </div>
                        <div className="ps-info flex-1">
                          <div className="ps-name">{person.full_name || 'Scholar'}</div>
                          <div className="ps-type">{person.student_type || 'Student'}</div>
                        </div>
                        <div className="ps-row-actions">
                          <button
                            className="ps-btn-icon"
                            title="Message"
                            onClick={() => onStartChat?.(person)}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                            </svg>
                          </button>
                          <button
                            className="ps-btn ps-btn-duel"
                            title="Focus Duel"
                            onClick={() => { onStartDuel?.(person); onClose?.() }}
                          >⚔️ Duel</button>
                          <button
                            className="ps-btn ps-btn-unfriend"
                            title="Unfriend"
                            onClick={() => unfriend(person.uid)}
                          >Unfriend</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {incomingList.length === 0 && friendList.length === 0 && (
                  <div className="ps-empty">
                    <span>🤝</span>
                    <p>Your friends list is empty.<br />Head to Discover to connect with people!</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>
    </>
  )
}

export default PeopleSearch
