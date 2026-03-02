import React, { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, orderBy, serverTimestamp } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useTranslation } from '../contexts/LanguageContext'

const COMMON_EXAMS = ['JEE Main', 'JEE Advanced', 'NEET', 'UPSC', 'GATE', 'CAT', 'Custom']

const ExamPlannerPage = ({ onNavigate }) => {
  const { user } = useAuth()
  const toast = useToast()
  const { t } = useTranslation()
  const [examDate, setExamDate] = useState('')
  const [examName, setExamName] = useState('JEE Main')
  const [customExam, setCustomExam] = useState('')
  const [countdown, setCountdown] = useState(null)
  const [topics, setTopics] = useState([])
  const [newTopic, setNewTopic] = useState('')
  const [newTopicSubject, setNewTopicSubject] = useState('Physics')
  const [saving, setSaving] = useState(false)

  // Load saved exam data
  useEffect(() => {
    const loadExamData = async () => {
      if (!user?.uid) return
      try {
        const savedDate = localStorage.getItem(`ff_exam_date_${user.uid}`)
        const savedName = localStorage.getItem(`ff_exam_name_${user.uid}`)
        if (savedDate) setExamDate(savedDate)
        if (savedName) setExamName(savedName)

        const q = query(
          collection(db, 'tasks'), 
          where('user_id', '==', user.uid),
          where('due_date', '==', 'syllabus'),
          orderBy('created_at', 'asc')
        )
        const snap = await getDocs(q)
        setTopics(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })))

        const profileSnap = await getDoc(doc(db, 'profiles', user.uid))
        if (profileSnap.exists()) {
          const profileData = profileSnap.data()
          if (profileData.target_exam && !savedName) setExamName(profileData.target_exam)
        }
      } catch (err) {
        console.error('Error loading exam data:', err.message)
      }
    }

    loadExamData()
  }, [user?.uid])

  // Save to localStorage
  useEffect(() => {
    if (examDate && user?.uid) localStorage.setItem(`ff_exam_date_${user.uid}`, examDate)
  }, [examDate, user?.uid])

  useEffect(() => {
    if (examName && user?.uid) localStorage.setItem(`ff_exam_name_${user.uid}`, examName)
  }, [examName, user?.uid])

  // Real-time countdown
  useEffect(() => {
    if (!examDate) return
    const tick = setInterval(() => {
      const now = new Date()
      const target = new Date(examDate)
      const diff = target - now
      if (diff <= 0) { setCountdown({ done: true }); return }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      setCountdown({ days, hours, minutes, seconds })
    }, 1000)
    return () => clearInterval(tick)
  }, [examDate])

  const handleAddTopic = async () => {
    if (!newTopic.trim() || !user?.uid) return
    setSaving(true)
    try {
      const payload = {
        user_id: user.uid,
        title: newTopic.trim(),
        due_date: 'syllabus',
        priority: newTopicSubject,
        completed: false,
        created_at: serverTimestamp()
      }
      const docRef = await addDoc(collection(db, 'tasks'), payload)
      setTopics(prev => [...prev, { id: docRef.id, ...payload }])
      setNewTopic('')
      toast(`${newTopicSubject} topic added.`, 'success')
    } catch (err) {
      toast('Failed to add topic.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleTopic = async (id, current) => {
    setTopics(prev => prev.map(t => t.id === id ? { ...t, completed: !current } : t))
    try {
      await updateDoc(doc(db, 'tasks', id), { completed: !current })
      if (!current) toast('Topic covered. Keep going!', 'success')
    } catch (err) {
      console.error(err)
    }
  }

  const deleteTopic = async (id) => {
    setTopics(prev => prev.filter(t => t.id !== id))
    try {
      await deleteDoc(doc(db, 'tasks', id))
      toast('Topic removed.', 'info')
    } catch (err) {
      console.error(err)
    }
  }

  const completedCount = topics.filter(t => t.completed).length
  const progressPct = topics.length > 0 ? Math.round((completedCount / topics.length) * 100) : 0
  const displayExam = examName === 'Custom' ? customExam : examName
  const subjects = [...new Set(topics.map(t => t.priority).filter(Boolean))]

  return (
    <>
      <main className="exam-main container">
        <div className="exam-grid">
          
          <div className="exam-left">
            <div className="exam-setup card">
              <h3 className="section-label">Target Examination</h3>
              <div className="exam-chips-grid">
                {COMMON_EXAMS.filter(e => e !== 'Custom').map(e => (
                  <button
                    key={e}
                    onClick={() => {
                      setExamName(e)
                      setCustomExam('')
                    }}
                    className={`exam-chip ${examName === e ? 'active' : ''}`}
                  >
                    {e}
                  </button>
                ))}
                <button
                  onClick={() => setExamName('Custom')}
                  className={`exam-chip ${examName === 'Custom' ? 'active' : ''}`}
                >
                  Custom
                </button>
              </div>
              
              {examName === 'Custom' && (
                <input
                  type="text"
                  placeholder="Type your exam name..."
                  value={customExam}
                  onChange={e => setCustomExam(e.target.value)}
                  className="w-full bg-transparent border-b border-ink outline-none py-2 font-serif text-xl mb-4 mt-4"
                  autoFocus
                />
              )}

              <h3 className="section-label mt-8">Examination Date</h3>
              <div className="date-picker-wrapper">
                <input
                  type="date"
                  value={examDate}
                  onChange={e => setExamDate(e.target.value)}
                  className="form-input date-input"
                  style={{ fontSize: '1.25rem' }}
                />
              </div>
            </div>

            {countdown && !countdown.done ? (
              <div className="countdown-display">
                <div className="countdown-title">{displayExam || 'Exam'} in</div>
                <div className="countdown-numbers">
                  <div className="countdown-unit">
                    <span className="countdown-num">{String(countdown.days).padStart(3, '0')}</span>
                    <span className="countdown-label">Days</span>
                  </div>
                  <div className="countdown-sep">:</div>
                  <div className="countdown-unit">
                    <span className="countdown-num">{String(countdown.hours).padStart(2, '0')}</span>
                    <span className="countdown-label">Hrs</span>
                  </div>
                  <div className="countdown-sep">:</div>
                  <div className="countdown-unit">
                    <span className="countdown-num">{String(countdown.minutes).padStart(2, '0')}</span>
                    <span className="countdown-label">Min</span>
                  </div>
                  <div className="countdown-sep">:</div>
                  <div className="countdown-unit">
                    <span className="countdown-num">{String(countdown.seconds).padStart(2, '0')}</span>
                    <span className="countdown-label">Sec</span>
                  </div>
                </div>
              </div>
            ) : countdown?.done ? (
              <div className="countdown-display text-center">
                <p className="font-serif text-2xl text-primary">Examination Day has arrived. Best of luck, Scholar.</p>
              </div>
            ) : (
              <div className="countdown-display opacity-40">
                <div className="countdown-title">Select a date to begin countdown</div>
              </div>
            )}
          </div>

          <div className="exam-right">
            <div className="syllabus-header">
              <h3 className="section-label">Syllabus Tracker</h3>
              <div className="progress-bar-wrap">
                <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="text-xs text-muted uppercase tracking-widest mt-1">
                {completedCount} / {topics.length} topics covered — {progressPct}%
              </div>
            </div>

            <div className="add-topic-row">
              <select
                value={newTopicSubject}
                onChange={e => setNewTopicSubject(e.target.value)}
                className="subject-select"
              >
                {['Physics', 'Chemistry', 'Mathematics', 'Biology', 'History', 'Geography', 'Economics', 'Other'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Add a topic..."
                value={newTopic}
                onChange={e => setNewTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTopic()}
                className="topic-input"
              />
              <button onClick={handleAddTopic} className="btn-icon" disabled={saving}>+</button>
            </div>

            <div className="topics-list">
              {subjects.length === 0 && (
                <p className="text-xs text-muted italic mt-4">No topics yet. Add chapters from your syllabus.</p>
              )}
              {subjects.map(subject => (
                <div key={subject} className="subject-group">
                  <div className="subject-group-title">{subject}</div>
                  {topics.filter(t => t.priority === subject).map(topic => (
                    <div key={topic.id} className={`topic-row ${topic.completed ? 'done' : ''}`}>
                      <div
                        className={`ledger-check cursor-pointer ${topic.completed ? 'done' : ''}`}
                        onClick={() => toggleTopic(topic.id, topic.completed)}
                      />
                      <span className="topic-title">{topic.title}</span>
                      <button onClick={() => deleteTopic(topic.id)} className="note-delete-btn" style={{ opacity: 0.4 }}>×</button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

        </div>
      </main>
    </>
  )
}

export default ExamPlannerPage
