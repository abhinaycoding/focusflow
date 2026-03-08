import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePlan } from '../contexts/PlanContext';
import './AuraAI.css';
import zuzuMascot from '../assets/zuzu_mascot.png';
import { getZuzuResponse } from '../lib/zuzu-ai';
import ReactMarkdown from 'react-markdown';

const ZuzuMascot = ({ className }) => (
  <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Body/Head */}
    <rect x="15" y="25" width="70" height="60" rx="30" fill="currentColor" fillOpacity="0.1" />
    <rect x="20" y="30" width="60" height="50" rx="25" stroke="currentColor" strokeWidth="3" />
    
    {/* Eyes Container */}
    <rect x="30" y="45" width="40" height="20" rx="10" fill="currentColor" fillOpacity="0.05" />
    
    {/* Eyes */}
    <circle className="zuzu-eye blink" cx="42" cy="55" r="4" fill="currentColor" />
    <circle className="zuzu-eye blink" cx="58" cy="55" r="4" fill="currentColor" />
    
    {/* Antennae */}
    <path d="M50 30V15" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <circle className="zuzu-antenna-tip pulse" cx="50" cy="15" r="3" fill="currentColor" />
  </svg>
);

const AuraAI = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { id: 1, type: 'aura', text: "Greetings, Strategist. I am Zuzu. How shall we optimize your focus today?" }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const { profile } = useAuth();
  const { isPro } = usePlan();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  
  const scrollRef = useRef(null);

  // Detect navigation changes for contextual nudges
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    // Also listen for custom navigation events if the app uses them
    const unsub = setInterval(() => {
      if (window.location.pathname !== currentPath) {
        setCurrentPath(window.location.pathname);
      }
    }, 1000);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      clearInterval(unsub);
    };
  }, [currentPath]);

  // Contextual Nudges
  useEffect(() => {
    const getNudge = () => {
      if (window.location.pathname.includes('library')) {
        return "I see you're in the Library. Would you like me to suggest a Spaced Repetition schedule for your active notes?";
      }
      if (window.location.pathname.includes('dashboard')) {
        return "Your momentum is looking strong today. We have 3 high-priority tasks in the Ledger. Shall we tackle the most difficult one first?";
      }
      if (window.location.pathname.includes('rooms')) {
        return "Focusing with others increases accountability. I recommend joining a room with at least 3 active scholars for maximum resonance.";
      }
      return null;
    };

    const nudgeText = getNudge();
    if (nudgeText) {
      const timer = setTimeout(() => {
        setMessages(prev => {
          if (prev[prev.length - 1]?.text === nudgeText) return prev;
          if (prev.length > 5) return prev; // Don't spam
          return [...prev, { id: Date.now(), type: 'aura', text: nudgeText }];
        });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [currentPath, isOpen]);

  const addAuraMessage = (text) => {
    setMessages(prev => [...prev, { id: Date.now(), type: 'aura', text }]);
  };

  const QUICK_ACTIONS = [
    { label: "Summarize Note", icon: "📄" },
    { label: "Focus Tip", icon: "✨" },
    { label: "Daily Tasks", icon: "🎯" }
  ];

  const handleAction = async (action) => {
    const userMsg = { id: Date.now(), type: 'user', text: action };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    
    try {
      const response = await getZuzuResponse(messages, action);
      addAuraMessage(response);
    } catch (error) {
      addAuraMessage("My quick-action module is refreshing. One moment!");
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const val = input.trim();
    if (!val) return;

    setMessages(prev => [...prev, { id: Date.now(), type: 'user', text: val }]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await getZuzuResponse(messages, val);
      addAuraMessage(response);
    } catch (error) {
      addAuraMessage("Connection lost in Orbit. Let's try that again.");
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  return (
    <div className={`aura-ai-container ${isOpen ? 'aura-open' : 'aura-closed'}`}>
      {/* Neural Toggle Button */}
      <button 
        className="aura-toggle-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle Aura AI"
      >
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 8V4H8" />
          <rect width="16" height="12" x="4" y="8" rx="2" />
          <path d="M2 14h2" />
          <path d="M20 14h2" />
          <path d="M15 13v2" />
          <path d="M9 13v2" />
        </svg>
        <div className="aura-btn-glow" />
        <div className="aura-pulse-core" />
        <div className="aura-pulse-wave" />
      </button>

      {/* Main Panel */}
      <div className={`aura-ai-panel ${isExpanded ? 'aura-expanded' : ''}`}>
        <div className="aura-focus-grid" />
        <div className="aura-scanning-line" />
        
        <div className="aura-ai-header">
          <div className="aura-header-left">
            <div className="aura-orb-avatar mascot">
              <ZuzuMascot className="zuzu-svg-mascot" />
            </div>
            <div className="aura-ai-title">ZUZU</div>
          </div>
          <div className="aura-header-actions">
            <button 
              className="aura-expand-btn" 
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? "Collapse" : "Expand to Sidebar"}
            >
              {isExpanded ? "↙" : "↗"}
            </button>
            <button className="aura-close-btn" onClick={() => setIsOpen(false)}>✕</button>
          </div>
        </div>

        <div className="aura-ai-messages" ref={scrollRef}>
          <div className="aura-welcome-banner">
            <h3>Optimize for excellence</h3>
            <p>Intelligence tailored to your professional focus.</p>
          </div>
          {messages.map(msg => (
            <div key={msg.id} className={`aura-msg-row ${msg.type}`}>
              <div className="aura-msg-bubble">
                {msg.type === 'aura' ? (
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                ) : (
                  msg.text
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="aura-msg-row aura">
              <div className="aura-msg-bubble typing">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
            </div>
          )}
        </div>

        <div className="aura-quick-actions">
          {QUICK_ACTIONS.map(action => (
            <button key={action.label} onClick={() => handleAction(action.label)}>
              <span>{action.icon}</span> {action.label}
            </button>
          ))}
        </div>

        <form className="aura-ai-input-area" onSubmit={handleSend}>
          <input 
            type="text" 
            placeholder="Ask anything..." 
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" className="aura-send-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </form>

        <div className="aura-ai-footer">
          Token-Efficient Mode Active 
          {!isPro && <span className="pro-lock-small">5 Daily Nudges Left</span>}
        </div>
      </div>
    </div>
  );
};

export default AuraAI;
