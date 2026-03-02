import React, { useState, useEffect } from 'react'
import { db } from '../lib/firebase'
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore'
import { useAuth } from '../contexts/AuthContext'
import { useTranslation } from '../contexts/LanguageContext'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts'
import StudyHeatmap from '../components/StudyHeatmap'
import './AnalyticsPage.css'

const AnalyticsPage = ({ onNavigate }) => {
  const { user } = useAuth()
  const [weeklyData, setWeeklyData] = useState([])
  const [taskStats, setTaskStats] = useState({ completed: 0, pending: 0, total: 0 })
  const [totalHours, setTotalHours] = useState(0)
  const [streakDays, setStreakDays] = useState(0)
  const [loading, setLoading] = useState(true)
  const { t } = useTranslation()

  useEffect(() => {
    if (user?.uid) fetchAnalytics()
  }, [user?.uid])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      // Build last 7 days labels
      const days = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        days.push({
          label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
          date: d.toISOString().split('T')[0],
          hours: 0
        })
      }

      // Fetch sessions for past 7 days
      const sevenAgo = new Date()
      sevenAgo.setDate(sevenAgo.getDate() - 6)
      sevenAgo.setHours(0, 0, 0, 0)

      const qRecent = query(
        collection(db, 'sessions'), 
        where('user_id', '==', user.uid)
      )
      const recentSnap = await getDocs(qRecent)
      const allRecentSessions = recentSnap.docs.map(doc => doc.data())
      
      const sevenAgoTime = sevenAgo.getTime()
      const recentSessions = allRecentSessions.filter(s => {
        const d = s.created_at?.toDate ? s.created_at.toDate() : new Date(s.created_at)
        return d.getTime() >= sevenAgoTime
      })

      // Map sessions to days
      recentSessions.forEach(s => {
        const d = s.created_at?.toDate ? s.created_at.toDate() : new Date(s.created_at)
        const sessionDate = d.toISOString().split('T')[0]
        const day = days.find(d => d.date === sessionDate)
        if (day) day.hours += parseFloat((s.duration_seconds / 3600).toFixed(2))
      })

      // Round hours
      const formatted = days.map(d => ({ ...d, hours: parseFloat(d.hours.toFixed(1)) }))
      setWeeklyData(formatted)

      // Total hours all time
      const qAll = query(collection(db, 'sessions'), where('user_id', '==', user.uid))
      const allSnap = await getDocs(qAll)
      const allSessions = allSnap.docs.map(doc => doc.data())
      const total = allSessions.reduce((a, s) => a + (s.duration_seconds || 0), 0)
      setTotalHours((total / 3600).toFixed(1))

      // Task stats
      const qTasks = query(collection(db, 'tasks'), where('user_id', '==', user.uid))
      const tasksSnap = await getDocs(qTasks)
      const allTasks = tasksSnap.docs.map(doc => doc.data())
      const completed = allTasks.filter(t => t.completed).length
      setTaskStats({ completed, pending: allTasks.length - completed, total: allTasks.length })

      // Streak calculation
      let streak = 0
      const today = new Date()
      for (let i = 0; i < 30; i++) {
        const check = new Date(today)
        check.setDate(check.getDate() - i)
        const dateStr = check.toISOString().split('T')[0]
        const hasSession = allSessions.some(s => {
          const d = s.created_at?.toDate ? s.created_at.toDate() : new Date(s.created_at)
          return d.toISOString().split('T')[0] === dateStr
        })
        if (hasSession) streak++
        else break
      }
      setStreakDays(streak)
    } catch (err) {
      console.error('Error fetching analytics:', err.message)
    } finally {
      setLoading(false)
    }
  }

  const taskChartData = [
    { name: 'Done', value: taskStats.completed, color: '#2E5C50' },
    { name: 'Pending', value: taskStats.pending, color: '#E5E0D5' },
  ]

  return (
    <>
      {/* Hero: Study Heatmap */}
      <StudyHeatmap />

      {/* KPI Row */}
      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-value">{totalHours}</div>
          <div className="kpi-label">Total Hours Studied</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{taskStats.completed}</div>
          <div className="kpi-label">Tasks Completed</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{streakDays}</div>
          <div className="kpi-label">Day Streak 🔥</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">
            {taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0}%
          </div>
          <div className="kpi-label">Completion Rate</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        {/* Weekly Study Hours Bar Chart */}
        <div className="chart-card">
          <h3 className="chart-title">Study Hours — Last 7 Days</h3>
          {loading ? <p className="text-xs text-muted italic">Loading data...</p> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fontFamily: 'Inter', textTransform: 'uppercase' }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ fontFamily: 'Inter', fontSize: 12, border: '1px solid var(--border)' }}
                  formatter={(v) => [`${v}h`, 'Study']}
                />
                <Bar dataKey="hours" fill="var(--text-primary)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Task Completion Pie Chart */}
        <div className="chart-card">
          <h3 className="chart-title">Task Completion</h3>
          {loading ? <p className="text-xs text-muted italic">Loading data...</p> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={taskChartData}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {taskChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontFamily: 'Inter', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Motivational Quote */}
      <div className="analytics-footer border-t border-ink pt-6 mt-6">
        <p className="font-serif italic text-lg text-muted max-w-2xl">
          "An investment in knowledge pays the best interest."
        </p>
        <p className="text-xs uppercase tracking-widest text-muted mt-1">— Benjamin Franklin</p>
      </div>
    </>
  )
}

export default AnalyticsPage
