import { useState, useEffect } from 'react'
import { auth, db } from '../lib/firebase'
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  increment 
} from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { usePlan } from '../contexts/PlanContext'
import { useNotifications } from '../contexts/NotificationContext'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useTranslation } from '../contexts/LanguageContext'
import { EmptyLedger } from './EmptyStateIllustrations'
import ProGate from './ProGate'
import '../pages/Dashboard.css'

const PRIORITIES = ['low', 'medium', 'high', 'urgent']

const TaskPlanner = () => {
  const { user } = useAuth()
  const { isPro } = usePlan()
  const toast = useToast()
  const { addNotification } = useNotifications()
  const { t } = useTranslation()
  const [tasks, setTasks] = useState([])
  const hasReachedLimit = !isPro && tasks.length >= 20
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState('medium')
  const [newDeadline, setNewDeadline] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')

  // Global shortcut 'N' for new task
  useKeyboardShortcuts([
    {
      key: 'n',
      action: () => {
        if (!hasReachedLimit) setIsAdding(true)
      }
    }
  ])

  useEffect(() => {
    if (!user?.uid) return

    const q = query(
      collection(db, 'tasks'),
      where('user_id', '==', user.uid)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a, b) => {
        const da = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at)
        const db = b.created_at?.toDate ? b.created_at.toDate() : new Date(b.created_at)
        return db - da
      })
      setTasks(tasksData)
      setLoading(false)
    }, (err) => {
      console.error('Firestore tasks error:', err.message)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [user])

  const addTask = async () => {
    const title = newTitle.trim()
    if (!title || !user?.uid) { setIsAdding(false); setNewTitle(''); return }
    if (hasReachedLimit) return

    setIsAdding(false)
    setNewTitle('')

    try {
      await addDoc(collection(db, 'tasks'), {
        user_id: user.uid,
        title,
        priority: newPriority,
        deadline_at: newDeadline || null,
        completed: false,
        created_at: serverTimestamp()
      })
      toast(t('tasks.taskAdded'), 'success')
      window.dispatchEvent(new CustomEvent('task-updated', { detail: { added: true } }))
    } catch (err) {
      toast(t('tasks.taskFailed'), 'error')
      console.error(err)
    }
  }

  const toggleTask = async (id, current) => {
    try {
      const updateData = { completed: !current }
      if (!current) {
        updateData.completed_at = serverTimestamp()
      } else {
        updateData.completed_at = null
      }
      await updateDoc(doc(db, 'tasks', id), updateData)
      
      // Award XP: 50 XP per task and total tasks done
      if (!current) {
        await updateDoc(doc(db, 'profiles', user.uid), {
          xp: increment(50),
          total_tasks_done: increment(1)
        })
      }

      window.dispatchEvent(new CustomEvent('task-updated', { detail: { id, completed: !current } }))
      
      if (!current) {
        toast(t('tasks.taskComplete'), 'success')
        addNotification('Task Complete', t('tasks.taskCompleteNotif'), 'success')
        window.dispatchEvent(new CustomEvent('confetti-burst'))
        const pop = new Audio('https://cdn.pixabay.com/audio/2022/03/10/audio_f3152ef32d.mp3')
        pop.volume = 0.4
        pop.play().catch(e => console.log("Sound blocked:", e))
      }
    } catch (err) {
      toast(t('tasks.taskSyncFailed'), 'error')
      console.error(err)
    }
  }

  const deleteTask = async (id) => {
    try {
      await deleteDoc(doc(db, 'tasks', id))
      toast(t('tasks.taskRemoved'), 'info')
      window.dispatchEvent(new CustomEvent('task-updated', { detail: { deleted: true, id } }))
    } catch (err) {
      console.error(err)
    }
  }

  const startEdit = (task) => { setEditingId(task.id); setEditTitle(task.title) }

  const saveEdit = async (id) => {
    const title = editTitle.trim()
    setEditingId(null)
    if (!title) return
    try {
      await updateDoc(doc(db, 'tasks', id), { title })
      toast(t('tasks.taskUpdated'), 'success')
    } catch (err) {
      console.error(err)
    }
  }

  const isToday = (dateObj) => {
    if (!dateObj) return true
    const d = dateObj.toDate ? dateObj.toDate() : new Date(dateObj)
    const today = new Date()
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear()
  }

  const incomplete = tasks.filter(tk => !tk.completed)
  const done = tasks.filter(tk => tk.completed && (tk.completed_at ? isToday(tk.completed_at) : isToday(tk.created_at)))

  return (
    <div className="ledger-container">

      {/* ── Add Task — always at top ── */}
      {hasReachedLimit ? (
        <div style={{ marginBottom: '1.5rem' }}>
          <ProGate feature="ledger tasks" inline onNavigatePricing={() => window.location.href = '/pricing'} />
        </div>
      ) : isAdding ? (
        <div className="add-task-form">
          <input
            type="text"
            autoFocus
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') addTask()
              if (e.key === 'Escape') { setIsAdding(false); setNewTitle('') }
            }}
            placeholder={t('tasks.whatNeedsDone')}
            className="add-task-input"
          />
          <div className="add-task-controls" style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <input
              type="date"
              value={newDeadline}
              onChange={e => setNewDeadline(e.target.value)}
              className="priority-select"
              title={t('tasks.deadline')}
            />
            <select
              value={newPriority}
              onChange={e => setNewPriority(e.target.value)}
              className="priority-select"
            >
              <option value="low">{t('tasks.lowPriority')}</option>
              <option value="medium">{t('tasks.mediumPriority')}</option>
              <option value="high">{t('tasks.highPriority')}</option>
              <option value="urgent">{t('tasks.urgent')}</option>
            </select>
            <button onClick={addTask} className="btn-add-confirm">{t('tasks.add')}</button>
            <button onClick={() => { setIsAdding(false); setNewTitle('') }} className="btn-add-cancel">{t('tasks.cancel')}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setIsAdding(true)} className="add-task-trigger">
          <span className="add-task-plus">+</span>
          <span>{t('tasks.addTask')}</span>
        </button>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="mt-6 flex flex-col gap-3">
          <div className="skeleton skeleton-text" style={{ height: '36px' }} />
          <div className="skeleton skeleton-text" style={{ height: '36px', width: '90%' }} />
          <div className="skeleton skeleton-text" style={{ height: '36px', width: '95%' }} />
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && tasks.length === 0 && (
        <div className="text-center py-8 opacity-70">
          <EmptyLedger size={100} />
          <p className="font-serif italic text-lg mt-3">{t('tasks.emptyTitle')}</p>
          <p className="text-xs mt-1 uppercase tracking-widest text-muted">{t('tasks.emptySubtitle')}</p>
        </div>
      )}

      {/* ── Incomplete Tasks ── */}
      {incomplete.map(task => (
        <div key={task.id} className="ledger-row" style={{ alignItems: 'center' }}>
          <div
            className={`ledger-check cursor-pointer ${task.completed ? 'done' : ''}`}
            onClick={() => toggleTask(task.id, task.completed)}
          />
          {editingId === task.id ? (
            <input
              autoFocus
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onBlur={() => saveEdit(task.id)}
              onKeyDown={e => {
                if (e.key === 'Enter') saveEdit(task.id)
                if (e.key === 'Escape') setEditingId(null)
              }}
              className="ledger-title bg-transparent border-b border-ink outline-none"
              style={{ flexGrow: 1 }}
            />
          ) : (
            <div
              className="ledger-title cursor-pointer"
              onClick={() => toggleTask(task.id, task.completed)}
              onDoubleClick={() => startEdit(task)}
              title={t('tasks.doubleClickEdit')}
            >
              {task.title}
              {task.priority === 'urgent' && <span className="pro-lock-badge" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{t('tasks.urgent').toUpperCase()}</span>}
            </div>
          )}
          <div className="ledger-meta flex flex-col items-end gap-1">
            {task.deadline_at && (
              <span style={{ fontSize: '0.55rem', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.05em', color: new Date(task.deadline_at) < new Date() ? 'var(--danger)' : 'var(--text-secondary)' }}>
                {t('tasks.due')} {new Date(task.deadline_at).toLocaleDateString()}
              </span>
            )}
            <div className="flex items-center gap-2 mt-1">
              <button onClick={() => startEdit(task)} title={t('tasks.edit')} style={{ opacity: 0.4, fontSize: '0.8rem' }}>✎</button>
              <button onClick={() => deleteTask(task.id)} title={t('tasks.delete')} style={{ opacity: 0.4, fontSize: '1rem' }}>×</button>
            </div>
          </div>
        </div>
      ))}

      {/* ── Completed Tasks ── */}
      {done.length > 0 && (
        <div style={{ marginTop: '1.5rem', opacity: 0.45 }}>
          <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.5rem' }}>
            {t('tasks.completed')} ({done.length})
          </div>
          {done.map(task => (
            <div key={task.id} className="ledger-row" style={{ alignItems: 'center' }}>
              <div
                className="ledger-check cursor-pointer done"
                onClick={() => toggleTask(task.id, task.completed)}
              />
              <div
                className="ledger-title cursor-pointer done"
                onClick={() => toggleTask(task.id, task.completed)}
              >
                {task.title}
              </div>
              <div className="ledger-meta">
                <button onClick={() => deleteTask(task.id)} title={t('tasks.delete')} style={{ opacity: 0.5, fontSize: '1rem' }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}

export default TaskPlanner
