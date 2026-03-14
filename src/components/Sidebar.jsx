import { useState, useEffect } from 'react'
import { usePlan } from '../contexts/PlanContext'
import { useAuth } from '../contexts/AuthContext'
import { useTranslation } from '../contexts/LanguageContext'
import { db } from '../lib/firebase'
import { collection, query, onSnapshot, where } from 'firebase/firestore'
import './Sidebar.css'

const Sidebar = ({ activeTab, onNavigate }) => {
  const { isPro } = usePlan()
  const { signOut, isAdmin } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [liveScholarCount, setLiveScholarCount] = useState(0)

  // Fetch Live Pulse Count
  useEffect(() => {
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000)
    const q = query(
      collection(db, 'room_members'),
      where('last_seen', '>=', twentyMinutesAgo)
    )
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Calculate unique active users
      const uniqueUsers = new Set()
      snapshot.docs.forEach(doc => {
        const data = doc.data()
        if (data.user_id) uniqueUsers.add(data.user_id)
      })
      setLiveScholarCount(3) // Static for now as requested
    }, (err) => {
      console.error("Pulse error:", err)
      setLiveScholarCount(1)
    })

    return () => unsubscribe()
  }, [])

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></> },
    { id: 'library', label: 'Library', icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"></polyline></> },
    { id: 'analytics', label: 'Analytics', icon: <><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"></path></> },
    { id: 'rooms', label: 'Study Rooms', icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></> },
    { id: 'calendar', label: 'Calendar', icon: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></> },
    { id: 'goals', label: 'Goals', icon: <><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></> },
    { id: 'exams', label: 'Exams Pro', icon: <><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></>, pro: true },
    { id: 'resume', label: 'Resume Pro', icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></>, pro: true },
  ]

  const mainTabs = tabs.slice(0, 4)
  const moreTabs = tabs.slice(4)

  const handleNav = (id) => {
    onNavigate(id)
    setMobileMenuOpen(false)
  }

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-header" onClick={() => onNavigate('landing')}>
          <div className="logo-icon">NN.</div>
          <span className="logo-text">NoteNook</span>
        </div>

        <nav className="sidebar-nav">
          {/* Main Tabs (Visible on Mobile) */}
          {mainTabs.map(tab => (
            <button
              key={tab.id}
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => handleNav(tab.id)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
                {tab.icon}
              </svg>
              <span className="nav-label">{tab.label.split(' ')[0]}</span>
            </button>
          ))}

          {/* Desktop Only Tabs */}
          <div className="sidebar-desktop-tabs">
            {moreTabs.map(tab => (
              <button
                key={tab.id}
                className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => handleNav(tab.id)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
                  {tab.icon}
                </svg>
                <span className="nav-label">
                  {tab.label}
                  {tab.pro && !isPro && <span className="pro-lock-badge">Pro</span>}
                  {tab.adminOnly && <span className="pro-lock-badge" style={{background: '#ef4444', color: 'white'}}>Admin</span>}
                </span>
              </button>
            ))}
          </div>

          {/* Mobile "More" Button */}
          <button 
            className={`nav-item mobile-more-btn ${mobileMenuOpen ? 'active' : ''}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
              <circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle>
            </svg>
            <span className="nav-label">More</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          {/* Refined Workspace Widget */}
          <div className="workspace-pulse-card" onClick={() => onNavigate('rooms')}>
            <div className="pulse-body">
              <span className="pulse-fire">🔥</span>
              <div className="flex flex-col flex-1">
                <div className="flex items-center gap-2">
                  <span className="pulse-dot"></span>
                  <span className="pulse-count">3+</span>
                </div>
                <span className="pulse-label">Scholars Active</span>
              </div>
            </div>
            
            {/* Community Energy Bar */}
            <div className="community-energy-wrap">
              <div className="energy-label-row">
                <span className="energy-label">Community Energy</span>
                <span className="energy-value">85%</span>
              </div>
              <div className="energy-track">
                <div className="energy-fill" style={{ width: '85%' }}></div>
              </div>
            </div>
          </div>

          {!isPro && !isAdmin && (
            <button className="pro-upgrade-btn" onClick={() => onNavigate('pricing')}>
              PRO
            </button>
          )}
        </div>
      </aside>

      {/* Mobile More Menu Overlay */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-menu-container" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-serif text-lg">Menu</h3>
              <button onClick={() => setMobileMenuOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                  <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="mobile-menu-grid">
              {moreTabs.map(tab => (
                <button
                  key={tab.id}
                  className={`mobile-menu-item ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => handleNav(tab.id)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    {tab.icon}
                  </svg>
                  <span className="text-[10px] font-bold uppercase">{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="mobile-menu-footer">
              {!isPro && !isAdmin && (
                <button className="pro-upgrade-btn" onClick={() => handleNav('pricing')}>
                  Upgrade to PRO
                </button>
              )}
              {/* Note: Profile, Settings, Logout are removed as they are in the header */}
              <div className="mobile-pulse-mini p-4 bg-white/5 rounded-xl border border-white/10 flex flex-col gap-2" onClick={() => handleNav('rooms')}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="pulse-dot"></span>
                    <span className="text-sm font-bold">3+ Scholars Live</span>
                  </div>
                  <span className="text-xs font-black text-primary">85% 🔥</span>
                </div>
                <div className="energy-track h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="energy-fill h-full bg-primary" style={{ width: '85%' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Sidebar
