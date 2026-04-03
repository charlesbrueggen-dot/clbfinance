import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('Check your email for a confirmation link!')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(145deg, #1a5a94 0%, #2a7ab8 50%, #3a8acc 100%)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <img src="/logo.png" alt="Stride" className="w-32 h-32 object-contain mx-auto mb-5" />
          <h1 className="text-4xl font-black text-white tracking-tight">Stride</h1>
          <p className="text-white/65 mt-2 text-sm font-medium">Your personal financial dashboard</p>
        </div>

        <div className="rounded-2xl p-8" style={{ background: 'rgba(255,255,255,0.13)', border: '1px solid rgba(255,255,255,0.22)', backdropFilter: 'blur(16px)' }}>
          {/* Tabs */}
          <div className="flex rounded-xl p-1 mb-7" style={{ background: 'rgba(0,0,0,0.15)' }}>
            <button
              onClick={() => setMode('login')}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all"
              style={{ background: mode === 'login' ? 'rgba(255,255,255,0.2)' : 'transparent', color: mode === 'login' ? 'white' : 'rgba(255,255,255,0.55)' }}
            >Sign In</button>
            <button
              onClick={() => setMode('signup')}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold transition-all"
              style={{ background: mode === 'signup' ? 'rgba(255,255,255,0.2)' : 'transparent', color: mode === 'signup' ? 'white' : 'rgba(255,255,255,0.55)' }}
            >Create Account</button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="label">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required className="input-field" />
            </div>
            <div className="mb-6">
              <label className="label">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" required minLength={6} className="input-field" />
            </div>

            {error && <div className="mb-4 p-3 rounded-xl text-sm font-medium" style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5' }}>{error}</div>}
            {message && <div className="mb-4 p-3 rounded-xl text-sm font-medium" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: 'white' }}>{message}</div>}

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base">
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
