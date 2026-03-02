import { useState } from 'react'
import Navigation from '../components/Navigation'
import { ARCHETYPES } from '../constants/archetypes'
import { useTranslation } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { db } from '../lib/firebase'
import { doc, setDoc } from 'firebase/firestore'
import './ProfileSetup.css'

const ProfileSetup = ({ onNavigate }) => {
  const { t } = useTranslation()
  const { user, profile, refreshProfile } = useAuth()
  
  const [studentType, setStudentType] = useState(profile?.student_type || 'High School')
  const [targetExam, setTargetExam] = useState(profile?.target_exam || '')
  const [examDate, setExamDate] = useState(profile?.exam_date || '')
  const [isCustomExam, setIsCustomExam] = useState(false)
  const [goals, setGoals] = useState(profile?.goals || '')
  const [avatarId, setAvatarId] = useState(profile?.avatar_id || 'owl')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const EXAM_OPTIONS = ['JEE Main', 'JEE Advanced', 'NEET', 'UPSC', 'GATE', 'CAT']

  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      if (!user?.uid) throw new Error('No user ID found! Are you logged out?')

      const payload = {
        id: user.uid,
        student_type: studentType,
        target_exam: targetExam,
        exam_date: examDate,
        goals: goals,
        avatar_id: avatarId,
        updated_at: new Date().toISOString()
      }

      const docRef = doc(db, 'profiles', user.uid)
      await setDoc(docRef, payload, { merge: true })
      
      await refreshProfile()
      onNavigate('dashboard')

    } catch (error) {
      console.error('Profile save error:', error)
      setErrorMsg(error.message || 'An error occurred while saving your profile.')
    } finally {
      setLoading(false)
    }
  }

  const handleExamSelect = (exam) => {
    if (exam === 'Custom') {
      setIsCustomExam(true)
      setTargetExam('')
    } else {
      setIsCustomExam(false)
      setTargetExam(exam)
    }
  }

  return (
    <div className="setup-container">
      <div className="setup-bg-orb orb-1" />
      <div className="setup-bg-orb orb-2" />
      
      <Navigation onNavigate={onNavigate} isAuthPage={true} />
      
      <main className="setup-main">
        <div className="setup-card">
          <div className="setup-header">
            <h2 className="setup-title font-serif">
              {t('profile.title') || 'The Ledger Awaits.'}
            </h2>
            <p className="setup-subtitle">
              {t('profile.subtitle') || 'Configure your academic profile'}
            </p>
          </div>

          {errorMsg && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '0.875rem', fontWeight: 500, wordBreak: 'break-all', background: 'rgba(204, 75, 44, 0.05)' }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="setup-form">
            <div className="form-group">
              <label className="form-label">Current Status</label>
              <div className="exam-chips-grid">
                {['High School', 'University', 'Competitive Exam', 'Professional Development'].map(type => (
                  <button
                    key={type}
                    type="button"
                    className={`exam-chip ${studentType === type ? 'active' : ''}`}
                    onClick={() => setStudentType(type)}
                    style={{ fontSize: '0.65rem', padding: '0.5rem 1rem' }}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Target Examination</label>
              <div className="exam-chips-grid">
                {EXAM_OPTIONS.map(exam => (
                  <button
                    key={exam}
                    type="button"
                    className={`exam-chip ${targetExam === exam ? 'active' : ''}`}
                    onClick={() => handleExamSelect(exam)}
                  >
                    {exam}
                  </button>
                ))}
                <button
                  type="button"
                  className={`exam-chip ${isCustomExam ? 'active' : ''}`}
                  onClick={() => handleExamSelect('Custom')}
                >
                  Custom
                </button>
              </div>

              {isCustomExam && (
                <input 
                  className="form-input mt-4"
                  type="text" 
                  required 
                  value={targetExam}
                  onChange={(e) => setTargetExam(e.target.value)}
                  placeholder="Type your exam name..."
                  autoFocus
                />
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Examination Date</label>
              <div className="date-picker-wrapper">
                <input 
                  className="form-input date-input"
                  type="date" 
                  required 
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Primary Goal</label>
              <textarea 
                className="form-textarea"
                required 
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder="e.g. Score 99 percentile, maintain 3.8 GPA"
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t('profile.choosePersona')}</label>
              <div className="persona-grid">
                {ARCHETYPES.map((arch) => {
                  const isSelected = avatarId === arch.id;
                  return (
                    <button
                      key={arch.id}
                      type="button"
                      className={`persona-card ${isSelected ? 'active' : ''}`}
                      onClick={() => setAvatarId(arch.id)}
                    >
                      {isSelected && (
                        <div style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: arch.accent,
                          boxShadow: `0 0 10px ${arch.accent}`,
                          zIndex: 2
                        }} />
                      )}
                      <span className="persona-emoji" style={isSelected ? {} : { filter: 'grayscale(50%)', opacity: 0.6 }}>
                        {arch.emoji}
                      </span>
                      <span className="persona-name" style={isSelected ? { color: arch.accent } : {}}>
                        {arch.name}
                      </span>
                      <span className="persona-desc">{arch.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="setup-submit"
            >
              {loading ? t('profile.initializing') || 'Initializing...' : t('profile.completeRegistration') || 'Complete Registration'}
            </button>
          </form>
        </div>
      </main>

      <footer className="setup-footer">
        <div>NoteNook Publishing © 2026</div>
        <div>All Rights Reserved</div>
      </footer>
    </div>
  )
}

export default ProfileSetup
