import React from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '../contexts/AuthContext';
import './Layout.css';

const Layout = ({ children, onNavigate, activeTab, fullBleed = false }) => {

  const { profile } = useAuth();

  return (
    <div className="app-layout">
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
  );
};

export default Layout;
