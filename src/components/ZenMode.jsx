import React, { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useZen } from '../contexts/ZenContext'
import { useTimer } from '../contexts/TimerContext'
import { ZEN_TRACKS, getZenTrack } from '../constants/zenTracks'
import './ZenMode.css'

const ZenMode = () => {
  const { isZenModeActive, exitZenMode, activeTrackId, setActiveTrackId } = useZen()
  const {
    secondsLeft,
    isRunning,
    isComplete,
    start,
    pause,
    reset
  } = useTimer()
  
  const [mounted, setMounted] = useState(false)

  // Audio state
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0.5)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  
  const currentTrack = getZenTrack(activeTrackId)

  const handleExit = () => {
    exitZenMode();
  };

  // Global Keyboard listener for Escape key
  useEffect(() => {
    const handleGlobalKey = (e) => {
      if (e.key === 'Escape') {
        handleExit()
      }
    }
    if (isZenModeActive) {
      window.addEventListener('keydown', handleGlobalKey)
    }
    return () => window.removeEventListener('keydown', handleGlobalKey)
  }, [isZenModeActive, exitZenMode])

  // Audio lifecycle
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
      
      const playAudio = async () => {
        try {
          if (playing) {
            await audioRef.current.play()
          } else {
            audioRef.current.pause()
          }
        } catch (e) {
          console.warn("[ZenMode] Audio play blocked/failed:", e.message)
          setPlaying(false)
        }
      }
      playAudio()
    }
  }, [playing, volume, currentTrack, mounted])



  if (!isZenModeActive) return null

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleTrackChange = (e) => {
    setActiveTrackId(e.target.value)
    setPlaying(true)
  }

  // The actual UI content
  const content = (
    <div 
      className="zen-overlay active" 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        zIndex: 99999999,
        pointerEvents: 'auto',
        opacity: 1
      }}
    >
      
      {/* ABSOLUTE EMERGENCY EXIT - Fixed to avoid layout issues */}
      <button 
        className="zen-exit-focus-action"
        onClick={handleExit}
        onMouseDown={handleExit}
        onTouchStart={handleExit}
        style={{
          position: 'fixed',
          top: '2rem',
          right: '2.5rem',
          zIndex: 100000000,
          cursor: 'pointer',
          pointerEvents: 'all'
        }}
      >
        Exit Focus
      </button>



      <div className="zen-backdrop">
        <div className="zen-orb orb-1"></div>
        <div className="zen-orb orb-2"></div>
      </div>

      <div className="zen-header">
        <div className="zen-brand">NoteNook <span style={{ opacity: 0.5 }}>// Zen</span></div>
        <div style={{ width: 140 }}></div>
      </div>

      <div className="zen-center">
        <div 
          className="zen-timer-display" 
          onClick={() => isRunning ? pause() : start()} 
          style={{ cursor: 'pointer', pointerEvents: 'all' }}
        >
          {formatTime(secondsLeft)}
        </div>
        <div className="zen-timer-label">
          {isComplete ? 'SESSION COMPLETE' : isRunning ? 'DEEP FOCUS ACTIVE' : 'FOCUS PAUSED'}
        </div>
        {isComplete && (
          <button 
            className="zen-exit-focus-action" 
            style={{ marginTop: '2rem', cursor: 'pointer', pointerEvents: 'all', position: 'relative', zIndex: 10 }} 
            onClick={reset}
          >
            Reset Timer
          </button>
        )}
      </div>

      <div className="zen-audio-dock" style={{ pointerEvents: 'all', position: 'relative', zIndex: 10 }}>
        <audio ref={audioRef} src={currentTrack.url} loop />
        
        <div className="zen-audio-controls">
          <button 
            className="zen-play-btn" 
            onClick={() => setPlaying(!playing)}
          >
            {playing ? '⏸' : '▶'}
          </button>
          
          <div className="zen-custom-select-wrapper">
            <button 
              className="zen-track-select-btn"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span>{currentTrack?.name || 'Select Track'}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`zen-chevron ${isDropdownOpen ? 'open' : ''}`}>
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            
            {isDropdownOpen && (
              <>
                <div className="zen-dropdown-overlay" onClick={() => setIsDropdownOpen(false)} />
                <div className="zen-custom-dropdown">
                  {ZEN_TRACKS.map(t => (
                    <button 
                      key={t.id} 
                      className={`zen-dropdown-item ${t.id === activeTrackId ? 'active' : ''}`}
                      onClick={() => {
                        setActiveTrackId(t.id)
                        setPlaying(true)
                        setIsDropdownOpen(false)
                      }}
                    >
                      {t.name}
                      {t.id === activeTrackId && <span className="zen-check">✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="zen-volume">
            <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>🔊</span>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05" 
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="zen-volume-slider"
            />
          </div>
        </div>
      </div>
    </div>
  )

  if (!mounted || !isZenModeActive || !document?.body) return null

  return createPortal(content, document.body)
}

export default ZenMode
