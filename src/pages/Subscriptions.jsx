// src/pages/Subscriptions.jsx
// Detects recurring charges from transaction history and lets the user
// track/cancel/manually-add subscriptions. "Cancel" only updates our own
// tracking — there's no API to actually cancel a subscription with the
// provider — so we deep-link to their account page and let the user
// confirm once they've finished it there.
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useTransactions } from '../hooks/useTransactions'
import {
  useSubscriptions, detectRecurring, monthlyEquivalent, daysUntil,
  CATEGORIES, CATEGORY_ICON,
} from '../hooks/useSubscriptions'

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

function RenewalBadge({ date }) {
  const d = daysUntil(date)
  if (d === null) return null
  if (d < 0)  return <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>Overdue {Math.abs(d)}d</span>
  if (d === 0) return <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>Renews today</span>
  if (d <= 7)  return <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>Renews in {d}d</span>
  return <span className="text-xs text-muted">Renews {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
}

const blankForm = () => ({
  name: '', amount: '', frequency: 'monthly', category: 'Other',
  next_billing_date: '', cancel_url: '',
})

export default function Subscriptions() {
  const { user } = useAuth()
  const { transactions, loading } = useTransactions()
  const {
    tracked: trackedSubs, track: trackSub, cancelDetected: cancelDetectedSub,
    cancel: cancelSub, reactivate: reactivateSub, addManual, updateSub,
  } = useSubscriptions(user?.id)

  const [isPro, setIsPro] = useState(false)
  const [proLoading, setProLoading] = useState(true)
  const [cancelTarget, setCancelTarget] = useState(null) // { detected } or { tracked }
  const [showForm, setShowForm] = useState(false)
  const [editingSub, setEditingSub] = useState(null)
  const [form, setForm] = useState(blankForm())
  const [saving, setSaving] = useState(false)

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

  const allDetected      = useMemo(() => detectRecurring(transactions), [transactions])
  const trackedKeys      = useMemo(() => new Set(trackedSubs.map(s => s.merchant_key)), [trackedSubs])
  const untrackedAll      = useMemo(() => allDetected.filter(d => !trackedKeys.has(d.merchantKey)), [allDetected, trackedKeys])
  // "possible" = seen once so far, not enough data to confirm a repeat yet —
  // surfaced separately (read-only) instead of silently dropped or acted on.
  const untrackedDetected = useMemo(() => untrackedAll.filter(d => d.confidence !== 'possible'), [untrackedAll])
  const possibleWatching  = useMemo(() => untrackedAll.filter(d => d.confidence === 'possible'), [untrackedAll])

  // Silently keep already-tracked subscriptions in sync with new transactions
  // (updates amount/last-charge/next-billing-date, flags price changes) —
  // this is the piece that'll do real work once transactions start flowing
  // in continuously from a connected bank.
  useEffect(() => {
    const stale = allDetected.filter(d => {
      const row = trackedSubs.find(s => s.merchant_key === d.merchantKey)
      return row && row.status === 'active' && row.last_charge_date !== d.lastDate
    })
    if (stale.length === 0) return
    ;(async () => { for (const d of stale) await trackSub(d) })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDetected])

  const activeSubs = trackedSubs
    .filter(s => s.status === 'active')
    .sort((a, b) => (a.next_billing_date || '9999').localeCompare(b.next_billing_date || '9999'))
  const cancelledSubs   = trackedSubs.filter(s => s.status === 'cancelled')
  const monthlySubTotal = activeSubs.reduce((s, sub) => s + monthlyEquivalent(sub), 0)
  const renewingSoon    = activeSubs.filter(s => {
    const d = daysUntil(s.next_billing_date)
    return d !== null && d <= 7
  })

  const openAdd  = () => { setEditingSub(null); setForm(blankForm()); setShowForm(true) }
  const openEdit = sub => {
    setEditingSub(sub)
    setForm({
      name: sub.name, amount: sub.amount, frequency: sub.frequency,
      category: sub.category || 'Other', next_billing_date: sub.next_billing_date || '',
      cancel_url: sub.cancel_url || '',
    })
    setShowForm(true)
  }

  const handleSubmitForm = async e => {
    e.preventDefault(); setSaving(true)
    if (editingSub) await updateSub(editingSub.id, form)
    else             await addManual(form)
    setSaving(false); setShowForm(false)
  }

  if (proLoading || loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }} />
    </div>
  )

  if (!isPro) return (
    <ProGate
      feature="Subscriptions"
      icon="🔁"
      description="Automatically detect recurring charges like Netflix or Spotify, see what's renewing soon, and get a shortcut to cancel them."
      userId={user.id}
    />
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tight">Subscriptions</h1>
          <p className="text-muted text-sm mt-1">Recurring charges detected from your transactions</p>
        </div>
        <button onClick={openAdd} className="btn-primary text-sm px-4">+ Add</button>
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
          <p className="text-xs text-muted mt-1">
            ≈ {fmt(monthlySubTotal * 12)}/yr · {activeSubs.length} active subscription{activeSubs.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {renewingSoon.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Renewing Soon</p>
          <div className="space-y-2">
            {renewingSoon.map(sub => (
              <div key={sub.id} className="card p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{CATEGORY_ICON[sub.category] || '🔁'}</span>
                  <p className="text-sm font-semibold text-primary">{sub.name}</p>
                  <span className="text-xs text-muted">{fmt(sub.amount)}</span>
                </div>
                <RenewalBadge date={sub.next_billing_date} />
              </div>
            ))}
          </div>
        </div>
      )}

      {untrackedDetected.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Detected Recurring Charges</p>
          <div className="space-y-2">
            {untrackedDetected.map(d => (
              <div key={d.merchantKey} className="card p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{CATEGORY_ICON[d.category] || '🔁'}</span>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-primary text-sm">{d.name}</p>
                      {d.confidence === 'likely' && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                          1 repeat so far
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted">{fmt(d.amount)} · {d.frequency} · est. next {d.nextDate}</p>
                  </div>
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

      {possibleWatching.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Possible Subscriptions — Monitoring</p>
          <p className="text-xs text-muted mb-2">Seen once so far — we'll confirm these once a second charge shows up.</p>
          <div className="space-y-2">
            {possibleWatching.map(d => (
              <div key={d.merchantKey} className="card p-3 flex items-center justify-between opacity-70">
                <div className="flex items-center gap-2">
                  <span>{CATEGORY_ICON[d.category] || '🔁'}</span>
                  <p className="text-sm text-primary">{d.name}</p>
                </div>
                <p className="text-xs text-muted">{fmt(d.amount)} · seen {d.lastDate}</p>
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
              <div key={sub.id} className="card p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg flex-shrink-0">{CATEGORY_ICON[sub.category] || '🔁'}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-primary text-sm truncate">{sub.name}</p>
                      {sub.previous_amount != null && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                          ↑ was {fmt(sub.previous_amount)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted">{fmt(sub.amount)} · {sub.frequency} · {sub.category}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <RenewalBadge date={sub.next_billing_date} />
                  <button onClick={() => openEdit(sub)} className="text-xs text-muted hover:text-primary px-2 py-1 rounded border"
                    style={{ borderColor: 'var(--card-border)' }}>Edit</button>
                  <button onClick={() => setCancelTarget({ tracked: sub })} className="text-xs text-muted hover:text-red-500 px-2 py-1 rounded border"
                    style={{ borderColor: 'var(--card-border)' }}>Cancel</button>
                </div>
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
                  <p className="font-semibold text-primary text-sm line-through">{sub.name}</p>
                  <p className="text-xs text-muted">{fmt(sub.amount)} · {sub.frequency}</p>
                </div>
                <button onClick={() => reactivateSub(sub.id)} className="text-xs text-muted hover:text-primary px-3 py-1.5 rounded border"
                  style={{ borderColor: 'var(--card-border)' }}>Reactivate</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {untrackedDetected.length === 0 && possibleWatching.length === 0 && trackedSubs.length === 0 && (
        <div className="card p-12 text-center" style={{ border: '2px dashed var(--card-border)' }}>
          <p className="text-4xl mb-3">🔁</p>
          <p className="font-black text-primary text-lg mb-2">No recurring charges detected yet</p>
          <p className="text-muted text-sm mb-4">Once you log or sync a few months of transactions, repeating charges show up here automatically.</p>
          <button onClick={openAdd} className="btn-secondary">+ Add one manually</button>
        </div>
      )}

      {/* ══════════════════ ADD / EDIT SUBSCRIPTION MODAL ══════════════════ */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <p className="accent-text font-black text-lg">{editingSub ? 'Edit Subscription' : 'Add Subscription'}</p>
              <button onClick={() => setShowForm(false)} className="text-muted hover:text-primary text-xl">✕</button>
            </div>
            <form onSubmit={handleSubmitForm}>
              <div className="mb-4">
                <label className="label">Name</label>
                <input className="input-field" placeholder="e.g., Netflix" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="label">Amount ($)</label>
                  <input className="input-field" type="number" step="0.01" min="0" placeholder="0.00" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Frequency</label>
                  <select className="input-field" value={form.frequency}
                    onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="label">Category</label>
                <select className="input-field" value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_ICON[c]} {c}</option>)}
                </select>
              </div>
              <div className="mb-4">
                <label className="label">Next Billing Date (optional)</label>
                <input className="input-field" type="date" value={form.next_billing_date}
                  onChange={e => setForm(f => ({ ...f, next_billing_date: e.target.value }))} />
              </div>
              <div className="mb-6">
                <label className="label">Cancel Page URL (optional)</label>
                <input className="input-field" type="url" placeholder="Auto-filled if left blank" value={form.cancel_url}
                  onChange={e => setForm(f => ({ ...f, cancel_url: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary justify-center">{saving ? 'Saving…' : editingSub ? 'Save Changes' : 'Add Subscription'}</button>
              </div>
            </form>
          </div>
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
              const url  = d ? d.cancelUrl : t.cancel_url
              return (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <p className="accent-text font-black text-lg">Cancel {name}</p>
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
