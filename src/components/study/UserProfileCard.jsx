import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { db } from '../../lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { getArchetype } from '../../constants/archetypes'
import './UserProfileCard.css'

const UserProfileCard = ({ userId, displayName, photoUrl, avatarId, onClose }) => {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    const fetchProfile = async () => {
      try {
        const q = query(collection(db, 'profiles'), where('user_id', '==', userId))
        const snap = await getDocs(q)
        if (!snap.empty) {
          setProfile({ id: snap.docs[0].id, ...snap.docs[0].data() })
        }
      } catch (err) {
        console.warn('Could not load profile:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [userId])

  const arche = getArchetype(profile?.avatar_id || avatarId || 'owl')
  const photo = profile?.photo_url || photoUrl
  const name = profile?.full_name || displayName || 'Scholar'
  const banner = profile?.banner_color || '#1e293b'

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
          <h2 className="upc-name">{name}</h2>
          {profile?.rank_title && (
            <span className="upc-rank">{profile.rank_title}</span>
          )}

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
                    title={profile.anthem}
                  >
                    {profile.anthem.replace(/https?:\/\/(www\.)?/, '').slice(0, 40)}
                    {profile.anthem.length > 40 && '...'}
                  </a>
                </div>
              )}

              {!profile?.bio && !profile?.anthem && !profile?.status_text && (
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
