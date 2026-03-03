import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import MaintenanceMode from './MaintenanceMode';
import SupportWidget from './SupportWidget';
import './Layout.css';

const Layout = ({ children, onNavigate, activeTab, fullBleed = false }) => {
  const { profile } = useAuth();
  const [globalSettings, setGlobalSettings] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) setGlobalSettings(docSnap.data());
    });
    return () => unsub();
  }, []);

  const isMaintenance = globalSettings?.maintenance_active === true;
  const isAdmin = profile?.isAdmin === true;

  if (isMaintenance && !isAdmin) {
    return <MaintenanceMode />;
  }

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
        <Sidebar 
          onNavigate={onNavigate} 
          activeTab={activeTab}
        />
        <div className="main-content-wrapper">
          <header className="main-header">
             <div className="header-breadcrumbs">
                <span className="breadcrumb-path">NoteNook</span>
                {activeTab && (
                  <>
                    <span className="breadcrumb-sep">/</span>
                    <span className="breadcrumb-current capitalize">{activeTab}</span>
                  </>
                )}
             </div>
             <div className="header-user">
                <span className="user-name">{profile?.full_name || 'Scholar'}</span>
                <div className="user-avatar-mini" style={{ background: 'var(--primary)' }}>
                  {profile?.full_name?.[0] || 'S'}
                </div>
             </div>
          </header>
          <main className={`page-overflow-container ${fullBleed ? 'full-bleed' : ''}`}>
            {children}
          </main>
        </div>
      </div>
      {['dashboard', 'settings', 'profile', 'admin', 'pricing', 'customize', 'landing', 'goals', 'analytics'].includes(activeTab) && <SupportWidget />}
    </div>
  );
};

export default Layout;
