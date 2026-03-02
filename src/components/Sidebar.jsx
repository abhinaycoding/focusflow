import { useState } from 'react'
import { usePlan } from '../contexts/PlanContext'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useTranslation } from '../contexts/LanguageContext'
import './Sidebar.css'

const Sidebar = ({ activeTab, onNavigate }) => {
  const { isPro } = usePlan()
  const { signOut } = useAuth()
  const { theme, setThemeById, toggle, isDark, themes } = useTheme()
  const { language, setLanguage, languages } = useTranslation()
  const [themePanelOpen, setThemePanelOpen] = useState(false)
  const [langPanelOpen, setLangPanelOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path> },
    { id: 'library', label: 'Library', icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"></polyline></> },
    { id: 'analytics', label: 'Analytics', icon: <><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"></path></> },
    { id: 'rooms', label: 'Study Rooms', icon: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></> },
    { id: 'calendar', label: 'Calendar', icon: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></> },
    { id: 'goals', label: 'Goals', icon: <><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></> },
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
          {/* Settings / Controls */}
          <div className="sidebar-settings">
            <button 
              className={`nav-item ${themePanelOpen || langPanelOpen ? 'active' : ''}`}
              onClick={() => {
                if (themePanelOpen || langPanelOpen) {
                  setThemePanelOpen(false);
                  setLangPanelOpen(false);
                } else {
                  setThemePanelOpen(true);
                }
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
              <span className="nav-label">Settings</span>
            </button>

            {(themePanelOpen || langPanelOpen) && (
              <div className="sidebar-sub-panel">
                <div className="flex justify-between items-center p-2 border-b border-white/5 mb-2">
                  <button 
                    className={`text-[10px] font-bold uppercase tracking-widest ${themePanelOpen ? 'text-primary' : 'text-muted'}`}
                    onClick={() => { setThemePanelOpen(true); setLangPanelOpen(false); }}
                  >
                    Theme
                  </button>
                  <button 
                    className={`text-[10px] font-bold uppercase tracking-widest ${langPanelOpen ? 'text-primary' : 'text-muted'}`}
                    onClick={() => { setLangPanelOpen(true); setThemePanelOpen(false); }}
                  >
                    Language
                  </button>
                </div>

                {themePanelOpen && (
                  <div className="flex flex-col gap-1">
                    {themes.map(t => (
                      <button key={t.id} className={`sub-panel-item ${theme === t.id ? 'active' : ''}`} onClick={() => setThemeById(t.id)}>
                        {t.icon} {t.label}
                      </button>
                    ))}
                    <button className="sub-panel-item mt-2 border-t border-white/5 pt-2" onClick={toggle}>
                      🌓 Toggle Mode
                    </button>
                  </div>
                )}

                {langPanelOpen && (
                  <div className="flex flex-col gap-1">
                    {languages.map(l => (
                      <button key={l.code} className={`sub-panel-item ${language === l.code ? 'active' : ''}`} onClick={() => setLanguage(l.code)}>
                        {l.flag} {l.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {!isPro && (
            <button className="pro-upgrade-btn" onClick={() => onNavigate('pricing')}>
              PRO
            </button>
          )}
          <button className="nav-item logout-btn" onClick={async () => { await signOut(); onNavigate('landing') }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span className="nav-label">Log out</span>
          </button>
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
              {!isPro && (
                <button className="pro-upgrade-btn" onClick={() => handleNav('pricing')}>
                  Upgrade to PRO
                </button>
              )}
              <button 
                className="sub-panel-item flex items-center gap-2 p-3 bg-white/5 rounded-md"
                onClick={() => { setThemePanelOpen(true); setMobileMenuOpen(false); }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon w-5 h-5">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
                Settings
              </button>
              <button 
                className="sub-panel-item flex items-center gap-2 p-3 bg-red-500/10 text-red-500 rounded-md"
                onClick={async () => { await signOut(); onNavigate('landing') }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon w-5 h-5">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Sidebar
