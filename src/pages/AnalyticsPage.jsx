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

  const bestDay = [...weeklyData].sort((a, b) => b.hours - a.hours)[0]
  const avgHours = (weeklyData.reduce((a, b) => a + b.hours, 0) / 7).toFixed(1)

  return (
    <div className="analytics-main">
      <div style={{ padding: '0 0.5rem', marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', color: 'var(--text-primary)', margin: 0 }}>Performance Insights</h1>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginTop: '0.25rem' }}>Track your productivity & growth</p>
      </div>

      {/* Hero: Study Heatmap */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '32px', padding: '1.5rem', marginBottom: '2.5rem', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', padding: '0 0.5rem' }}>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', margin: 0 }}>Activity Heatmap</h3>
          <span style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', fontWeight: 800 }}>Past Year Progress</span>
        </div>
        <StudyHeatmap />
      </div>

      {/* KPI Row */}
      <div className="kpi-row">
        <div className="kpi-card">
          <div className="kpi-value">{totalHours}</div>
          <div className="kpi-label">Total Hours</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{taskStats.completed}</div>
          <div className="kpi-label">Tasks Done</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">{streakDays}</div>
          <div className="kpi-label">Day Streak 🔥</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-value">
            {taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0}%
          </div>
          <div className="kpi-label">Efficiency</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        {/* Weekly Study Hours Bar Chart */}
        <div className="chart-card">
          <div className="chart-title">
            <span>Weekly Momentum</span>
          </div>
          {loading ? <p className="text-xs text-muted italic">Loading data...</p> : (
            <>
              <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '2rem' }}>
                <div>
                  <div style={{ fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', fontWeight: 700 }}>Avg Daily</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: 'var(--text-primary)' }}>{avgHours}h</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', fontWeight: 700 }}>Peak Day</div>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: 'var(--primary)' }}>{bestDay?.label} ({bestDay?.hours}h)</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={weeklyData} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="color-mix(in srgb, var(--border) 40%, transparent)" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fontFamily: 'Inter', fill: 'var(--text-secondary)' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} />
                  <Tooltip
                    cursor={{ fill: 'color-mix(in srgb, var(--primary) 5%, transparent)', radius: 8 }}
                    contentStyle={{ borderRadius: '12px', border: 'none' }}
                  />
                  <Bar dataKey="hours" fill="var(--primary)" radius={[6, 6, 2, 2]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        {/* Task Completion Pie Chart */}
        <div className="chart-card">
          <div className="chart-title">
            <span>Focus Distribution</span>
          </div>
          {loading ? <p className="text-xs text-muted italic">Loading data...</p> : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={taskChartData}
                  cx="50%" cy="45%"
                  innerRadius={65} outerRadius={85}
                  paddingAngle={8}
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={1500}
                >
                  <Cell fill="var(--primary)" stroke="none" />
                  <Cell fill="var(--border)" stroke="none" />
                </Pie>
                <Legend 
                  verticalAlign="bottom" 
                  align="center"
                  iconType="circle" 
                  iconSize={10} 
                  wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }} 
                />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Motivational Quote */}
      <div className="analytics-footer">
        <p className="font-serif italic text-xl text-primary max-w-2xl mx-auto" style={{ opacity: 0.9 }}>
          "The discipline of consistent effort is where genius is born."
        </p>
        <div style={{ marginTop: '1.25rem', height: '1px', width: '40px', background: 'var(--primary)', margin: '1.25rem auto' }} />
        <p className="text-xs uppercase tracking-widest text-secondary font-bold">Your Potential is Infinite</p>
      </div>
    </div>
  )
}

export default AnalyticsPage
