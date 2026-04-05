import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Success() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('verifying') // verifying | success | error

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('session_id')
    if (!sessionId) {
      setStatus('error')
      return
    }

    fetch('/api/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) setStatus('success')
        else setStatus('error')
      })
      .catch(() => setStatus('error'))
  }, [])

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
          <button
            onClick={() => navigate('/ai-coach')}
            className="btn-primary px-8"
          >
            Open AI Coach →
          </button>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-black text-primary mb-2">Something went wrong</h2>
          <p className="text-muted text-sm mb-8">Your payment went through but we couldn't activate Pro automatically. Please contact support.</p>
          <button onClick={() => navigate('/')} className="btn-primary px-8">Go Home</button>
        </>
      )}
    </div>
  )
}
