import React from 'react';
import './MaintenanceMode.css';

const MaintenanceMode = () => {
  return (
    <div className="maintenance-container">
      <div className="maintenance-glow"></div>
      
      <div className="maintenance-content">
        <div className="maintenance-icon">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M12 8V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M11 12H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        
        <h1 className="maintenance-title">Platform Updating</h1>
        
        <p className="maintenance-text">
          FocusFlow is currently undergoing scheduled maintenance to improve system stability and deploy new features. We'll be back online shortly.
        </p>
        
        <div className="maintenance-status">
          <div className="status-dot"></div>
          <span className="status-text">SYSTEM OFFLINE • UPGRADING CORE</span>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceMode;
