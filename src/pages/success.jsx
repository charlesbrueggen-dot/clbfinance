import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

export default function Success() {
  const { user } = useAuth()
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Poll subscriptions table for up to 10 seconds until webhook saves it
    let attempts = 0
    const interval = setInterval(async () => {
      attempts++
      const { data } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .maybeSingle()

      if (data || attempts >= 10) {
        clearInterval(interval)
        setChecking(false)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [user])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-6">
      {checking ? (
        <>
          <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mb-6"
            style={{ borderColor: '#10b981', borderTopColor: 'transparent' }} />
          <p className="text-primary font-bold text-lg">Activating your Pro account…</p>
          <p className="text-muted text-sm mt-2">Just a moment</p>
        </>
      ) : (
        <>
          <div className="text-6xl mb-4">🎉</div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
            ✦ You're now Pro
          </div>
          <h1 className="text-3xl font-black text-primary mb-2">Welcome to Stride Pro!</h1>
          <p className="text-muted text-sm mb-8 max-w-sm">
            You now have full access to AI Coach, Import, Investments, Loans, and Accounts.
          </p>
          <button
            onClick={() => router.push('/')}
            className="btn-primary px-10 py-3 text-base"
          >
            Go to my Dashboard →
          </button>
        </>
      )}
    </div>
  )
}
