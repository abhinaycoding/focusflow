/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useEffect, useRef, useContext, useCallback } from 'react'
import { auth, db } from '../lib/firebase'
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth'
import { doc, getDoc, setDoc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore'

export const AuthContext = createContext(undefined)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileReady, setProfileReady] = useState(false)
  const [loading, setLoading] = useState(true)

  const authFlowIdRef = useRef(0)

  const hydrateProfile = useCallback(async (uid, flowId) => {
    try {
      const docRef = doc(db, 'profiles', uid)
      const docSnap = await getDoc(docRef)

      if (flowId !== authFlowIdRef.current) return

      if (docSnap.exists()) {
        const data = docSnap.data()
        if (data.isBanned) {
          await firebaseSignOut(auth)
          return
        }
        setProfile(data)
      } else {
        // Auto-initialize profile if it doesn't exist
        const newProfile = {
          id: uid,
          updated_at: new Date().toISOString(),
          is_pro: false,
          student_type: 'High School',
          full_name: auth.currentUser?.displayName || 'Scholar'
        }
        await setDoc(docRef, newProfile)
        setProfile(newProfile)
      }
    } catch (err) {
      if (flowId !== authFlowIdRef.current) return
      console.warn('Profile hydration failed:', err.message)
      setProfile(null)
      // Ensure we don't hang even on profile error
      setProfileReady(true)
      setLoading(false)
    } finally {
      if (flowId === authFlowIdRef.current) {
        setProfileReady(true)
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    let unsubscribeProfile = null

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      const flowId = ++authFlowIdRef.current

      if (unsubscribeProfile) {
        unsubscribeProfile()
        unsubscribeProfile = null
      }

      if (!firebaseUser) {
        setUser(null)
        setProfile(null)
        setProfileReady(true)
        setLoading(false)
        return
      }

      setUser(firebaseUser)
      setProfileReady(false)

      // Initial hydration
      await hydrateProfile(firebaseUser.uid, flowId)

      // Set up real-time listener for profile changes (replaces multiple manual refreshes)
      unsubscribeProfile = onSnapshot(doc(db, 'profiles', firebaseUser.uid), async (snapshot) => {
        if (flowId === authFlowIdRef.current && snapshot.exists()) {
          const data = snapshot.data()
          if (data.isBanned) {
            await firebaseSignOut(auth)
          } else {
            setProfile(data)
          }
        }
      })
    })

    return () => {
      unsubscribeAuth()
      if (unsubscribeProfile) unsubscribeProfile()
      authFlowIdRef.current += 1
    }
  }, [hydrateProfile])

  // Migration: Sync localStorage stats to Firestore if Firestore is empty
  useEffect(() => {
    if (!profileReady || !profile || !user?.uid) return

    const syncLegacyStats = async () => {
      try {
        const localXP = parseInt(localStorage.getItem('notenook_xp') || '0', 10)
        const localStats = JSON.parse(localStorage.getItem('notenook_stats') || '{}')
        
        // Check if any fields are missing or significantly behind in Firestore
        const needsXP = (profile.xp || 0) < localXP
        const needsTasks = (profile.total_tasks_done || 0) < (localStats.tasksCompleted || 0)
        const needsHours = (profile.total_study_seconds || 0) < (localStats.totalMinutes || 0) * 60
        const needsSessions = (profile.total_sessions_done || 0) < (localStats.sessionsCompleted || 0)

        if (needsXP || needsTasks || needsHours || needsSessions) {
          console.log('Syncing legacy stats to Firestore...')
          const updateData = { migrated_at: serverTimestamp() }
          if (needsXP) updateData.xp = localXP
          if (needsTasks) updateData.total_tasks_done = localStats.tasksCompleted
          if (needsHours) updateData.total_study_seconds = localStats.totalMinutes * 60
          if (needsSessions) updateData.total_sessions_done = localStats.sessionsCompleted
          
          await updateDoc(doc(db, 'profiles', user.uid), updateData)
          localStorage.setItem('xp_migrated', 'true')
        }
      } catch (err) {
        console.warn('XP Migration failed:', err.message)
      }
    }

    syncLegacyStats()
  }, [profileReady, profile, user?.uid])

  // Heartbeat for online status
  useEffect(() => {
    if (!user?.uid) return

    const updatePresence = async () => {
      try {
        if (document.visibilityState === 'visible') {
          await updateDoc(doc(db, 'profiles', user.uid), { 
            last_active: serverTimestamp(),
            // Auto-ensure the owner is marked as admin in the DB too
            ...(user.email?.toLowerCase() === 'abhinaynachankar7@gmail.com' ? { isAdmin: true } : {})
          })
        }
      } catch (err) {
        console.warn('Presence update failed:', err.message)
      }
    }

    updatePresence() // Initial ping
    const interval = setInterval(updatePresence, 60000) // Every 60s

    // Also ping when returning to the tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updatePresence()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user?.uid])

  const signOut = async () => {
    try {
      await firebaseSignOut(auth)
    } catch (err) {
      console.error('Sign out error:', err)
    }
  }

  const refreshProfile = async () => {
    if (!user?.uid) {
      setProfile(null)
      setProfileReady(true)
      return
    }
    const flowId = ++authFlowIdRef.current
    setProfileReady(false)
    await hydrateProfile(user.uid, flowId)
  }

  const value = {
    user,
    profile,
    profileReady,
    loading,
    isAdmin: profile?.isAdmin || user?.email?.toLowerCase() === 'abhinaynachankar7@gmail.com',
    signOut,
    refreshProfile,
    // session is maintained as undefined/null for compat, firebase uses currentUser
    session: user ? { user } : null 
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
