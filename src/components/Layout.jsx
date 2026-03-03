import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { db } from '../lib/firebase';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import MaintenanceMode from './MaintenanceMode';
import SupportWidget from './SupportWidget';
import './Layout.css';

const toProperCase = (str) =>
  str ? str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : '';

const TAB_LABELS = {
  dashboard: 'Dashboard',
  library: 'Library',
  analytics: 'Analytics',
  rooms: 'Study Rooms',
  room: 'Study Room',
  calendar: 'Calendar',
  goals: 'Goals',
  exams: 'Exam Planner',
  resume: 'Resume Builder',
  settings: 'Settings',
  profile: 'My Profile',
  admin: 'Command Center',
  pricing: 'Pricing',
  customize: 'Customise',
  landing: 'Home',
};

const ALL_PAGES = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { id: 'library', label: 'Library', icon: '📚' },
  { id: 'analytics', label: 'Analytics', icon: '📈' },
  { id: 'rooms', label: 'Study Rooms', icon: '👥' },
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'goals', label: 'Goals', icon: '🎯' },
  { id: 'exams', label: 'Exam Planner', icon: '📝' },
  { id: 'resume', label: 'Resume Builder', icon: '📄' },
  { id: 'profile', label: 'My Profile', icon: '👤' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
  { id: 'pricing', label: 'Pricing', icon: '💎' },
];

const Layout = ({ children, onNavigate, activeTab, fullBleed = false }) => {
  const { profile, user, signOut } = useAuth();
  const { isDark, toggle } = useTheme();
  const [globalSettings, setGlobalSettings] = useState(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const avatarRef = useRef(null);
  const notifRef = useRef(null);
  const cmdInputRef = useRef(null);

  // Global settings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) setGlobalSettings(docSnap.data());
    });
    return () => unsub();
  }, []);

  // Friend requests as notifications
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'friend_requests'),
      where('to', '==', user.uid),
      where('status', '==', 'pending')
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user?.uid]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setAvatarOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Ctrl+K command palette
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(prev => !prev);
        setCmdQuery('');
      }
      if (e.key === 'Escape') { setCmdOpen(false); setAvatarOpen(false); setNotifOpen(false); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Auto-focus cmd input
  useEffect(() => {
    if (cmdOpen && cmdInputRef.current) cmdInputRef.current.focus();
  }, [cmdOpen]);

  const filteredPages = ALL_PAGES.filter(p =>
    p.label.toLowerCase().includes(cmdQuery.toLowerCase()) ||
    p.id.toLowerCase().includes(cmdQuery.toLowerCase())
  );

  const isMaintenance = globalSettings?.maintenance_active === true;
  const isAdmin = profile?.isAdmin === true;

  if (isMaintenance && !isAdmin) return <MaintenanceMode />;

  return (
    <div className="app-layout">
      {globalSettings?.announcement_active && globalSettings?.announcement && (
        <div className="layout-announcement-banner">
          <span className="banner-icon">⚡</span>
          <div className="banner-marquee-track">
            <span className="banner-text">{globalSettings.announcement}</span>
            <span className="banner-separator">✦</span>
            <span className="banner-text">{globalSettings.announcement}</span>
            <span className="banner-separator">✦</span>
            <span className="banner-text">{globalSettings.announcement}</span>
            <span className="banner-separator">✦</span>
          </div>
        </div>
      )}
      {isMaintenance && isAdmin && (
        <div className="layout-maintenance-banner">
          ⚠️ MAINTENANCE MODE ACTIVE - ALL SCHOLARS ARE BLOCKED
        </div>
      )}

      <div className="app-body">
        <Sidebar onNavigate={onNavigate} activeTab={activeTab} />
        <div className="main-content-wrapper">
          <header className="main-header">
            {/* Breadcrumbs */}
            <div className="header-breadcrumbs">
              <button className="breadcrumb-path" onClick={() => onNavigate('dashboard')}>NoteNook</button>
              {activeTab && (
                <>
                  <span className="breadcrumb-sep">/</span>
                  <span className="breadcrumb-current">{TAB_LABELS[activeTab] || toProperCase(activeTab)}</span>
                </>
              )}
            </div>

            {/* Right actions */}
            <div className="header-actions">

              {/* Ctrl+K search button */}
              <button className="header-icon-btn cmd-trigger" onClick={() => { setCmdOpen(true); setCmdQuery(''); }} title="Quick navigate (Ctrl+K)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <span className="cmd-hint">⌘K</span>
              </button>

              {/* Dark/Light toggle */}
              <button className="header-icon-btn theme-toggle-btn" onClick={toggle} title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}>
                {isDark ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                )}
              </button>

              {/* Notifications bell */}
              <div className="header-dropdown-wrap" ref={notifRef}>
                <button className="header-icon-btn notif-btn" onClick={() => { setNotifOpen(p => !p); setAvatarOpen(false); }} title="Notifications">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </svg>
                  {notifications.length > 0 && (
                    <span className="notif-badge">{notifications.length > 9 ? '9+' : notifications.length}</span>
                  )}
                </button>
                {notifOpen && (
                  <div className="header-dropdown notif-dropdown">
                    <div className="dropdown-header">
                      <span>Notifications</span>
                      {notifications.length > 0 && <span className="dropdown-count">{notifications.length} new</span>}
                    </div>
                    {notifications.length === 0 ? (
                      <div className="dropdown-empty">
                        <span>🎉</span>
                        <p>You're all caught up!</p>
                      </div>
                    ) : (
                      <div className="notif-list">
                        {notifications.map(n => (
                          <div key={n.id} className="notif-item" onClick={() => { onNavigate('profile'); setNotifOpen(false); }}>
                            <span className="notif-icon">👋</span>
                            <div>
                              <p className="notif-title">{toProperCase(n.fromName || 'Someone')} wants to be your friend!</p>
                              <p className="notif-sub">Tap to view & respond</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Avatar + profile popout */}
              <div className="header-dropdown-wrap" ref={avatarRef}>
                <div className="header-user-card" onClick={() => { setAvatarOpen(p => !p); setNotifOpen(false); }}>
                  <div className="header-user-info">
                    <span className="user-greeting">Welcome back,</span>
                    <span className="user-name">{toProperCase(profile?.full_name) || 'Scholar'}</span>
                  </div>
                  <div className="user-avatar-mini">
                    {(profile?.full_name?.[0] || 'S').toUpperCase()}
                    <span className="avatar-online-dot"></span>
                  </div>
                </div>
                {avatarOpen && (
                  <div className="header-dropdown avatar-dropdown">
                    <div className="avatar-dropdown-head">
                      <div className="avatar-dropdown-avatar">
                        {(profile?.full_name?.[0] || 'S').toUpperCase()}
                      </div>
                      <div>
                        <p className="avatar-dropdown-name">{toProperCase(profile?.full_name) || 'Scholar'}</p>
                        <p className="avatar-dropdown-email">{user?.email}</p>
                      </div>
                    </div>
                    <div className="dropdown-divider" />
                    <button className="dropdown-item" onClick={() => { onNavigate('profile'); setAvatarOpen(false); }}>
                      <span>👤</span> View Profile
                    </button>
                    <button className="dropdown-item" onClick={() => { onNavigate('settings'); setAvatarOpen(false); }}>
                      <span>⚙️</span> Settings
                    </button>
                    {isAdmin && (
                      <button className="dropdown-item" onClick={() => { onNavigate('admin'); setAvatarOpen(false); }}>
                        <span>🛡️</span> Command Center
                      </button>
                    )}
                    <div className="dropdown-divider" />
                    <button className="dropdown-item danger" onClick={async () => { await signOut(); onNavigate('landing'); }}>
                      <span>🚪</span> Log Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <main className={`page-overflow-container ${fullBleed ? 'full-bleed' : ''}`}>
            {children}
          </main>
        </div>
      </div>

      {/* Command Palette */}
      {cmdOpen && (
        <div className="cmd-overlay" onClick={() => setCmdOpen(false)}>
          <div className="cmd-palette" onClick={e => e.stopPropagation()}>
            <div className="cmd-input-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="cmd-search-icon">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                ref={cmdInputRef}
                className="cmd-input"
                placeholder="Jump to any page…"
                value={cmdQuery}
                onChange={e => setCmdQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && filteredPages.length > 0) {
                    onNavigate(filteredPages[0].id);
                    setCmdOpen(false);
                  }
                }}
              />
              <span className="cmd-esc-hint">ESC</span>
            </div>
            <div className="cmd-results">
              {filteredPages.length === 0 ? (
                <div className="cmd-empty">No pages found</div>
              ) : (
                filteredPages.map((p, i) => (
                  <button
                    key={p.id}
                    className={`cmd-result-item ${i === 0 ? 'cmd-result-first' : ''}`}
                    onClick={() => { onNavigate(p.id); setCmdOpen(false); }}
                  >
                    <span className="cmd-result-icon">{p.icon}</span>
                    <span className="cmd-result-label">{p.label}</span>
                    {i === 0 && <span className="cmd-result-enter">↵</span>}
                  </button>
                ))
              )}
            </div>
            <div className="cmd-footer">
              <span><kbd>↵</kbd> go</span>
              <span><kbd>ESC</kbd> close</span>
              <span><kbd>⌘K</kbd> toggle</span>
            </div>
          </div>
        </div>
      )}

      {['dashboard', 'settings', 'profile', 'admin', 'pricing', 'customize', 'landing', 'goals', 'analytics'].includes(activeTab) && <SupportWidget />}
    </div>
  );
};

export default Layout;
