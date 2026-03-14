import React, { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import './LeaderboardPage.css'

const TABS = [
  { id: 'xp', label: '⚡ XP Rank', key: 'xp' },
  { id: 'tasks', label: '✅ Tasks Done', key: 'tasks' },
  { id: 'hours', label: '⏱ Study Hours', key: 'hours' },
]

const MEDALS = ['🥇', '🥈', '🥉']

const LeaderboardPage = ({ onNavigate }) => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('xp')
  const [scholars, setScholars] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const profilesSnap = await getDocs(collection(db, 'profiles'))
        const profiles = profilesSnap.docs.map(d => ({ uid: d.id, ...d.data() }))

        const enriched = profiles.map(p => ({
          uid: p.uid,
          name: p.full_name || 'Anonymous Scholar',
          avatar: p.photo_url || null,
          emoji: p.avatar_emoji || null,
          studentType: p.student_type || '',
          isPro: p.is_pro || false,
          xp: p.xp || 0,
          tasks: p.total_tasks_done || 0,
          hours: parseFloat(((p.total_study_seconds || 0) / 3600).toFixed(1)),
        }))

        setScholars(enriched)
      } catch (err) {
        console.warn('Leaderboard error:', err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const sorted = [...scholars].sort((a, b) => b[activeTab] - a[activeTab]).slice(0, 50)
  const myRank = sorted.findIndex(s => s.uid === user?.uid) + 1

  return (
    <div className="leaderboard-page">
      <div className="lb-header">
        <h1 className="lb-title">🏆 Leaderboard</h1>
        <p className="lb-subtitle">Top scholars on the FocusFlow platform</p>
      </div>

      {/* Tab bar */}
      <div className="lb-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`lb-tab ${activeTab === t.id ? 'lb-tab-active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* My Rank Banner */}
      {myRank > 0 && (
        <div className="lb-my-rank">
          <span className="lb-my-rank-label">Your Rank</span>
          <span className="lb-my-rank-num">#{myRank}</span>
          <span className="lb-my-rank-label">out of {scholars.length} scholars</span>
        </div>
      )}

      {/* Top 3 Podium */}
      {!loading && sorted.length >= 3 && (
        <div className="lb-podium">
          {/* 2nd place */}
          <div className="lb-podium-place silver">
            <div className="lb-podium-medal">🥈</div>
            <div className="lb-podium-avatar">{sorted[1]?.name?.[0]?.toUpperCase()}</div>
            <div className="lb-podium-name">{sorted[1]?.name?.split(' ')[0]}</div>
            <div className="lb-podium-score">
              {activeTab === 'hours' ? `${sorted[1]?.[activeTab]}h` : sorted[1]?.[activeTab]}
            </div>
            <div className="lb-podium-block" style={{ height: 80 }} />
          </div>
          {/* 1st place */}
          <div className="lb-podium-place gold">
            <div className="lb-podium-medal">🥇</div>
            <div className="lb-podium-avatar">{sorted[0]?.name?.[0]?.toUpperCase()}</div>
            <div className="lb-podium-name">{sorted[0]?.name?.split(' ')[0]}</div>
            <div className="lb-podium-score">
              {activeTab === 'hours' ? `${sorted[0]?.[activeTab]}h` : sorted[0]?.[activeTab]}
            </div>
            <div className="lb-podium-block" style={{ height: 110 }} />
          </div>
          {/* 3rd place */}
          <div className="lb-podium-place bronze">
            <div className="lb-podium-medal">🥉</div>
            <div className="lb-podium-avatar">{sorted[2]?.name?.[0]?.toUpperCase()}</div>
            <div className="lb-podium-name">{sorted[2]?.name?.split(' ')[0]}</div>
            <div className="lb-podium-score">
              {activeTab === 'hours' ? `${sorted[2]?.[activeTab]}h` : sorted[2]?.[activeTab]}
            </div>
            <div className="lb-podium-block" style={{ height: 60 }} />
          </div>
        </div>
      )}

      {/* Full list */}
      <div className="lb-list">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="lb-row lb-skeleton" />
          ))
        ) : (
          sorted.map((s, i) => (
            <div key={s.uid} className={`lb-row ${s.uid === user?.uid ? 'lb-row-me' : ''}`}>
              <div className="lb-rank">
                {i < 3 ? MEDALS[i] : <span className="lb-rank-num">#{i + 1}</span>}
              </div>
              <div className="lb-avatar">
                {s.avatar
                  ? <img src={s.avatar} alt={s.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  : (s.emoji || s.name?.[0]?.toUpperCase() || '?')
                }
              </div>
              <div className="lb-info">
                <div className="lb-name">
                  {s.name}
                  {s.uid === user?.uid && <span className="lb-you-badge">You</span>}
                  {s.isPro && <span className="lb-pro-badge">PRO</span>}
                </div>
                <div className="lb-type">{s.studentType}</div>
              </div>
              <div className="lb-score">
                {activeTab === 'hours' ? `${s[activeTab] || 0}h` : (s[activeTab] || 0).toLocaleString()}
                <span className="lb-score-label">
                  {activeTab === 'xp' ? ' XP' : activeTab === 'tasks' ? ' tasks' : ''}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default LeaderboardPage
