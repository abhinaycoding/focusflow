import React, { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import { doc, setDoc } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { usePlan } from '../contexts/PlanContext'
import { useToast } from '../contexts/ToastContext'
import './ProfileCustomizerPage.css'

const BANNER_GRADIENTS = [
  { id: 'grad_nebula',  label: 'Nebula',    style: 'linear-gradient(135deg, #1a0533 0%, #6d28d9 45%, #ec4899 100%)' },
  { id: 'grad_aurora',  label: 'Aurora',    style: 'linear-gradient(135deg, #064e3b 0%, #065f46 30%, #0ea5e9 100%)' },
  { id: 'grad_sunset',  label: 'Sunset',    style: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #fbbf24 100%)' },
  { id: 'grad_ocean',   label: 'Deep Sea',  style: 'linear-gradient(135deg, #0c1445 0%, #1e3a8a 50%, #0ea5e9 100%)' },
  { id: 'grad_sakura',  label: 'Sakura',    style: 'linear-gradient(135deg, #831843 0%, #db2777 50%, #f9a8d4 100%)' },
  { id: 'grad_obsidian',label: 'Obsidian',  style: 'linear-gradient(135deg, #0a0a0a 0%, #27272a 60%, #3f3f46 100%)' },
  { id: 'grad_forest',  label: 'Forest',    style: 'linear-gradient(135deg, #14532d 0%, #166534 50%, #84cc16 100%)' },
  { id: 'grad_cosmic',  label: 'Cosmic',    style: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #7c3aed 80%, #ec4899 100%)' },
]

const AVATAR_BORDERS = [
  { id: 'none',      label: 'None',         cssClass: '' },
  { id: 'neon',      label: 'Neon Pulse',   cssClass: 'border-neon' },
  { id: 'gold',      label: 'Gold Ring',    cssClass: 'border-gold' },
  { id: 'cyber',     label: 'Cyber Glitch', cssClass: 'border-cyber' },
  { id: 'rainbow',   label: 'Rainbow',      cssClass: 'border-rainbow' },
  { id: 'fire',      label: 'Fire Aura',    cssClass: 'border-fire' },
]

const PROFILE_THEMES = [
  { id: 'default',   label: 'Default',      color: '#ea580c' },
  { id: 'violet',    label: 'Violet',        color: '#7c3aed' },
  { id: 'cyan',      label: 'Cyan',          color: '#06b6d4' },
  { id: 'rose',      label: 'Rose',          color: '#e11d48' },
  { id: 'emerald',   label: 'Emerald',       color: '#10b981' },
  { id: 'amber',     label: 'Amber',         color: '#f59e0b' },
  { id: 'indigo',    label: 'Indigo',        color: '#4f46e5' },
  { id: 'pink',      label: 'Pink',          color: '#ec4899' },
]

const STATUS_PRESETS = [
  '🔥 Deep Work Mode',
  '📚 Currently Studying',
  '☕ Coffee Break',
  '🎯 In Focus Session',
  '🚀 Grinding hard',
  '💡 Solving Problems',
  '🌙 Late Night Study',
  '✅ Taking it easy',
]

const ProfileCustomizerPage = ({ onNavigate }) => {
  const { user, profile, refreshProfile } = useAuth()
  const { isPro } = usePlan()
  const toast = useToast()

  const cosmetics = profile?.cosmetics || {}

  const [selectedBanner,  setSelectedBanner]  = useState(cosmetics.bannerId    || 'grad_nebula')
  const [customBannerUrl, setCustomBannerUrl] = useState(cosmetics.bannerUrl   || '')
  const [selectedBorder,  setSelectedBorder]  = useState(cosmetics.avatarBorder || 'none')
  const [selectedTheme,   setSelectedTheme]   = useState(cosmetics.themeColor  || 'default')
  const [customStatus,    setCustomStatus]    = useState(cosmetics.customStatus || '')
  const [songTitle,       setSongTitle]       = useState(cosmetics.songTitle    || '')
  const [songUrl,         setSongUrl]         = useState(cosmetics.songUrl      || '')
  const [bio,             setBio]             = useState(profile?.bio           || '')
  const [saving,          setSaving]          = useState(false)
  const [activeTab,       setActiveTab]       = useState('banner')

  const selectedBannerObj = BANNER_GRADIENTS.find(b => b.id === selectedBanner)
  const selectedBorderObj = AVATAR_BORDERS.find(b => b.id === selectedBorder)
  const selectedThemeObj  = PROFILE_THEMES.find(t => t.id === selectedTheme)

  const getBannerStyle = () => {
    if (customBannerUrl) return { backgroundImage: `url(${customBannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    return { background: selectedBannerObj?.style || BANNER_GRADIENTS[0].style }
  }

  const handleSave = async () => {
    if (!user?.uid) return
    setSaving(true)
    try {
      const payload = {
        bio,
        cosmetics: {
          bannerId:     selectedBanner,
          bannerUrl:    customBannerUrl,
          avatarBorder: selectedBorder,
          themeColor:   selectedTheme,
          customStatus,
          songTitle,
          songUrl,
        },
        updated_at: new Date().toISOString(),
      }
      await setDoc(doc(db, 'profiles', user.uid), payload, { merge: true })
      await refreshProfile()
      toast('Profile updated! ✨', 'success')
    } catch (err) {
      console.error(err)
      toast('Failed to save. Try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!isPro) {
    return (
      <div className="pcp-gate">
        <div className="pcp-gate-card">
          <div className="pcp-gate-icon">🎨</div>
          <h2>Profile Customization Studio</h2>
          <p>This is a Master Tier exclusive feature. Upgrade to unlock animated banners, avatar borders, custom themes, and more.</p>
          <button className="pcp-upgrade-btn" onClick={() => onNavigate('pricing')}>
            Upgrade to Master ✦
          </button>
          <button className="pcp-back-link" onClick={() => onNavigate('profile')}>
            ← View My Profile
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pcp-root">
      {/* Top Hero Preview */}
      <div className="pcp-preview-hero" style={getBannerStyle()}>
        <div className="pcp-preview-overlay" />
        <div className="pcp-preview-content">
          <div className={`pcp-preview-avatar ${selectedBorderObj?.cssClass || ''}`}>
            {profile?.photo_url ? (
              <img src={profile.photo_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              profile?.avatar_emoji || profile?.full_name?.[0] || '🎓'
            )}
          </div>
          <div className="pcp-preview-info">
            <h1 className="pcp-preview-name">{profile?.full_name || 'Your Name'}</h1>
            {customStatus && <div className="pcp-preview-status">{customStatus}</div>}
            {bio && <p className="pcp-preview-bio">{bio}</p>}
            {songTitle && (
              <div className="pcp-preview-song">
                🎵 <span>{songTitle}</span>
              </div>
            )}
          </div>
        </div>
        <div
          className="pcp-preview-badge"
          style={{ background: selectedThemeObj?.color || '#ea580c' }}
        >
          MASTER
        </div>
      </div>

      {/* Editor Panel */}
      <div className="pcp-editor">
        {/* Tab Bar */}
        <div className="pcp-tabs">
          {[
            { id: 'banner',   icon: '🖼',  label: 'Banner' },
            { id: 'avatar',   icon: '✨',  label: 'Avatar Border' },
            { id: 'theme',    icon: '🎨',  label: 'Theme Color' },
            { id: 'status',   icon: '💬',  label: 'Status' },
            { id: 'music',    icon: '🎵',  label: 'Anthem' },
            { id: 'bio',      icon: '📝',  label: 'Bio' },
          ].map(tab => (
            <button
              key={tab.id}
              className={`pcp-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="pcp-tab-icon">{tab.icon}</span>
              <span className="pcp-tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="pcp-tab-body">

          {/* ── Banner Tab ── */}
          {activeTab === 'banner' && (
            <div className="pcp-section">
              <div className="pcp-section-header">
                <h3>Profile Banner</h3>
                <p>Choose an animated gradient or paste a custom image URL.</p>
              </div>
              <div className="pcp-banner-grid">
                {BANNER_GRADIENTS.map(bg => (
                  <button
                    key={bg.id}
                    className={`pcp-banner-swatch ${selectedBanner === bg.id && !customBannerUrl ? 'selected' : ''}`}
                    style={{ background: bg.style }}
                    onClick={() => { setSelectedBanner(bg.id); setCustomBannerUrl('') }}
                  >
                    <span className="pcp-banner-label">{bg.label}</span>
                    {selectedBanner === bg.id && !customBannerUrl && (
                      <span className="pcp-banner-check">✓</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="pcp-custom-banner">
                <label className="pcp-label">Or use a custom image URL</label>
                <div className="pcp-input-row">
                  <input
                    type="url"
                    className="pcp-input"
                    placeholder="https://example.com/your-banner.jpg"
                    value={customBannerUrl}
                    onChange={e => setCustomBannerUrl(e.target.value)}
                  />
                  {customBannerUrl && (
                    <button className="pcp-clear-btn" onClick={() => setCustomBannerUrl('')}>✕ Clear</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Avatar Border Tab ── */}
          {activeTab === 'avatar' && (
            <div className="pcp-section">
              <div className="pcp-section-header">
                <h3>Avatar Border & Glow</h3>
                <p>Add an animated effect around your avatar to stand out in rooms and on your profile.</p>
              </div>
              <div className="pcp-border-grid">
                {AVATAR_BORDERS.map(b => (
                  <button
                    key={b.id}
                    className={`pcp-border-card ${selectedBorder === b.id ? 'selected' : ''}`}
                    onClick={() => setSelectedBorder(b.id)}
                  >
                    <div className={`pcp-border-preview-avatar ${b.cssClass}`}>
                      {profile?.photo_url ? (
                        <img src={profile.photo_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      ) : (
                        profile?.avatar_emoji || profile?.full_name?.[0] || '🎓'
                      )}
                    </div>
                    <span className="pcp-border-name">{b.label}</span>
                    {selectedBorder === b.id && <div className="pcp-selected-dot" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Theme Tab ── */}
          {activeTab === 'theme' && (
            <div className="pcp-section">
              <div className="pcp-section-header">
                <h3>Profile Accent Color</h3>
                <p>Set a unique accent color for your public profile page that's completely separate from the app theme.</p>
              </div>
              <div className="pcp-theme-grid">
                {PROFILE_THEMES.map(t => (
                  <button
                    key={t.id}
                    className={`pcp-theme-swatch ${selectedTheme === t.id ? 'selected' : ''}`}
                    style={{ '--swatch-color': t.color }}
                    onClick={() => setSelectedTheme(t.id)}
                  >
                    <div className="pcp-theme-dot" style={{ background: t.color }} />
                    <span className="pcp-theme-label">{t.label}</span>
                    {selectedTheme === t.id && <span className="pcp-theme-check">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Status Tab ── */}
          {activeTab === 'status' && (
            <div className="pcp-section">
              <div className="pcp-section-header">
                <h3>Custom Status</h3>
                <p>Set your current vibe. This appears below your name in study rooms and on your profile.</p>
              </div>
              <input
                type="text"
                className="pcp-input pcp-status-input"
                maxLength={60}
                placeholder="e.g. 🔥 Deep Work Mode"
                value={customStatus}
                onChange={e => setCustomStatus(e.target.value)}
              />
              <div className="pcp-presets">
                <p className="pcp-presets-label">Quick pick:</p>
                <div className="pcp-presets-grid">
                  {STATUS_PRESETS.map(s => (
                    <button
                      key={s}
                      className={`pcp-preset-chip ${customStatus === s ? 'selected' : ''}`}
                      onClick={() => setCustomStatus(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Music Anthem Tab ── */}
          {activeTab === 'music' && (
            <div className="pcp-section">
              <div className="pcp-section-header">
                <h3>Study Anthem</h3>
                <p>Pin your go-to study track to your profile page. Enter the song name and an optional Spotify/YouTube link.</p>
              </div>
              <label className="pcp-label">Song / Track Name</label>
              <input
                type="text"
                className="pcp-input"
                placeholder="e.g. lofi beats to study/relax to"
                value={songTitle}
                onChange={e => setSongTitle(e.target.value)}
              />
              <label className="pcp-label" style={{ marginTop: '1rem' }}>Link (Spotify, YouTube, etc.)</label>
              <input
                type="url"
                className="pcp-input"
                placeholder="https://open.spotify.com/..."
                value={songUrl}
                onChange={e => setSongUrl(e.target.value)}
              />
            </div>
          )}

          {/* ── Bio Tab ── */}
          {activeTab === 'bio' && (
            <div className="pcp-section">
              <div className="pcp-section-header">
                <h3>Profile Bio</h3>
                <p>Tell the world who you are and what you're working towards.</p>
              </div>
              <textarea
                className="pcp-textarea"
                maxLength={200}
                placeholder="e.g. JEE 2026 aspirant. 4 hours deep work daily. ☕"
                value={bio}
                onChange={e => setBio(e.target.value)}
                rows={4}
              />
              <div className="pcp-char-count">{bio.length}/200</div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pcp-footer">
          <button className="pcp-back-btn" onClick={() => onNavigate('profile')}>
            ← View Profile
          </button>
          <button
            className="pcp-save-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '✦ Saving...' : '✦ Save Profile'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProfileCustomizerPage
