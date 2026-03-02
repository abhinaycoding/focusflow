import React, { useState, useEffect, useRef } from 'react'
import { db } from '../lib/firebase'
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import './StudyHeatmap.css'

const CELL_SIZE = 13
const CELL_GAP = 3
const TOTAL = CELL_SIZE + CELL_GAP
const WEEKS = 53
const DAYS_IN_WEEK = 7
const LEFT_PAD = 32 // space for day labels
const TOP_PAD = 20  // space for month labels

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']

// Color intensity levels (5 levels)
const getColorLevel = (data) => {
  if (!data || (data.hours === 0 && data.tasks === 0)) return 0
  
  // Combined score: 1 hour = 1 point, 1 task = 0.75 points
  const score = data.hours + (data.tasks * 0.75)

  if (score < 0.5) return 1
  if (score < 1.5) return 2
  if (score < 3) return 3
  return 4
}

const StudyHeatmap = () => {
  const { user } = useAuth()
  const [dayData, setDayData] = useState({})
  const [loading, setLoading] = useState(true)
  const [tooltip, setTooltip] = useState(null)
  const svgRef = useRef(null)
  const containerRef = useRef(null)

  // Build the array of 371 days (53 weeks × 7 days), ending today
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  const days = []
  const startDate = new Date(today)
  // Go back to the start of the grid: 
  // today's day-of-week (0=Sun) determines how many days back from the last column
  const todayDow = today.getDay() // 0=Sun, 6=Sat
  startDate.setDate(today.getDate() - (WEEKS - 1) * 7 - todayDow)
  startDate.setHours(0, 0, 0, 0)

  for (let i = 0; i < WEEKS * DAYS_IN_WEEK; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    if (d > today) {
      days.push({ date: null, week: Math.floor(i / 7), day: i % 7 })
    } else {
      days.push({
        date: d.toISOString().split('T')[0],
        week: Math.floor(i / 7),
        day: i % 7,
        dateObj: d,
      })
    }
  }

  // Determine month label positions
  const monthLabels = []
  let lastMonth = -1
  days.forEach(d => {
    if (!d.date) return
    const month = d.dateObj.getMonth()
    if (month !== lastMonth && d.day === 0) {
      monthLabels.push({ month, week: d.week })
      lastMonth = month
    }
  })

  useEffect(() => {
    if (!user?.uid) return

    const fetchData = async () => {
      try {
        // Fetch ALL sessions for this user (we'll filter client-side)
        const yearAgo = new Date()
        yearAgo.setFullYear(yearAgo.getFullYear() - 1)
        yearAgo.setHours(0, 0, 0, 0)

        const q = query(
          collection(db, 'sessions'), 
          where('user_id', '==', user.uid),
          where('created_at', '>=', Timestamp.fromDate(yearAgo))
        )
        
        // Also fetch personal tasks (filter date client-side to avoid composite index error)
        const tq = query(
          collection(db, 'tasks'),
          where('user_id', '==', user.uid)
        )

        const [sessSnap, taskSnap] = await Promise.all([
          getDocs(q),
          getDocs(tq)
        ])
        
        const sessions = sessSnap.docs.map(doc => doc.data())
        const tasks = taskSnap.docs.map(doc => doc.data())

        // Aggregate hours and tasks per day
        const byDay = {}
        ;(sessions || []).forEach(s => {
          const d = s.created_at?.toDate ? s.created_at.toDate() : new Date(s.created_at)
          const dateKey = d.toISOString().split('T')[0]
          if (!byDay[dateKey]) byDay[dateKey] = { hours: 0, tasks: 0 }
          byDay[dateKey].hours += (s.duration_seconds || 0) / 3600
        })

        ;(tasks || []).forEach(t => {
          if (!t.completed) return // Only count completed tasks
          const d = t.created_at?.toDate ? t.created_at.toDate() : new Date(t.created_at)
          if (d < yearAgo) return // Client-side date filter
          const dateKey = d.toISOString().split('T')[0]
          if (!byDay[dateKey]) byDay[dateKey] = { hours: 0, tasks: 0 }
          byDay[dateKey].tasks += 1
        })

        setDayData(byDay)
      } catch (err) {
        console.error('Heatmap fetch error:', err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user?.uid])

  const handleCellHover = (e, d) => {
    if (!d.date) return
    const rect = containerRef.current.getBoundingClientRect()
    const data = dayData[d.date] || { hours: 0, tasks: 0 }
    const dateLabel = d.dateObj.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    })
    
    // Construct tooltip text
    let textParts = []
    if (data.hours > 0) textParts.push(`${data.hours.toFixed(1)}h studied`)
    if (data.tasks > 0) textParts.push(`${data.tasks} tasks done`)
    const text = textParts.length > 0 ? textParts.join(', ') : 'No activity'

    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top - 40,
      text,
      date: dateLabel,
    })
  }

  const handleCellLeave = () => setTooltip(null)

  // Stats
  const totalHoursYear = Object.values(dayData).reduce((a, b) => a + (b.hours || 0), 0)
  const totalTasksYear = Object.values(dayData).reduce((a, b) => a + (b.tasks || 0), 0)
  const activeDays = Object.values(dayData).filter(d => (d.hours > 0 || d.tasks > 0)).length
  const longestStreak = (() => {
    let max = 0, current = 0
    const sortedDays = days.filter(d => d.date).map(d => d.date).sort()
    for (let i = 0; i < sortedDays.length; i++) {
      const dData = dayData[sortedDays[i]] || { hours: 0, tasks: 0 }
      if (dData.hours > 0 || dData.tasks > 0) {
        current++
        max = Math.max(max, current)
      } else {
        current = 0
      }
    }
    return max
  })()

  const svgWidth = LEFT_PAD + WEEKS * TOTAL
  const svgHeight = TOP_PAD + DAYS_IN_WEEK * TOTAL + 4

  if (loading) {
    return (
      <div className="heatmap-card">
        <div className="heatmap-header">
          <h3 className="chart-title">Study Activity — Past Year</h3>
        </div>
        <div className="heatmap-skeleton">
          <div className="skeleton" style={{ width: '100%', height: '140px' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="heatmap-card" ref={containerRef}>
      <div className="heatmap-header">
        <h3 className="chart-title">Study Activity — Past Year</h3>
        <div className="heatmap-stats">
          <span className="heatmap-stat">
            <strong>{totalHoursYear.toFixed(0)}</strong>h total
          </span>
          {totalTasksYear > 0 && (
            <span className="heatmap-stat">
              <strong>{totalTasksYear}</strong> tasks
            </span>
          )}
          <span className="heatmap-stat">
            <strong>{activeDays}</strong> active days
          </span>
          <span className="heatmap-stat">
            <strong>{longestStreak}</strong> day streak
          </span>
        </div>
      </div>

      <div className="heatmap-scroll-wrap">
        <svg
          ref={svgRef}
          width={svgWidth}
          height={svgHeight}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="heatmap-svg"
        >
          {/* Month labels */}
          {monthLabels.map((m, i) => (
            <text
              key={i}
              x={LEFT_PAD + m.week * TOTAL}
              y={12}
              className="heatmap-month-label"
            >
              {MONTH_NAMES[m.month]}
            </text>
          ))}

          {/* Day-of-week labels */}
          {DAY_LABELS.map((label, i) => (
            label ? (
              <text
                key={i}
                x={LEFT_PAD - 6}
                y={TOP_PAD + i * TOTAL + CELL_SIZE / 2 + 1}
                className="heatmap-day-label"
              >
                {label}
              </text>
            ) : null
          ))}

          {/* Grid cells */}
          {days.map((d, i) => {
            if (!d.date) return null
            const data = dayData[d.date] || { hours: 0, tasks: 0 }
            const level = getColorLevel(data)
            return (
              <rect
                key={i}
                x={LEFT_PAD + d.week * TOTAL}
                y={TOP_PAD + d.day * TOTAL}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={2}
                ry={2}
                className={`heatmap-cell heatmap-level-${level}`}
                onMouseEnter={(e) => handleCellHover(e, d)}
                onMouseLeave={handleCellLeave}
              />
            )
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="heatmap-legend">
        <span className="heatmap-legend-text">Less</span>
        {[0, 1, 2, 3, 4].map(level => (
          <div key={level} className={`heatmap-legend-cell heatmap-level-${level}`} />
        ))}
        <span className="heatmap-legend-text">More</span>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="heatmap-tooltip"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="heatmap-tooltip-hours">{tooltip.text}</div>
          <div className="heatmap-tooltip-date">{tooltip.date}</div>
        </div>
      )}
    </div>
  )
}

export default StudyHeatmap
