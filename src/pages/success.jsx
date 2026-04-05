import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'

export default function Success() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [status, setStatus] = useState('verifying')
  const [errorDetail, setErrorDetail] = useState('')

  useEffect(() => {
    if (!user) return

    const sessionId = new URLSearchParams(window.location.search).get('session_id')
    if (!sessionId) {
      setErrorDetail('No session_id in URL')
      setStatus('error')
      return
    }

    fetch('/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
      .then(async r => {
        const data = await r.json()
        if (data.success) setStatus('success')
        else { setErrorDetail(data.error); setStatus('error') }
      })
      .catch(err => { setErrorDetail(err.message); setStatus('error') })
  }, [user])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
      {status === 'verifying' && (
        <>
          <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mb-6"
            style={{ borderColor: '#10b981', borderTopColor: 'transparent' }} />
          <h2 className="text-xl font-black text-primary">Activating your Pro account…</h2>
          <p className="text-muted text-sm mt-2">Just a moment</p>
        </>
      )}
      {status === 'success' && (
        <>
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-black text-primary mb-2">You're Pro!</h2>
          <p className="text-muted text-sm mb-8">Your Stride AI Coach is now unlocked.</p>
          <button onClick={() => navigate('/coach')} className="btn-primary px-8">
            Open AI Coach →
          </button>
        </>
      )}
      {status === 'error' && (
        <>
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-black text-primary mb-2">Something went wrong</h2>
          <p className="text-muted text-sm mb-2">Your payment went through — contact support and we'll activate you manually.</p>
          {errorDetail && (
            <p className="text-xs font-mono mb-6 px-4 py-2 rounded-lg"
              style={{ background: 'var(--card-bg)', color: '#ef4444', border: '1px solid var(--card-border)' }}>
              {errorDetail}
            </p>
          )}
          <button onClick={() => navigate('/')} className="btn-primary px-8">Go Home</button>
        </>
      )}
    </div>
  )
}
