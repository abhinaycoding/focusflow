import React, { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { usePlan } from '../contexts/PlanContext'
import { LEVELS } from '../components/XPBar'
import { ALL_BADGES } from '../components/XPBar'

const BANNER_GRADIENTS = {
  grad_nebula:   'linear-gradient(135deg, #1a0533 0%, #6d28d9 45%, #ec4899 100%)',
  grad_aurora:   'linear-gradient(135deg, #064e3b 0%, #065f46 30%, #0ea5e9 100%)',
  grad_sunset:   'linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #fbbf24 100%)',
  grad_ocean:    'linear-gradient(135deg, #0c1445 0%, #1e3a8a 50%, #0ea5e9 100%)',
  grad_sakura:   'linear-gradient(135deg, #831843 0%, #db2777 50%, #f9a8d4 100%)',
  grad_obsidian: 'linear-gradient(135deg, #0a0a0a 0%, #27272a 60%, #3f3f46 100%)',
  grad_forest:   'linear-gradient(135deg, #14532d 0%, #166534 50%, #84cc16 100%)',
  grad_cosmic:   'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #7c3aed 80%, #ec4899 100%)',
}

const THEME_COLORS = {
  default: '#ea580c', violet: '#7c3aed', cyan: '#06b6d4',
  rose: '#e11d48', emerald: '#10b981', amber: '#f59e0b',
  indigo: '#4f46e5', pink: '#ec4899',
}

const BORDER_CLASSES = {
  none: '', neon: 'border-neon', gold: 'border-gold',
  cyber: 'border-cyber', rainbow: 'border-rainbow', fire: 'border-fire',
}

const getLevel = (xp) => {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXP) return { ...LEVELS[i], index: i }
  }
  return { ...LEVELS[0], index: 0 }
}

const PublicProfilePage = ({ onNavigate }) => {
  const { user, profile } = useAuth()
  const { isPro } = usePlan()

  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const xp = parseInt(localStorage.getItem('notenook_xp') || '0', 10)
  const earnedBadgeIds = (() => {
    try { return JSON.parse(localStorage.getItem('notenook_badges') || '[]') } catch { return [] }
  })()

  const currentLevel = getLevel(xp)
  const nextLevel = LEVELS[currentLevel.index + 1]
  const xpInLevel = xp - currentLevel.minXP
  const xpForNext = nextLevel ? nextLevel.minXP - currentLevel.minXP : 1
  const progress = nextLevel ? Math.min((xpInLevel / xpForNext) * 100, 100) : 100

  const cosmetics = profile?.cosmetics || {}
  const themeColor = THEME_COLORS[cosmetics.themeColor] || THEME_COLORS.default
  const borderClass = BORDER_CLASSES[cosmetics.avatarBorder] || ''

  const getBannerStyle = () => {
    if (cosmetics.bannerUrl) return { backgroundImage: `url(${cosmetics.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    const gradient = BANNER_GRADIENTS[cosmetics.bannerId]
    if (gradient) return { background: gradient }
    return { background: `linear-gradient(135deg, color-mix(in srgb, ${themeColor} 20%, var(--bg-card)), var(--bg-card))` }
  }

  useEffect(() => {
    if (!user?.uid) return
    const load = async () => {
      try {
        const [sessSnap, taskSnap] = await Promise.all([
          getDocs(query(collection(db, 'sessions'), where('user_id', '==', user.uid), where('completed', '==', true))),
          getDocs(query(collection(db, 'tasks'), where('user_id', '==', user.uid)))
        ])
        const sessions = sessSnap.docs.map(d => d.data())
        const tasks = taskSnap.docs.map(d => d.data())
        const totalMins = sessions.reduce((sum, s) => sum + Math.round((s.duration_seconds || 0) / 60), 0)
        const completedTasks = tasks.filter(t => t.completed).length
        setStats({ sessions: sessions.length, totalHours: (totalMins / 60).toFixed(1), tasks: tasks.length, completedTasks })
      } catch (e) { console.warn(e) } finally { setLoading(false) }
    }
    load()
  }, [user?.uid])

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const joinedDate = profile?.updated_at
    ? new Date(profile.updated_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  const earnedBadges = ALL_BADGES.filter(b => earnedBadgeIds.includes(b.id))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', paddingBottom: '5rem' }}>
      {/* ── Banner Hero ── */}
      <div style={{ position: 'relative', minHeight: 200, overflow: 'hidden', ...getBannerStyle() }}>
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.72) 100%)',
        }} />

        {/* Back + Customize buttons */}
        <div style={{ position: 'absolute', top: '1.25rem', left: '1.25rem', display: 'flex', gap: '0.5rem', zIndex: 2 }}>
          <button
            onClick={() => onNavigate('dashboard')}
            style={{
              background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', borderRadius: '50px',
              padding: '0.35rem 0.9rem', fontSize: '0.65rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer',
            }}
          >← Back</button>
          {isPro && (
            <button
              onClick={() => onNavigate('customize')}
              style={{
                background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: '#fff', borderRadius: '50px',
                padding: '0.35rem 0.9rem', fontSize: '0.65rem', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.35rem',
              }}
            >🎨 Customize</button>
          )}
          {!isPro && (
            <button
              onClick={() => onNavigate('pricing')}
              style={{
                background: `linear-gradient(135deg, ${themeColor}, #f59e0b)`,
                border: 'none', color: '#fff', borderRadius: '50px',
                padding: '0.35rem 0.9rem', fontSize: '0.65rem', fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer',
              }}
            >✦ Upgrade to Customize</button>
          )}
        </div>

        {/* Pro Master badge */}
        {isPro && (
          <div style={{
            position: 'absolute', top: '1rem', right: '1rem',
            background: `linear-gradient(135deg, ${themeColor}, #f59e0b)`,
            color: '#fff', fontSize: '0.52rem', fontWeight: 900,
            letterSpacing: '0.18em', padding: '0.35rem 0.85rem', borderRadius: '50px', zIndex: 2,
          }}>
            MASTER ✦
          </div>
        )}

        {/* Hero Content */}
        <div style={{
          position: 'relative', zIndex: 1, padding: '3.5rem 2rem 2rem',
          display: 'flex', alignItems: 'flex-end', gap: '1.25rem',
        }}>
          {/* Avatar with cosmetic border */}
          <div
            className={`pcp-border-preview-avatar ${borderClass}`}
            style={{
              width: 88, height: 88, borderRadius: '50%',
              background: `linear-gradient(135deg, ${themeColor}, #ff8800)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.6rem', flexShrink: 0, border: '3px solid rgba(255,255,255,0.2)',
            }}
          >
            {profile?.avatar_emoji || profile?.full_name?.[0] || '🎓'}
          </div>

          <div style={{ flex: 1 }}>
            {/* Custom status */}
            {cosmetics.customStatus && (
              <div style={{
                display: 'inline-block', background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
                borderRadius: '50px', padding: '0.2rem 0.8rem',
                fontSize: '0.65rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600, marginBottom: '0.4rem',
              }}>
                {cosmetics.customStatus}
              </div>
            )}
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', color: '#fff', margin: 0, textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
              {profile?.full_name || 'Scholar'}
            </h1>
            {profile?.student_type && (
              <p style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.7)', fontWeight: 700, marginTop: '0.15rem' }}>
                {profile.student_type}
              </p>
            )}
            {profile?.bio && (
              <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.65)', marginTop: '0.3rem', maxWidth: 400, lineHeight: 1.4 }}>
                {profile.bio}
              </p>
            )}
            {/* Anthem */}
            {cosmetics.songTitle && (
              <a
                href={cosmetics.songUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.5rem',
                  background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)',
                  borderRadius: '50px', padding: '0.25rem 0.85rem',
                  fontSize: '0.65rem', color: 'rgba(255,255,255,0.85)', fontWeight: 600,
                  textDecoration: 'none', transition: 'background 0.2s',
                }}
              >
                🎵 {cosmetics.songTitle}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── Action row ── */}
      <div style={{ maxWidth: 640, margin: '1.5rem auto 0', padding: '0 1.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Level chip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          background: 'var(--bg-card)', border: `1px solid ${themeColor}33`,
          borderRadius: '50px', padding: '0.4rem 1rem',
          boxShadow: `0 0 12px ${themeColor}22`,
        }}>
          <span style={{ fontSize: '1.1rem' }}>{currentLevel.icon}</span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-primary)' }}>
            {currentLevel.name}
          </span>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
            · {xp} XP
          </span>
        </div>

        {/* XP Bar */}
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: `linear-gradient(90deg, ${themeColor}, #fbbf24)`,
              borderRadius: 6, transition: 'width 0.8s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.52rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            <span>{currentLevel.name}</span>
            <span>{nextLevel ? `${xpForNext - xpInLevel} XP to ${nextLevel.name}` : 'Max Level ⭐'}</span>
          </div>
        </div>

        <button
          onClick={copyLink}
          style={{
            background: copied ? '#22c55e' : themeColor, color: '#fff', border: 'none',
            borderRadius: '50px', padding: '0.5rem 1.25rem', fontSize: '0.65rem',
            fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          {copied ? '✓ Copied!' : '🔗 Share'}
        </button>
      </div>

      {/* ── Stats Row ── */}
      <div style={{ maxWidth: 640, margin: '1.75rem auto 0', padding: '0 1.5rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        {[
          { label: 'Sessions', value: loading ? '—' : stats?.sessions ?? 0, icon: '⏱' },
          { label: 'Hours', value: loading ? '—' : stats?.totalHours ?? 0, icon: '📚' },
          { label: 'Tasks Done', value: loading ? '—' : stats?.completedTasks ?? 0, icon: '✅' },
          { label: 'Badges', value: earnedBadges.length, icon: '🏅' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--bg-card)', border: `1px solid ${themeColor}22`,
            borderRadius: 16, padding: '1rem 0.75rem', textAlign: 'center',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
            boxShadow: `0 4px 16px ${themeColor}10`,
          }}>
            <div style={{ fontSize: '1.4rem' }}>{s.icon}</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color: themeColor, fontWeight: 700 }}>{s.value}</div>
            <div style={{ fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', fontWeight: 700 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Badges Section ── */}
      {earnedBadges.length > 0 && (
        <div style={{ maxWidth: 640, margin: '1.75rem auto 0', padding: '0 1.5rem' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', color: 'var(--text-primary)', marginBottom: '1rem' }}>
            🏅 Earned Badges ({earnedBadges.length})
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.75rem' }}>
            {earnedBadges.map(badge => (
              <div key={badge.id} style={{
                background: 'var(--bg-card)', border: `1px solid ${themeColor}40`,
                borderRadius: 16, padding: '1rem 0.75rem',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem',
                textAlign: 'center', boxShadow: `0 2px 12px ${themeColor}18`,
              }}>
                <div style={{ fontSize: '2rem', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.2))' }}>{badge.emoji}</div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '0.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
                  {badge.name}
                </div>
                <div style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{badge.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {earnedBadges.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.8rem', fontStyle: 'italic' }}>
          No badges earned yet — start studying to unlock them! 🚀
        </div>
      )}

      {/* cosmetic border CSS injected via scoped style */}
      <style>{`
        .pcp-border-preview-avatar.border-neon { border: 3px solid #06d6a0 !important; box-shadow: 0 0 16px #06d6a0, 0 0 32px rgba(6,214,160,0.4); animation: neonPulse 2s ease-in-out infinite; }
        .pcp-border-preview-avatar.border-gold { border: 3px solid #fbbf24 !important; box-shadow: 0 0 16px #f59e0b, 0 0 32px rgba(251,191,36,0.4); }
        .pcp-border-preview-avatar.border-cyber { border: 3px solid #7c3aed !important; box-shadow: 0 0 16px #7c3aed, 0 0 32px rgba(124,58,237,0.5); animation: cyberGlitch 3s steps(1) infinite; }
        .pcp-border-preview-avatar.border-rainbow { outline: 3px solid; outline-offset: -3px; animation: rainbowOutline 4s linear infinite; }
        .pcp-border-preview-avatar.border-fire { border: 3px solid #ea580c !important; box-shadow: 0 0 20px #ea580c, 0 8px 30px rgba(234,88,12,0.7); animation: firePulse 1.5s ease-in-out infinite; }
        @keyframes neonPulse { 0%,100%{box-shadow:0 0 12px #06d6a0,0 0 24px rgba(6,214,160,.4)}50%{box-shadow:0 0 24px #06d6a0,0 0 48px rgba(6,214,160,.6)} }
        @keyframes cyberGlitch { 0%,90%,100%{box-shadow:0 0 16px #7c3aed,0 0 32px rgba(124,58,237,.5);border-color:#7c3aed}92%{box-shadow:4px 0 16px #ec4899,-4px 0 16px #06b6d4;border-color:#ec4899}94%{box-shadow:-4px 0 16px #7c3aed,4px 0 16px #ec4899;border-color:#7c3aed} }
        @keyframes rainbowOutline { 0%{outline-color:#f00}17%{outline-color:#ff0}33%{outline-color:#0f0}50%{outline-color:#0ff}67%{outline-color:#00f}83%{outline-color:#f0f}100%{outline-color:#f00} }
        @keyframes firePulse { 0%,100%{box-shadow:0 0 16px #ea580c,0 8px 24px rgba(234,88,12,.6)}50%{box-shadow:0 0 28px #f59e0b,0 10px 36px rgba(245,158,11,.7)} }
      `}</style>
    </div>
  )
}

export default PublicProfilePage
