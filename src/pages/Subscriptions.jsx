// src/pages/Subscriptions.jsx
// Detects recurring charges from transaction history. "Cancel" only updates
// our own tracking — there's no API to actually cancel a subscription with
// the provider, so we deep-link to their account page and let the user
// confirm once they've finished it there.
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useTransactions } from '../hooks/useTransactions'
import { useSubscriptions, detectRecurring, monthlyEquivalent } from '../hooks/useSubscriptions'

const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)

function ProGate({ feature, icon, description, userId }) {
  const [upgrading, setUpgrading] = useState(false)
  const handleUpgrade = async () => {
    setUpgrading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch { setUpgrading(false) }
  }
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-6">
      <div className="text-5xl mb-4">{icon}</div>
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3"
        style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
        ✦ Pro Feature
      </div>
      <h2 className="text-xl font-black text-primary mb-2">{feature}</h2>
      <p className="text-muted text-sm mb-6 max-w-xs">{description}</p>
      <button onClick={handleUpgrade} disabled={upgrading} className="btn-primary px-8">
        {upgrading ? 'Redirecting…' : '⚡ Upgrade to Pro — $4.99/mo'}
      </button>
    </div>
  )
}

export default function Subscriptions() {
  const { user } = useAuth()
  const { transactions, loading } = useTransactions()
  const {
    tracked: trackedSubs, track: trackSub, cancelDetected: cancelDetectedSub,
    cancel: cancelSub, reactivate: reactivateSub,
  } = useSubscriptions(user?.id)

  const [isPro, setIsPro] = useState(false)
  const [proLoading, setProLoading] = useState(true)
  const [cancelTarget, setCancelTarget] = useState(null) // { detected } or { tracked }

  useEffect(() => {
    const checkPro = async () => {
      const { data } = await supabase
        .from('subscriptions').select('status')
        .eq('user_id', user.id).eq('status', 'active').maybeSingle()
      setIsPro(!!data)
      setProLoading(false)
    }
    checkPro()
  }, [user.id])

  const trackedKeys = useMemo(() => new Set(trackedSubs.map(s => s.merchant_key)), [trackedSubs])
  const untrackedDetected = useMemo(
    () => detectRecurring(transactions).filter(d => !trackedKeys.has(d.merchantKey)),
    [transactions, trackedKeys]
  )
  const activeSubs      = trackedSubs.filter(s => s.status === 'active')
  const cancelledSubs   = trackedSubs.filter(s => s.status === 'cancelled')
  const monthlySubTotal = activeSubs.reduce((s, sub) => s + monthlyEquivalent(sub), 0)

  if (proLoading || loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }} />
    </div>
  )

  if (!isPro) return (
    <ProGate
      feature="Subscriptions"
      icon="🔁"
      description="Automatically detect recurring charges like Netflix or Spotify, track their monthly cost, and get a shortcut to cancel them."
      userId={user.id}
    />
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-primary tracking-tight">Subscriptions</h1>
        <p className="text-muted text-sm mt-1">Recurring charges detected from your transactions</p>
      </div>

      <div className="mb-4 p-3 rounded-xl text-xs"
        style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#f59e0b' }}>
        ⚠ We can't cancel subscriptions for you — no provider offers that. Cancelling here just stops
        counting it as active spend and points you to where to finish the job yourself.
      </div>

      {activeSubs.length > 0 && (
        <div className="card p-4 mb-5">
          <p className="text-muted text-xs mb-1">Monthly Subscription Cost</p>
          <p className="text-2xl font-black text-primary">{fmt(monthlySubTotal)}/mo</p>
          <p className="text-xs text-muted mt-1">{activeSubs.length} active subscription{activeSubs.length !== 1 ? 's' : ''}</p>
        </div>
      )}

      {untrackedDetected.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Detected Recurring Charges</p>
          <div className="space-y-2">
            {untrackedDetected.map(d => (
              <div key={d.merchantKey} className="card p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-primary text-sm capitalize">{d.name}</p>
                  <p className="text-xs text-muted">{fmt(d.amount)} · {d.frequency} · last {d.lastDate}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => trackSub(d)} className="btn-secondary text-xs px-3 py-1.5">+ Track</button>
                  <button onClick={() => setCancelTarget({ detected: d })} className="text-xs text-muted hover:text-red-500 px-3 py-1.5 rounded border"
                    style={{ borderColor: 'var(--card-border)' }}>Cancel</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSubs.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Your Subscriptions</p>
          <div className="space-y-2">
            {activeSubs.map(sub => (
              <div key={sub.id} className="card p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-primary text-sm capitalize">{sub.name}</p>
                  <p className="text-xs text-muted">{fmt(sub.amount)} · {sub.frequency}</p>
                </div>
                <button onClick={() => setCancelTarget({ tracked: sub })} className="text-xs text-muted hover:text-red-500 px-3 py-1.5 rounded border"
                  style={{ borderColor: 'var(--card-border)' }}>Cancel</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {cancelledSubs.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Cancelled</p>
          <div className="space-y-2">
            {cancelledSubs.map(sub => (
              <div key={sub.id} className="card p-4 flex items-center justify-between opacity-60">
                <div>
                  <p className="font-semibold text-primary text-sm capitalize line-through">{sub.name}</p>
                  <p className="text-xs text-muted">{fmt(sub.amount)} · {sub.frequency}</p>
                </div>
                <button onClick={() => reactivateSub(sub.id)} className="text-xs text-muted hover:text-primary px-3 py-1.5 rounded border"
                  style={{ borderColor: 'var(--card-border)' }}>Reactivate</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {untrackedDetected.length === 0 && trackedSubs.length === 0 && (
        <div className="card p-12 text-center" style={{ border: '2px dashed var(--card-border)' }}>
          <p className="text-4xl mb-3">🔁</p>
          <p className="font-black text-primary text-lg mb-2">No recurring charges detected yet</p>
          <p className="text-muted text-sm">Once you log or sync a few months of transactions, repeating charges show up here automatically.</p>
        </div>
      )}

      {/* ══════════════════ CANCEL SUBSCRIPTION MODAL ══════════════════ */}
      {cancelTarget && (
        <div className="modal-overlay" onClick={() => setCancelTarget(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            {(() => {
              const d    = cancelTarget.detected
              const t    = cancelTarget.tracked
              const name = d?.name || t?.name
              const url  = d ? null : t.cancel_url
              return (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <p className="accent-text font-black text-lg capitalize">Cancel {name}</p>
                    <button onClick={() => setCancelTarget(null)} className="text-muted hover:text-primary text-xl">✕</button>
                  </div>
                  <p className="text-muted text-sm mb-5">
                    We can't cancel this with the provider for you. Finish it on their site, then confirm here so we stop counting it as active spend.
                  </p>
                  <a
                    href={url || `https://www.google.com/search?q=${encodeURIComponent(`cancel ${name} subscription`)}`}
                    target="_blank" rel="noreferrer"
                    className="btn-secondary w-full justify-center mb-3"
                  >
                    ↗ Open {name}'s account page
                  </a>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setCancelTarget(null)} className="btn-secondary justify-center">Never mind</button>
                    <button
                      onClick={async () => {
                        if (t) await cancelSub(t.id)
                        else   await cancelDetectedSub(d)
                        setCancelTarget(null)
                      }}
                      className="btn-primary justify-center"
                      style={{ background: '#ef4444' }}
                    >
                      I've cancelled it
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
