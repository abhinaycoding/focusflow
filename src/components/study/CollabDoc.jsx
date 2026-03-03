import React, { useEffect, useRef, useState, useCallback } from 'react'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import { db } from '../../lib/firebase'
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore'
import './CollabDoc.css'

const SAVE_DEBOUNCE_MS = 1200

const CollabDoc = ({ roomId, channelId, channelName, user }) => {
  const editorRef = useRef(null)
  const quillRef = useRef(null)
  const saveTimerRef = useRef(null)
  const remoteUpdateRef = useRef(false)

  const [saveStatus, setSaveStatus] = useState('saved')  // 'saved' | 'saving' | 'unsaved'
  const [wordCount, setWordCount] = useState(0)

  const docId = `${roomId}_${channelId}`
  const docPath = `room_docs`

  // ── Initialize Quill ─────────────────────────────────────────────────────
  useEffect(() => {
    if (quillRef.current) return

    const quill = new Quill(editorRef.current, {
      theme: 'snow',
      placeholder: `Start writing in #${channelName}...`,
      modules: {
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ color: [] }, { background: [] }],
          ['blockquote', 'code-block'],
          ['clean'],
        ],
      },
    })

    quillRef.current = quill

    // Listen to Firestore for remote changes
    const unsub = onSnapshot(doc(db, docPath, docId), snapshot => {
      if (!snapshot.exists()) return
      const data = snapshot.data()
      if (!data?.delta) return

      // Only apply if not from us
      if (data.last_editor === user.uid) return

      remoteUpdateRef.current = true
      const currentSel = quill.getSelection()
      quill.setContents(data.delta, 'silent')
      if (currentSel) quill.setSelection(currentSel, 'silent')
      remoteUpdateRef.current = false
    })

    // On local change → debounce save
    quill.on('text-change', (delta, oldDelta, source) => {
      if (source !== 'user') return
      if (remoteUpdateRef.current) return

      const text = quill.getText()
      setWordCount(text.trim().split(/\s+/).filter(Boolean).length)
      setSaveStatus('unsaved')

      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        saveToDB(quill.getContents())
      }, SAVE_DEBOUNCE_MS)
    })

    return () => {
      unsub()
      clearTimeout(saveTimerRef.current)
    }
  }, [docId, user.uid, channelName])

  // ── Save to Firestore ────────────────────────────────────────────────────
  const saveToDB = useCallback(async (delta) => {
    setSaveStatus('saving')
    try {
      await setDoc(doc(db, docPath, docId), {
        delta: delta,
        last_editor: user.uid,
        last_editor_name: user.displayName || user.email?.split('@')[0] || 'Scholar',
        updated_at: serverTimestamp(),
        room_id: roomId,
        channel_id: channelId,
      })
      setSaveStatus('saved')
    } catch (err) {
      setSaveStatus('unsaved')
    }
  }, [docId, roomId, channelId, user])

  const statusIcon = {
    saved: { icon: '✓', label: 'Saved', cls: 'saved' },
    saving: { icon: '⏳', label: 'Saving…', cls: 'saving' },
    unsaved: { icon: '●', label: 'Unsaved', cls: 'unsaved' },
  }[saveStatus]

  return (
    <div className="collab-doc-panel">
      {/* Doc Toolbar */}
      <div className="collab-doc-header">
        <div className="collab-doc-title">
          <span className="collab-doc-icon">📄</span>
          <span className="collab-doc-name">#{channelName}</span>
        </div>
        <div className="collab-doc-meta">
          <span className="collab-word-count">{wordCount} words</span>
          <div className={`collab-save-status ${statusIcon.cls}`}>
            <span>{statusIcon.icon}</span>
            <span>{statusIcon.label}</span>
          </div>
        </div>
      </div>

      {/* Quill Editor Container */}
      <div className="collab-doc-editor-wrap">
        <div ref={editorRef} className="collab-doc-editor" />
      </div>
    </div>
  )
}

export default CollabDoc
