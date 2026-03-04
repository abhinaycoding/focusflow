import { db } from '../lib/firebase'
import { collection, setDoc, doc, serverTimestamp } from 'firebase/firestore'

const MOCK_SCHOLARS = [
  { id: 'mock_1', full_name: 'Arjun Sharma', xp: 28450, hours: 92.5, avatar_id: 'owl', student_type: 'Engineering Manager', is_pro: true, emoji: '⚡', tasks: 184 },
  { id: 'mock_2', full_name: 'Ishani Kapoor', xp: 24200, hours: 75.0, avatar_id: 'fox', student_type: 'Medical Student', is_pro: true, emoji: '🩺', tasks: 156 },
  { id: 'mock_3', full_name: 'Kabir Rao', xp: 21800, hours: 68.4, avatar_id: 'bear', student_type: 'Graduate Scholar', is_pro: true, emoji: '📚', tasks: 142 },
  { id: 'mock_4', full_name: 'Ananya Malhotra', xp: 18500, hours: 55.2, avatar_id: 'cat', student_type: 'UX Researcher', is_pro: false, emoji: '🎨', tasks: 120 },
  { id: 'mock_5', full_name: 'Rohan Deshmukh', xp: 15900, hours: 42.8, avatar_id: 'dog', student_type: 'Fullstack Dev', is_pro: true, emoji: '💻', tasks: 98 },
  { id: 'mock_6', full_name: 'Priya Gupta', xp: 12400, hours: 38.0, avatar_id: 'rabbit', student_type: 'Design Lead', is_pro: true, emoji: '✨', tasks: 85 },
  { id: 'mock_7', full_name: 'Veer Singh', xp: 9800, hours: 25.5, avatar_id: 'wolf', student_type: 'Law Student', is_pro: false, emoji: '⚖️', tasks: 64 },
  { id: 'mock_8', full_name: 'Diya Varma', xp: 7500, hours: 18.2, avatar_id: 'deer', student_type: 'Content Meta', is_pro: true, emoji: '✍️', tasks: 41 },
  { id: 'mock_9', full_name: 'Aarav Patel', xp: 5200, hours: 12.0, avatar_id: 'lion', student_type: 'Startup Founder', is_pro: true, emoji: '🚀', tasks: 30 },
  { id: 'mock_10', full_name: 'Sana Mirza', xp: 4100, hours: 9.5, avatar_id: 'panda', student_type: 'History Buff', is_pro: false, emoji: '🕯️', tasks: 22 },
]

export const seedScholars = async () => {
  console.log('Seeding scholars...')
  try {
    for (const s of MOCK_SCHOLARS) {
      // Seed profile
      await setDoc(doc(db, 'profiles', s.id), {
        full_name: s.full_name,
        xp: s.xp,
        total_tasks_done: s.tasks,
        total_study_seconds: s.hours * 3600,
        avatar_id: s.avatar_id,
        avatar_emoji: s.emoji,
        student_type: s.student_type,
        is_pro: s.is_pro,
        is_mock: true, // Tag as mock
        created_at: serverTimestamp(),
      })

      // Seed mock study sessions to back up the "hours" stat
      // We don't necessarily need to seed thousands of sessions, 
      // but let's seed at least one big session so the sum logic works if needed,
      // though the leaderboard currently just reads from profiles for hours in some cases? 
      // Actually LeaderboardPage.jsx aggregatess sessions. Let's add sessions too.
      await setDoc(doc(db, 'sessions', `session_${s.id}`), {
        user_id: s.id,
        duration_seconds: s.hours * 3600,
        completed: true,
        created_at: serverTimestamp(),
      })

      // Seed mock tasks for the "tasks" stat
      const taskCount = Math.floor(s.xp / 150) // estimated tasks
      for (let i = 0; i < 5; i++) { // just seed a few real ones
        await setDoc(doc(db, 'tasks', `task_${s.id}_${i}`), {
          user_id: s.id,
          title: `Focus Session Habit #${i+1}`,
          completed: true,
          created_at: serverTimestamp(),
        })
      }
    }
    return true
  } catch (err) {
    console.error('Seeding error:', err)
    return false
  }
}
