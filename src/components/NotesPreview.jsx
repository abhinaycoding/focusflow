import React, { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { useTranslation } from '../contexts/LanguageContext'
import { EmptyArchive } from './EmptyStateIllustrations'
import '../pages/Dashboard.css'

const NotesPreview = ({ onNavigate }) => {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)

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
      }).slice(0, 4)
      setNotes(notesData)
      setLoading(false)
    }, (err) => {
      console.error('Error fetching notes preview:', err.message)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [user])

  const formatDate = (dateVal) => {
    const d = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal)
    const diff = Date.now() - d.getTime()
    const hours = Math.floor(diff / 3600000)
    if (hours < 1) return t('notes.justNow')
    if (hours < 24) return `${hours}${t('notes.hAgo')}`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}${t('notes.dAgo')}`
    return new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="archives-container">
      {loading ? (
        <div className="flex flex-col gap-3">
          <div className="skeleton skeleton-text" style={{ height: '48px' }} />
          <div className="skeleton skeleton-text" style={{ height: '48px', width: '85%' }} />
          <div className="skeleton skeleton-text" style={{ height: '48px', width: '95%' }} />
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-6 opacity-70">
          <EmptyArchive size={100} />
          <p className="font-serif italic mt-2">{t('notes.emptyTitle')}</p>
          <p className="text-xs mt-1 uppercase tracking-widest text-muted">{t('notes.emptySubtitle')}</p>
        </div>
      ) : (
        notes.map(note => (
          <div
            key={note.id}
            className="archive-item cursor-pointer"
            onPointerDown={(e) => {
              // Ignore right clicks
              if (e.button !== 0) return;
              e.preventDefault(); // Stop dnd-kit from starting a drag
              localStorage.setItem('ff_open_note', note.id)
              onNavigate('library')
            }}
          >
            <div className="archive-folder">{note.folder || t('notes.uncategorized')} / {formatDate(note.updated_at)}</div>
            <div className="archive-title hover:italic transition-all">{note.title || t('notes.untitled')}</div>
          </div>
        ))
      )}
      <button
        className="text-sm font-medium uppercase tracking-widest text-accent mt-8 italic cursor-pointer hover:underline"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          onNavigate('library');
        }}
      >
        {t('notes.openLibrary')}
      </button>
    </div>
  )
}

export default NotesPreview
