import React, { createContext, useState, useEffect, useRef, useContext } from 'react'
import { db } from '../lib/firebase'
import { collection, addDoc, serverTimestamp, updateDoc, doc, increment } from 'firebase/firestore'
import { useAuth } from './AuthContext'

const TimerContext = createContext({})

const PRESETS = [25, 45, 60]

export const TimerProvider = ({ children }) => {
  const { user } = useAuth()
  const [selectedMinutes, setSelectedMinutes] = useState(25)
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [isRunning, setIsRunning] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [sessionSaved, setSessionSaved] = useState(false)
  const intervalRef = useRef(null)

  // Main timer — lives at app level, never unmounts
  useEffect(() => {
    clearInterval(intervalRef.current)
    if (!isRunning) return

    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          setIsRunning(false)
          setIsComplete(true)
          
          // Play Completion Chime
          const chime = new Audio('https://cdn.pixabay.com/audio/2021/08/04/audio_145d5a6f9f.mp3')
          chime.volume = 0.5
          chime.play().catch(e => console.log("Audio blocked by browser:", e))
          
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [isRunning])

  // Save session when complete
  useEffect(() => {
    if (!isComplete || !user?.uid || sessionSaved) return
    
    const saveSession = async () => {
      setSessionSaved(true)
      try {
        await addDoc(collection(db, 'sessions'), {
          user_id: user.uid,
          duration_seconds: selectedMinutes * 60,
          completed: true,
          created_at: serverTimestamp(),
        })

        // Award XP: 10 XP per study minute and total study seconds/sessions
        await updateDoc(doc(db, 'profiles', user.uid), {
          xp: increment(selectedMinutes * 10),
          total_study_seconds: increment(selectedMinutes * 60),
          total_sessions_done: increment(1)
        })

        window.dispatchEvent(new CustomEvent('session-saved', { detail: { duration: selectedMinutes * 60 } }))
      } catch (err) {
        console.error('Session save error:', err.message)
      }
    }

    saveSession()
  }, [isComplete, user, selectedMinutes, sessionSaved])

  const start = () => {
    if (isComplete) {
      setSecondsLeft(selectedMinutes * 60)
      setIsComplete(false)
      setSessionSaved(false)
    }
    setIsRunning(true)
  }

  const pause = () => {
    clearInterval(intervalRef.current)
    setIsRunning(false)
  }

  const reset = () => {
    clearInterval(intervalRef.current)
    setIsRunning(false)
    setIsComplete(false)
    setSessionSaved(false)
    setSecondsLeft(selectedMinutes * 60)
  }

  const changePreset = (minutes) => {
    if (isRunning) return
    clearInterval(intervalRef.current)
    setSelectedMinutes(minutes)
    setSecondsLeft(minutes * 60)
    setIsRunning(false)
    setIsComplete(false)
    setSessionSaved(false)
  }

  return (
    <TimerContext.Provider value={{
      selectedMinutes,
      secondsLeft,
      isRunning,
      isComplete,
      sessionSaved,
      start,
      pause,
      reset,
      changePreset,
      PRESETS,
    }}>
      {children}
    </TimerContext.Provider>
  )
}

export const useTimer = () => useContext(TimerContext)
