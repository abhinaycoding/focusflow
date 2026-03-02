import React, { useState } from 'react'
import { auth } from '../lib/firebase'
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from 'firebase/auth'
import Navigation from '../components/Navigation'
import './AuthPage.css'

const AuthPage = ({ onNavigate }) => {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Handle redirect result for Google Sign-In
  React.useEffect(() => {
    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth)
        if (result) {
          // Success is handled by onAuthStateChanged in AuthContext
        }
      } catch (err) {
        console.error('Redirect result error:', err)
        setErrorMsg(err.message)
      }
    }
    handleRedirect()
  }, [])

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const provider = new GoogleAuthProvider()
      // Detect if we are on a mobile device or PWA standalone
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches

      if (isMobile || isStandalone) {
        // Redirect is safer for iOS PWAs and Mobile Safari pop-up blockers
        await signInWithRedirect(auth, provider)
      } else {
        await signInWithPopup(auth, provider)
      }
    } catch (err) {
      setErrorMsg(err.message)
      setLoading(false)
    }
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const normalizedEmail = email.trim().toLowerCase()
      const normalizedName = fullName.trim()

      if (isSignUp) {
        if (!normalizedName) throw new Error('Full name is required.')

        const { user } = await createUserWithEmailAndPassword(auth, normalizedEmail, password)
        await updateProfile(user, { displayName: normalizedName })

        setSuccessMsg('Account created. Redirecting...')
      } else {
        await signInWithEmailAndPassword(auth, normalizedEmail, password)
        setSuccessMsg('Logged in. Redirecting...')
      }
    } catch (err) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="landing-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navigation onNavigate={onNavigate} />
      
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', marginTop: '4rem' }}>
        <div style={{ width: '100%', maxWidth: '420px', border: '1px solid var(--ink)', padding: '2.5rem', background: 'var(--bg-card)' }}>
          
          <h2 className="text-4xl font-serif text-center" style={{ marginBottom: '0.5rem' }}>
            {isSignUp ? 'Join FocusFlow' : 'Welcome Back'}
          </h2>
          <p className="text-xs text-center text-muted uppercase tracking-widest" style={{ marginBottom: '2rem' }}>
            {isSignUp ? 'Create your scholar profile' : 'Resume your studies'}
          </p>

          {errorMsg && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '0.875rem', fontWeight: 500 }}>
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: '0.875rem', fontWeight: 500 }}>
              {successMsg}
            </div>
          )}

          {/* Google Sign In */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="google-sign-in-btn"
            style={{ marginBottom: '0' }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 6.294C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {loading ? 'Redirecting...' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div className="auth-divider" style={{ margin: '1.5rem 0' }}>
            <span>or continue with email</span>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {isSignUp && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label className="text-xs uppercase tracking-widest font-bold">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={{ width: '100%', background: 'transparent', borderBottom: '1px solid var(--ink)', padding: '0.5rem 0', outline: 'none', fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--text-primary)' }}
                  placeholder="e.g. Marie Curie"
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label className="text-xs uppercase tracking-widest font-bold">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', background: 'transparent', borderBottom: '1px solid var(--ink)', padding: '0.5rem 0', outline: 'none', fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--text-primary)' }}
                placeholder="scholar@university.edu"
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label className="text-xs uppercase tracking-widest font-bold">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', background: 'transparent', borderBottom: '1px solid var(--ink)', padding: '0.5rem 0', outline: 'none', fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--text-primary)' }}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ marginTop: '0.5rem', padding: '1rem 1.5rem', background: 'var(--ink)', color: 'var(--bg-card)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.875rem', opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer', border: 'none', transition: 'background 0.2s ease' }}
            >
              {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Log In')}
            </button>
          </form>

          <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {isSignUp ? 'Already a scholar? ' : "Don't have an account? "}
            <button 
              onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(''); setSuccessMsg('') }}
              style={{ color: 'var(--primary)', fontWeight: 500, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {isSignUp ? 'Log in here.' : 'Sign up here.'}
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default AuthPage
