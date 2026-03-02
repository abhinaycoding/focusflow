import React, { useState, useEffect, useRef } from 'react'
import { db } from '../lib/firebase'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useTranslation } from '../contexts/LanguageContext'
import './ResumeBuilderPage.css'

const SECTION_TYPES = ['Education', 'Experience', 'Skills', 'Projects', 'Achievements', 'Certifications']

const defaultResume = {
  name: '',
  tagline: '',
  email: '',
  phone: '',
  linkedin: '',
  sections: []
}

const ResumeBuilderPage = ({ onNavigate }) => {
  const { user, profile } = useAuth()
  const toast = useToast()
  const { t } = useTranslation()
  const [resume, setResume] = useState({
    ...defaultResume,
    name: profile?.full_name || '',
    email: user?.email || ''
  })
  const [activeSection, setActiveSection] = useState(null)
  const [newSectionType, setNewSectionType] = useState('Education')
  const [printing, setPrinting] = useState(false)
  const [loading, setLoading] = useState(true)
  const saveTimeoutRef = useRef(null)

  // Load from Firestore
  useEffect(() => {
    if (!user?.uid) return

    const loadResume = async () => {
      try {
        const docRef = doc(db, 'resumes', user.uid)
        const docSnap = await getDoc(docRef)
        if (docSnap.exists()) {
          setResume(docSnap.data())
        }
      } catch (err) {
        console.error('Failed to load resume:', err)
      } finally {
        setLoading(false)
      }
    }

    loadResume()
  }, [user?.uid])

  // Debounced Auto-save
  useEffect(() => {
    if (loading || !user?.uid) return

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await setDoc(doc(db, 'resumes', user.uid), {
          ...resume,
          user_id: user.uid,
          updated_at: serverTimestamp()
        })
      } catch (err) {
        console.error('Auto-save failed:', err)
      }
    }, 2000)

    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }
  }, [resume, user?.uid, loading])

  const updateField = (field, value) => {
    setResume(prev => ({ ...prev, [field]: value }))
  }

  const addSection = () => {
    const newSec = { id: Date.now(), type: newSectionType, entries: [] }
    setResume(prev => ({ ...prev, sections: [...prev.sections, newSec] }))
    setActiveSection(newSec.id)
    toast(`${newSectionType} section added.`, 'success')
  }

  const removeSection = (id) => {
    setResume(prev => ({ ...prev, sections: prev.sections.filter(s => s.id !== id) }))
    if (activeSection === id) setActiveSection(null)
    toast('Section removed.', 'info')
  }

  const addEntry = (sectionId) => {
    setResume(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === sectionId
          ? { ...s, entries: [...s.entries, { id: Date.now(), title: '', subtitle: '', date: '', description: '' }] }
          : s
      )
    }))
  }

  const updateEntry = (sectionId, entryId, field, value) => {
    setResume(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === sectionId
          ? {
              ...s,
              entries: s.entries.map(e =>
                e.id === entryId ? { ...e, [field]: value } : e
               )
            }
          : s
      )
    }))
  }

  const removeEntry = (sectionId, entryId) => {
    setResume(prev => ({
      ...prev,
      sections: prev.sections.map(s =>
        s.id === sectionId
          ? { ...s, entries: s.entries.filter(e => e.id !== entryId) }
          : s
      )
    }))
  }

  const handlePrint = () => {
    setPrinting(true)
    toast('Preparing your resume for export…', 'info', 2000)
    setTimeout(() => {
      window.print()
      setPrinting(false)
    }, 200)
  }

  return (
    <div className={printing ? 'print-mode' : ''}>
      {!printing && (
        <div className="flex justify-end p-4 no-print">
          <button onClick={handlePrint} className="btn-primary">Export PDF</button>
        </div>
      )}

      <main className="resume-main">
        {/* Editor Panel */}
        <aside className="resume-editor no-print">
          <h3 className="section-label">Personal Info</h3>
          <div className="editor-fields">
            {[
              { field: 'name', placeholder: 'Full Name' },
              { field: 'tagline', placeholder: 'Tagline / Role' },
              { field: 'email', placeholder: 'Email' },
              { field: 'phone', placeholder: 'Phone' },
              { field: 'linkedin', placeholder: 'LinkedIn / Portfolio URL' },
            ].map(({ field, placeholder }) => (
              <input
                key={field}
                type="text"
                placeholder={placeholder}
                value={resume[field]}
                onChange={e => updateField(field, e.target.value)}
                className="editor-field-input"
              />
            ))}
          </div>

          <div className="editor-divider" />

          <h3 className="section-label">Sections</h3>
          <div className="add-section-row">
            <select value={newSectionType} onChange={e => setNewSectionType(e.target.value)} className="subject-select">
              {SECTION_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <button onClick={addSection} className="btn-icon">+</button>
          </div>

          {resume.sections.map(section => (
            <div key={section.id} className={`editor-section-block ${activeSection === section.id ? 'active' : ''}`}>
              <div className="editor-section-header" onClick={() => setActiveSection(activeSection === section.id ? null : section.id)}>
                <span className="section-type-label">{section.type}</span>
                <div className="flex gap-2">
                  <button onClick={(e) => { e.stopPropagation(); addEntry(section.id) }} className="text-xs text-accent hover:underline">+ Entry</button>
                  <button onClick={(e) => { e.stopPropagation(); removeSection(section.id) }} className="text-xs text-danger hover:underline">✕</button>
                </div>
              </div>

              {activeSection === section.id && section.entries.map(entry => (
                <div key={entry.id} className="entry-block">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-muted">Entry</span>
                    <button onClick={() => removeEntry(section.id, entry.id)} className="text-xs text-danger">✕</button>
                  </div>
                  {[
                    { f: 'title', p: 'Title / Degree / Company' },
                    { f: 'subtitle', p: 'Institution / Location' },
                    { f: 'date', p: 'Date Range (e.g. 2022–2024)' },
                    { f: 'description', p: 'Description / Achievement' },
                  ].map(({ f, p }) => (
                    <input
                      key={f}
                      type="text"
                      placeholder={p}
                      value={entry[f]}
                      onChange={e => updateEntry(section.id, entry.id, f, e.target.value)}
                      className="entry-field-input"
                    />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </aside>

        {/* Live Preview */}
        <div className="resume-preview" id="resume-print-area">
          <div className="resume-doc">
            {/* Header */}
            <div className="resume-header-block">
              <h1 className="resume-name">{resume.name || 'Your Name'}</h1>
              {resume.tagline && <p className="resume-tagline">{resume.tagline}</p>}
              <div className="resume-contact">
                {resume.email && <span>{resume.email}</span>}
                {resume.phone && <><span className="sep">·</span><span>{resume.phone}</span></>}
                {resume.linkedin && <><span className="sep">·</span><span>{resume.linkedin}</span></>}
              </div>
            </div>

            <div className="resume-divider" />

            {/* Sections */}
            {resume.sections.map(section => (
              <div key={section.id} className="resume-section">
                <div className="resume-section-title">{section.type}</div>
                {section.entries.map(entry => (
                  <div key={entry.id} className="resume-entry">
                    <div className="resume-entry-top">
                      <strong className="entry-title">{entry.title || 'Title'}</strong>
                      {entry.date && <span className="entry-date">{entry.date}</span>}
                    </div>
                    {entry.subtitle && <div className="entry-subtitle">{entry.subtitle}</div>}
                    {entry.description && <div className="entry-desc">{entry.description}</div>}
                  </div>
                ))}
              </div>
            ))}

            {resume.sections.length === 0 && (
              <p className="text-muted italic text-sm mt-4">Add sections from the panel to begin your manuscript.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default ResumeBuilderPage
