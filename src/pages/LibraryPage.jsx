import React, { useState, useEffect, useCallback } from 'react'

import NoteEditor from '../components/NoteEditor'
import ProGate from '../components/ProGate'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { usePlan } from '../contexts/PlanContext'
import { useTranslation } from '../contexts/LanguageContext'
import { db } from '../lib/firebase'
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc,
  serverTimestamp 
} from 'firebase/firestore'
import './LibraryPage.css'

const LibraryPage = ({ onNavigate }) => {
  const { user } = useAuth()
  const { isPro } = usePlan()
  const { t } = useTranslation()
  const toast = useToast()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeNoteId, setActiveNoteId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFolder, setActiveFolder] = useState('All')
  const hasReachedLimit = !isPro && notes.length >= 10
  
  // Real-time subscription to notes
  useEffect(() => {
    if (!user?.uid) return
    
    const q = query(
      collection(db, 'notes'),
      where('user_id', '==', user.uid)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => {
        const da = a.updated_at?.toDate ? a.updated_at.toDate() : new Date(a.updated_at)
        const db = b.updated_at?.toDate ? b.updated_at.toDate() : new Date(b.updated_at)
        return db - da
      })
      setNotes(notesData)
      setLoading(false)

      // Check if we navigated here from Dashboard Archives
      const pendingNoteId = localStorage.getItem('ff_open_note')
      if (pendingNoteId) {
        setActiveNoteId(pendingNoteId)
        localStorage.removeItem('ff_open_note')
        
        const targetNote = notesData.find(n => n.id === pendingNoteId)
        if (targetNote?.folder && targetNote.folder !== 'Uncategorized') {
          setActiveFolder(targetNote.folder)
        }
      }
    }, (err) => {
      console.error('Firestore notes error:', err.message)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [user])

  const handleCreateNote = async () => {
    if (!user?.uid) return
    try {
      const newNote = {
        user_id: user.uid,
        title: 'Untitled Document',
        content: '',
        folder: activeFolder === 'All' ? 'Uncategorized' : activeFolder,
        updated_at: serverTimestamp()
      }
      
      const docRef = await addDoc(collection(db, 'notes'), newNote)
      setActiveNoteId(docRef.id)
      toast('New manuscript created.', 'success')
    } catch (error) {
      toast('Failed to create note.', 'error')
      console.error('Error creating note:', error.message)
    }
  }

  const handleDeleteNote = async (id) => {
    if (!window.confirm('Erase this manuscript permanently?')) return;
    if (!user?.uid) return;
    
    try {
      await deleteDoc(doc(db, 'notes', id))
      if (activeNoteId === id) setActiveNoteId(null)
      toast('Manuscript erased from the Archives.', 'info')
    } catch (error) {
      toast('Failed to delete note.', 'error')
      console.error('Error deleting note:', error.message)
    }
  }

  const handleUpdateNote = (id, updatedFields) => {
    // This handles state updates passed from NoteEditor (which does the DB save)
    setNotes(prev => prev.map(note => note.id === id ? { ...note, ...updatedFields } : note))
  }

  // Derive folders dynamically from notes
  const folders = ['All', ...new Set(notes.map(n => n.folder).filter(Boolean))]

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (note.content || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFolder = activeFolder === 'All' || note.folder === activeFolder
    return matchesSearch && matchesFolder
  })

  // Find the active note object
  const activeNote = notes.find(n => n.id === activeNoteId)

  return (
    <div className="canvas-layout">
      <header className="canvas-header container">
        <div className="flex justify-between items-center border-b border-ink pb-4 pt-4">
          <div className="flex items-center gap-4">
            <div className="logo-mark font-serif cursor-pointer text-4xl text-primary" onClick={() => onNavigate('dashboard')}>NN.</div>
            <h1 className="text-xl font-serif text-muted italic ml-4 pl-4" style={{ borderLeft: '1px solid var(--border)' }}>The Library</h1>
          </div>
          <button onClick={() => onNavigate('dashboard')} className="uppercase tracking-widest text-xs font-bold text-muted hover:text-primary transition-colors cursor-pointer">
            ← {t('nav.dashboard')}
          </button>
        </div>
      </header>

      <main className="library-container">
        
        {/* Left Pane: Directory */}
        <aside className="library-directory">
          <div className="directory-header">
            <h2 className="text-xl font-serif">The Archives</h2>
            <button 
              onClick={handleCreateNote} 
              className={`btn-icon ${hasReachedLimit ? 'opacity-50 cursor-not-allowed' : ''}`} 
              disabled={hasReachedLimit}
              aria-label="New Note"
              title={hasReachedLimit ? "Limit reached" : "New Note"}
            >
              +
            </button>
          </div>

          <div className="directory-search">
            <input 
              type="text" 
              placeholder="Search manuscripts..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="directory-folders">
            {folders.map(folder => (
              <button 
                key={folder}
                onClick={() => setActiveFolder(folder)}
                className={`folder-btn ${activeFolder === folder ? 'active' : ''}`}
              >
                {folder}
              </button>
            ))}
          </div>

          <div className="directory-list">
            {loading ? (
              <div className="text-xs text-muted italic">Dusting off the shelves...</div>
            ) : filteredNotes.length === 0 ? (
              <div className="text-xs text-muted italic">No manuscripts found.</div>
            ) : (
              filteredNotes.map(note => (
                <div 
                  key={note.id} 
                  className={`note-row ${activeNoteId === note.id ? 'active' : ''}`}
                >
                  <div 
                    className="note-row-content"
                    onClick={() => setActiveNoteId(note.id)}
                  >
                    <div className="note-row-title">{note.title || 'Untitled'}</div>
                    <div className="note-row-meta">
                      {new Date(note.updated_at?.toDate ? note.updated_at.toDate() : note.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDeleteNote(note.id)}
                    className="note-delete-btn"
                    title="Delete manuscript"
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Right Pane: Editor */}
        <section className="library-editor-pane">
          {activeNote ? (
            <NoteEditor 
              note={activeNote} 
              onUpdate={handleUpdateNote} 
              user={user} 
            />
          ) : (
            <div className="empty-editor-state">
              {hasReachedLimit ? (
                <ProGate feature="manuscripts" inline onNavigatePricing={onNavigate} />
              ) : (
                <>
                  <h3 className="text-3xl font-serif text-muted">Select a manuscript to begin drafting.</h3>
                  <p className="text-sm uppercase tracking-widest text-muted mt-4">Or inscribe a new one.</p>
                </>
              )}
            </div>
          )}
        </section>

      </main>
    </div>
  )
}

export default LibraryPage
