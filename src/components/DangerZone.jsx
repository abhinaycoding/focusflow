import React, { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import { collection, query, where, getDocs, updateDoc, doc, increment } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { useTranslation } from '../contexts/LanguageContext'
import '../pages/Dashboard.css' // uses ledger styles

const DangerZone = () => {
  const { user, signOut } = useAuth()
  const { t } = useTranslation()
  const [urgentTasks, setUrgentTasks] = useState([])

  useEffect(() => {
    if (!user?.uid) return

    const fetchUrgent = async () => {
      try {
        const q = query(
          collection(db, 'tasks'), 
          where('user_id', '==', user.uid),
          where('completed', '==', false)
        )
        const snap = await getDocs(q)
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))

        // Filter: priority === 'urgent' OR deadline within 48 hours
        const now = new Date()
        const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000)

        const dangerous = data.filter(t => {
          if (t.priority === 'urgent') return true
          if (t.deadline_at) {
            const deadline = new Date(t.deadline_at)
            return deadline <= in48Hours
          }
          return false
        })

        // Sort by urgency
        dangerous.sort((a, b) => {
          if (a.priority === 'urgent' && b.priority !== 'urgent') return -1
          if (b.priority === 'urgent' && a.priority !== 'urgent') return 1
          if (a.deadline_at && b.deadline_at) {
            return new Date(a.deadline_at) - new Date(b.deadline_at)
          }
          if (a.deadline_at) return -1
          if (b.deadline_at) return 1
          return 0
        })

        setUrgentTasks(dangerous)
      } catch (err) {
        console.error('DangerZone fetch error:', err)
      }
    }

    fetchUrgent()
    
    const interval = setInterval(fetchUrgent, 60000)

    const handleTaskUpdated = (e) => {
      const { id, completed, deleted } = e.detail || {}
      if (completed || deleted) {
        setUrgentTasks(prev => prev.filter(t => t.id !== id))
      } else {
        fetchUrgent()
      }
    }
    window.addEventListener('task-updated', handleTaskUpdated)
    window.addEventListener('task-completed', fetchUrgent)

    return () => {
      clearInterval(interval)
      window.removeEventListener('task-updated', handleTaskUpdated)
      window.removeEventListener('task-completed', fetchUrgent)
    }
  }, [user?.uid])

  const completeTask = async (id) => {
    // Optimistic update
    const taskBackup = urgentTasks.find(t => t.id === id)
    setUrgentTasks(prev => prev.filter(t => t.id !== id))
    window.dispatchEvent(new CustomEvent('task-updated', { detail: { id, completed: true } }))

    try {
      await updateDoc(doc(db, 'tasks', id), { completed: true })
      
      // Award XP: 50 XP per urgent task and total tasks done
      await updateDoc(doc(db, 'profiles', user.uid), {
        xp: increment(50),
        total_tasks_done: increment(1)
      })
    } catch (err) {
      if (taskBackup) {
        setUrgentTasks(prev => [taskBackup, ...prev])
        window.dispatchEvent(new CustomEvent('task-updated', { detail: { id: taskBackup.id, completed: false } }))
      }
    }
  }

  if (urgentTasks.length === 0) return null

  return (
    <div style={{ marginBottom: '3rem', padding: '1.5rem', border: '2px dashed var(--danger)', backgroundColor: 'rgba(204, 75, 44, 0.02)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <h2 className="text-xl font-serif text-danger uppercase tracking-widest font-bold m-0" style={{ color: 'var(--danger)' }}>
          {t('dangerZone.title')}
        </h2>
        <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--danger)', opacity: 0.8 }}>
          {t('dangerZone.subtitle')}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {urgentTasks.map(task => {
          const isOverdue = task.deadline_at && new Date(task.deadline_at) < new Date()
          return (
            <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid rgba(204, 75, 44, 0.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div
                  className="ledger-check cursor-pointer"
                  style={{ borderColor: 'var(--danger)' }}
                  onClick={() => completeTask(task.id)}
                  title={t('dangerZone.markComplete')}
                />
                <div className="font-serif text-lg" style={{ color: 'var(--text-primary)' }}>
                  {task.title}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                {task.priority === 'urgent' && (
                  <span className="pro-lock-badge" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', margin: 0 }}>URGENT</span>
                )}
                {task.deadline_at && (
                  <span style={{ fontSize: '0.6rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', color: isOverdue ? 'var(--danger)' : 'var(--warning)' }}>
                    {isOverdue ? t('dangerZone.overdue') : t('dangerZone.due')} {new Date(task.deadline_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default DangerZone
