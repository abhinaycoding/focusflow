import React, { useState } from 'react'
import { db } from '../../lib/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { useToast } from '../../contexts/ToastContext'
import './ChannelList.css'

const DEFAULT_CHANNELS = [
  // Text
  { id: 'general',       name: 'general',       icon: '#',  type: 'text',         locked: false },
  { id: 'resources',     name: 'resources',      icon: '📚', type: 'text',         locked: false },
  { id: 'questions',     name: 'questions',      icon: '❓', type: 'text',         locked: false },
  { id: 'announcements', name: 'announcements',  icon: '📢', type: 'announcement', locked: true  },
  // Voice
  { id: 'voice-general', name: 'General Voice',  icon: '🔊', type: 'voice',        locked: false },
  { id: 'voice-study',   name: 'Study Together', icon: '🎙️', type: 'voice',        locked: false },
  // Docs
  { id: 'doc-notes',     name: 'Study Notes',    icon: '📝', type: 'doc',          locked: false },
]

const groupChannels = (channels) => {
  const groups = { text: [], voice: [], doc: [] }
  channels.forEach(ch => {
    if (ch.type === 'announcement') groups.text.push(ch)
    else if (ch.type === 'voice') groups.voice.push(ch)
    else if (ch.type === 'doc') groups.doc.push(ch)
    else groups.text.push(ch)
  })
  return groups
}

const ChannelList = ({ roomId, activeChannelId, onSelectChannel, channels, isOwner, collapsed, onToggle }) => {
  const toast = useToast()
  const [newChanName, setNewChanName] = useState('')
  const [newChanType, setNewChanType] = useState('text')
  const [showAdd, setShowAdd] = useState(false)
  const [adding, setAdding] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const allChannels = [...DEFAULT_CHANNELS, ...channels]
  const groups = groupChannels(allChannels)

  const typeIcons = { text: '#', voice: '🔊', doc: '📝' }

  const handleAddChannel = async () => {
    if (!newChanName.trim() || !isOwner) return
    setAdding(true)
    const slugName = newChanName.trim().toLowerCase().replace(/\s+/g, '-')
    const iconMap = { text: '#', voice: '🔊', doc: '📝', announcement: '📢' }
    try {
      await addDoc(collection(db, 'room_channels'), {
        room_id: roomId,
        name: slugName,
        type: newChanType,
        locked: false,
        icon: iconMap[newChanType] || '#',
        created_at: serverTimestamp(),
      })
      setNewChanName('')
      setShowAdd(false)
      toast('Channel created! 🎉', 'success')
    } catch (err) {
      toast('Failed to create channel.', 'error')
    } finally {
      setAdding(false)
    }
  }

  const renderSection = (label, channelList, sectionType) => {
    if (channelList.length === 0) return null
    return (
      <div className="channel-section" key={label}>
        <div className="channel-section-label">
          <span>{label}</span>
          {isOwner && (
            <button
              className="channel-add-btn"
              title={`Add ${sectionType} channel`}
              onClick={() => { setNewChanType(sectionType); setShowAdd(!showAdd) }}
            >+</button>
          )}
        </div>
        <div className="channel-items">
          {channelList.map(ch => {
            const isActive = activeChannelId === ch.id
            return (
              <button
                key={ch.id}
                className={`channel-item channel-item--${ch.type} ${isActive ? 'active' : ''}`}
                onClick={() => onSelectChannel(ch)}
              >
                <span className="channel-icon">{ch.icon}</span>
                <span className="channel-name">{ch.name}</span>
                {ch.type === 'announcement' && <span className="channel-locked-tag">owner only</span>}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className={`channel-list ${collapsed ? 'collapsed' : ''}`}>
      {/* Header */}
      <div className="channel-list-header-wrap">
        <div 
          className="channel-list-header" 
          onClick={() => {
            if (collapsed) onToggle();
            else setMenuOpen(!menuOpen);
          }}
          title={collapsed ? "Click to Expand Sidebar" : "Server Menu"}
        >
          <div className="channel-list-title">
            <span className="channel-list-server-icon">
              {collapsed ? (
                <span className="expand-hint">»</span>
              ) : '📚'}
            </span>
            {!collapsed && <span className="channel-list-server-name">Study Room</span>}
          </div>
          {!collapsed && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`channel-dropdown-icon ${menuOpen ? 'open' : ''}`}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          )}
        </div>

        {/* Dropdown Menu */}
        {!collapsed && menuOpen && (
          <>
            <div className="channel-menu-overlay" onClick={() => setMenuOpen(false)} />
            <div className="channel-list-menu">
              {isOwner && (
                <button className="channel-menu-item" onClick={() => { setShowAdd(true); setMenuOpen(false); }}>
                  <span>Create Channel</span>
                  <span className="channel-menu-icon">+</span>
                </button>
              )}
              <button className="channel-menu-item" onClick={() => { onToggle(); setMenuOpen(false); }}>
                <span>Collapse Sidebar</span>
                <span className="channel-menu-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                </span>
              </button>
            </div>
          </>
        )}
      </div>

      {!collapsed && (
        <div className="channel-list-scroller">
          {renderSection('TEXT CHANNELS', groups.text, 'text')}
          {renderSection('VOICE CHANNELS', groups.voice, 'voice')}
          {renderSection('DOC CHANNELS', groups.doc, 'doc')}

          {/* Add Channel Panel */}
          {showAdd && isOwner && (
            <div className="channel-add-panel">
              <div className="channel-type-selector">
                {['text', 'voice', 'doc'].map(t => (
                  <button
                    key={t}
                    className={`channel-type-btn ${newChanType === t ? 'active' : ''}`}
                    onClick={() => setNewChanType(t)}
                  >
                    {typeIcons[t]} {t}
                  </button>
                ))}
              </div>
              <input
                autoFocus
                className="channel-add-input"
                placeholder={newChanType === 'voice' ? 'Voice Room Name' : newChanType === 'doc' ? 'Doc Name' : 'channel-name'}
                value={newChanName}
                onChange={e => setNewChanName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddChannel()}
              />
              <div className="channel-add-actions">
                <button className="channel-cancel-btn" onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="channel-create-btn" onClick={handleAddChannel} disabled={adding || !newChanName.trim()}>
                  {adding ? '...' : 'Create'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ChannelList
