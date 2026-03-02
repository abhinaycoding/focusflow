import React, { useState, useEffect, useRef } from 'react'
import { db } from '../lib/firebase'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'

const NoteEditor = ({ note, onUpdate }) => {
  const [title, setTitle] = useState(note.title || '')
  const [content, setContent] = useState(note.content || '')
  const [folder, setFolder] = useState(note.folder || 'Uncategorized')
  const [saveStatus, setSaveStatus] = useState('Saved')
  const [wordCount, setWordCount] = useState(0)

  const { user } = useAuth()
  const saveTimeoutRef = useRef(null)

  // Sync state when switching notes
  useEffect(() => {
    setTitle(note.title || '')
    setContent(note.content || '')
    setFolder(note.folder || 'Uncategorized')
    setSaveStatus('Saved')
    countWords(note.content || '')
  }, [note.id, note.title, note.content, note.folder])

  const countWords = (text) => {
    const words = text.trim().split(/\s+/).filter(Boolean)
    setWordCount(words.length)
  }

  const debounceSave = (updatedFields) => {
    if (!user?.uid) return
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    setSaveStatus('Saving...')
    onUpdate(note.id, updatedFields)

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const docRef = doc(db, 'notes', note.id)
        await updateDoc(docRef, { 
          ...updatedFields, 
          updated_at: serverTimestamp() 
        })
        setSaveStatus('✓ Saved')
      } catch (err) {
        console.error('Auto-save error:', err.message)
        setSaveStatus('⚠ Error')
      }
    }, 900)
  }

  const handleTitleChange = (e) => {
    setTitle(e.target.value)
    debounceSave({ title: e.target.value })
  }

  const handleContentChange = (e) => {
    setContent(e.target.value)
    countWords(e.target.value)
    // NOTE: This triggers debounceSave with { content } but lacks title/folder.
    // Our PATCH correctly only updates the passed fields because we use spread.
    debounceSave({ content: e.target.value })
  }

  const handleFolderChange = (e) => {
    setFolder(e.target.value)
    debounceSave({ folder: e.target.value })
  }

  // Clean up timeout on unmount
  useEffect(() => {
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }
  }, [])

  return (
    <div className="note-editor-wrapper">
      <header className="editor-header">
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          placeholder="Document Title"
          className="editor-title-input"
        />
        <div className="editor-meta-bar">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted uppercase tracking-widest">Folder:</span>
            <input
              type="text"
              value={folder}
              onChange={handleFolderChange}
              placeholder="Folder Name"
              className="editor-folder-input"
            />
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {wordCount > 0 ? `${wordCount} words` : ''}
            </span>
            <span className={`save-status ${saveStatus.includes('Error') ? 'text-danger' : ''}`}>
              {saveStatus}
            </span>
          </div>
        </div>
      </header>

      <textarea
        className="editor-textarea"
        value={content}
        onChange={handleContentChange}
        placeholder="Begin your treatise here..."
      />
    </div>
  )
}

export default NoteEditor
