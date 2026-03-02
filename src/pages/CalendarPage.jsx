import React, { useState, useEffect, useMemo } from 'react'
import { db } from '../lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { usePlan } from '../contexts/PlanContext'
import './CalendarPage.css'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const CalendarPage = ({ onNavigate }) => {
  const { user } = useAuth()
  const { isPro } = usePlan()
  const [sessions, setSessions] = useState([])
  const [tasks, setTasks] = useState([])
  const [examDate, setExamDate] = useState(null)
  const [examName, setExamName] = useState('')
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [view, setView] = useState('month') // 'month' | 'week'
  const [heatmap, setHeatmap] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)

  const today = new Date()
  const todayStr = today.toDateString()

  // Load data
  useEffect(() => {
    if (!user?.uid) return
    const load = async () => {
      try {
        const [sessSnap, taskSnap] = await Promise.all([
          getDocs(query(collection(db, 'sessions'), where('user_id', '==', user.uid), where('completed', '==', true))),
          getDocs(query(collection(db, 'tasks'), where('user_id', '==', user.uid)))
        ])
        
        setSessions(sessSnap.docs.map(doc => doc.data()))
        setTasks(taskSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })))

        // Load exam date
        const saved = localStorage.getItem(`ff_exam_date_${user.uid}`)
        const savedName = localStorage.getItem(`ff_exam_name_${user.uid}`)
        if (saved) setExamDate(new Date(saved))
        if (savedName) setExamName(savedName)
      } catch (err) {
        console.error('Calendar Load Error:', err)
      }
    }
    load()
  }, [user?.uid])

  // Build day data map
  const dayData = useMemo(() => {
    const map = {}
    sessions.forEach(s => {
      const date = s.created_at?.toDate ? s.created_at.toDate() : new Date(s.created_at)
      const d = date.toDateString()
      if (!map[d]) map[d] = { sessions: 0, minutes: 0, tasks: 0, tasksDone: 0 }
      map[d].sessions++
      map[d].minutes += Math.round((s.duration_seconds || 0) / 60)
    })
    tasks.forEach(t => {
      if (t.due_date === 'goal' || t.due_date === 'syllabus') return
      const date = t.created_at?.toDate ? t.created_at.toDate() : new Date(t.created_at)
      const d = date.toDateString()
      if (!map[d]) map[d] = { sessions: 0, minutes: 0, tasks: 0, tasksDone: 0 }
      map[d].tasks++
      if (t.completed) map[d].tasksDone++
    })
    return map
  }, [sessions, tasks])

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1)
    const startDay = (first.getDay() + 6) % 7 // Monday = 0
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

    const days = []
    // Previous month padding
    for (let i = 0; i < startDay; i++) {
      const d = new Date(viewYear, viewMonth, -startDay + i + 1)
      days.push({ date: d, outside: true })
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(viewYear, viewMonth, i), outside: false })
    }
    // Next month padding
    const remaining = 7 - (days.length % 7)
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        days.push({ date: new Date(viewYear, viewMonth + 1, i), outside: true })
      }
    }
    return days
  }, [viewMonth, viewYear])

  // Heatmap intensity
  const maxMinutes = useMemo(() => {
    return Math.max(...Object.values(dayData).map(d => d.minutes), 1)
  }, [dayData])

  const navMonth = (dir) => {
    if (!isPro && dir !== 0) return
    let m = viewMonth + dir
    let y = viewYear
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setViewMonth(m)
    setViewYear(y)
  }

  const isExamDay = (date) => {
    if (!examDate) return false
    return date.toDateString() === examDate.toDateString()
  }

  // Week view data
  const weekDays = useMemo(() => {
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    })
  }, [])

  return (
    <div className="canvas-layout">
      <main className="container" style={{ paddingBottom: '5rem' }}>
        <div className="flex items-center justify-between mb-8">
           <div className="flex items-center gap-4">
             {isPro && (
               <>
                 <button
                   onClick={() => setHeatmap(!heatmap)}
                   className={`cal-toggle-btn ${heatmap ? 'active' : ''}`}
                 >
                   {heatmap ? '🔥 Heatmap' : 'Heatmap'}
                 </button>
                 <div className="cal-view-toggle">
                   <button
                     onClick={() => setView('month')}
                     className={`cal-toggle-btn ${view === 'month' ? 'active' : ''}`}
                   >
                     Month
                   </button>
                   <button
                     onClick={() => setView('week')}
                     className={`cal-toggle-btn ${view === 'week' ? 'active' : ''}`}
                   >
                     Week
                   </button>
                 </div>
               </>
             )}
           </div>
        </div>

        {/* Month Navigation */}
        <div className="cal-month-nav">
          <button
            onClick={() => navMonth(-1)}
            className={`cal-nav-arrow ${!isPro ? 'disabled' : ''}`}
            disabled={!isPro}
            title={!isPro ? 'Pro feature' : 'Previous month'}
          >
            ◀
          </button>
          <h2 className="cal-month-title font-serif">
            {MONTHS[viewMonth]} {viewYear}
          </h2>
          <button
            onClick={() => navMonth(1)}
            className={`cal-nav-arrow ${!isPro ? 'disabled' : ''}`}
            disabled={!isPro}
            title={!isPro ? 'Pro feature' : 'Next month'}
          >
            ▶
          </button>
        </div>

        {/* Month View */}
        {view === 'month' && (
          <div className="cal-grid">
            {/* Day headers */}
            {DAYS.map(d => (
              <div key={d} className="cal-day-header">{d}</div>
            ))}

            {/* Day cells */}
            {calendarDays.map(({ date, outside }, i) => {
              const key = date.toDateString()
              const data = dayData[key]
              const isToday = key === todayStr
              const isExam = isExamDay(date)
              const heatIntensity = heatmap && data ? Math.min(data.minutes / maxMinutes, 1) : 0

              return (
                <div
                  key={i}
                  className={[
                    'cal-cell',
                    outside ? 'cal-cell--outside' : '',
                    isToday ? 'cal-cell--today' : '',
                    isExam ? 'cal-cell--exam' : '',
                    selectedDate === key ? 'cal-cell--selected' : '',
                  ].join(' ')}
                  style={heatmap && data ? {
                    backgroundColor: `rgba(204, 75, 44, ${0.08 + heatIntensity * 0.35})`,
                  } : undefined}
                  onClick={() => setSelectedDate(key === selectedDate ? null : key)}
                >
                  <span className={`cal-date-num ${isToday ? 'cal-date-num--today' : ''}`}>
                    {date.getDate()}
                  </span>

                  {/* Session dots */}
                  {data && data.sessions > 0 && (
                    <div className="cal-dots">
                      {Array.from({ length: Math.min(data.sessions, 3) }).map((_, j) => (
                        <span key={j} className="cal-dot cal-dot--session" />
                      ))}
                    </div>
                  )}

                  {/* Task count */}
                  {data && data.tasks > 0 && (
                    <span className="cal-task-badge">
                      {data.tasksDone}/{data.tasks}
                    </span>
                  )}

                  {/* Exam marker */}
                  {isExam && (
                    <div className="cal-exam-label">{examName || 'Exam'}</div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Week View (Pro) */}
        {view === 'week' && isPro && (
          <div className="cal-week">
            {weekDays.map((date, i) => {
              const key = date.toDateString()
              const data = dayData[key]
              const isToday = key === todayStr
              const dayTasks = tasks.filter(t => {
                const date = t.created_at?.toDate ? t.created_at.toDate() : new Date(t.created_at)
                return t.due_date !== 'goal' && t.due_date !== 'syllabus' &&
                date.toDateString() === key
              })

              return (
                <div key={i} className={`cal-week-col ${isToday ? 'cal-week-col--today' : ''}`}>
                  <div className="cal-week-header">
                    <span className="cal-week-dayname">{DAYS[i]}</span>
                    <span className={`cal-week-datenum ${isToday ? 'cal-date-num--today' : ''}`}>
                      {date.getDate()}
                    </span>
                  </div>

                  <div className="cal-week-body">
                    {/* Sessions */}
                    {data && data.sessions > 0 && (
                      <div className="cal-week-event cal-week-event--session">
                        🎯 {data.sessions} session{data.sessions > 1 ? 's' : ''} · {data.minutes}m
                      </div>
                    )}

                    {/* Tasks */}
                    {dayTasks.map(t => (
                      <div
                        key={t.id}
                        className={`cal-week-event cal-week-event--task ${t.completed ? 'cal-week-event--done' : ''}`}
                      >
                        {t.completed ? '✓' : '○'} {t.title}
                      </div>
                    ))}

                    {/* Exam */}
                    {isExamDay(date) && (
                      <div className="cal-week-event cal-week-event--exam">
                        📋 {examName || 'Exam Day'}
                      </div>
                    )}

                    {dayTasks.length === 0 && (!data || data.sessions === 0) && !isExamDay(date) && (
                      <div className="cal-week-empty">—</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Selected Day Detail */}
        {selectedDate && dayData[selectedDate] && (
          <div className="cal-detail">
            <h3 className="font-serif text-xl mb-2">
              {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            <div className="cal-detail-stats">
              <span>🎯 {dayData[selectedDate].sessions} session{dayData[selectedDate].sessions !== 1 ? 's' : ''}</span>
              <span>⏱ {dayData[selectedDate].minutes} min focused</span>
              <span>✓ {dayData[selectedDate].tasksDone}/{dayData[selectedDate].tasks} tasks</span>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="cal-legend">
          <div className="cal-legend-item">
            <span className="cal-dot cal-dot--session" /> Focus Session
          </div>
          <div className="cal-legend-item">
            <span className="cal-legend-badge">2/3</span> Tasks Done
          </div>
          {examDate && (
            <div className="cal-legend-item">
              <span className="cal-legend-exam" /> {examName || 'Exam'}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}

export default CalendarPage

