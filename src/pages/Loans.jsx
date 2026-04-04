import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const today = () => new Date().toISOString().split('T')[0]

const calcWithInterest = (principal, rate, startDate) => {
  if (!rate || !startDate) return principal
  const years = (new Date() - new Date(startDate + 'T12:00:00')) / (365.25 * 24 * 60 * 60 * 1000)
  if (years <= 0) return principal
  return principal * Math.pow(1 + rate / 100, years)
}

function ProGate({ feature, icon, description }) {
  const [upgrading, setUpgrading] = useState(false)
  const handleUpgrade = async () => {
    setUpgrading(true)
    try {
      const res = await fetch('/api/checkout', { method: 'POST' })
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

export default function Loans() {
  const { user } = useAuth()
  const [isPro, setIsPro] = useState(false)
  const [proLoading, setProLoading] = useState(true)
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('active')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ person_name: '', type: 'lent', amount: '', interest_rate: '', loan_date: today(), notes: '' })
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

  const load = async () => {
    const { data } = await supabase.from('loans').select('*').eq('user_id', user.id).order('loan_date', { ascending: false })
    setLoans(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [user.id])

  const openAdd = () => { setForm({ person_name: '', type: 'lent', amount: '', interest_rate: '', loan_date: today(), notes: '' }); setShowModal(true) }

  const handleSave = async e => {
    e.preventDefault()
    setSaving(true)
    const payload = { person_name: form.person_name.trim(), type: form.type, amount: parseFloat(form.amount), interest_rate: parseFloat(form.interest_rate) || 0, loan_date: form.loan_date, notes: form.notes, settled: false, user_id: user.id }
    await supabase.from('loans').insert(payload)
    setSaving(false); setShowModal(false); load()
  }

  const handleSettle = async id => {
    await supabase.from('loans').update({ settled: true }).eq('id', id).eq('user_id', user.id)
    load()
  }

  const handleDelete = async id => {
    await supabase.from('loans').delete().eq('id', id).eq('user_id', user.id)
    load()
  }

  const active = loans.filter(l => !l.settled)
  const settled = loans.filter(l => l.settled)
  const displayed = tab === 'active' ? active : settled

  const moneyLent = active.filter(l => l.type === 'lent').reduce((s, l) => s + calcWithInterest(l.amount, l.interest_rate, l.loan_date), 0)
  const moneyOwed = active.filter(l => l.type === 'borrowed').reduce((s, l) => s + calcWithInterest(l.amount, l.interest_rate, l.loan_date), 0)
  const netPosition = moneyLent - moneyOwed

  if (proLoading || loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }}></div></div>

  if (!isPro) return (
    <ProGate
      feature="Loans & Debts"
      icon="🤝"
      description="Track money you've lent or borrowed with automatic interest calculations and settlement tracking."
    />
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Loans & Debts</h1>
        <p className="text-muted text-sm mt-1">Track money lent and owed with interest</p>
      </div>

      <button onClick={openAdd} className="btn-primary mb-6">+ Add Loan</button>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl p-4" style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)' }}>
          <p className="text-muted text-xs mb-1">Money Lent Out</p>
          <p className="text-2xl font-bold text-primary">{fmt(moneyLent)}</p>
          <p className="text-muted text-xs">{active.filter(l => l.type === 'lent').length} active</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)' }}>
          <p className="text-muted text-xs mb-1">Money You Owe</p>
          <p className="text-2xl font-bold text-primary">{fmt(moneyOwed)}</p>
          <p className="text-muted text-xs">{active.filter(l => l.type === 'borrowed').length} active</p>
        </div>
        <div className="card p-4">
          <p className="text-muted text-xs mb-1">Net Position</p>
          <p className={`text-2xl font-bold ${netPosition >= 0 ? 'text-primary' : 'text-red-400'}`}>{fmt(netPosition)}</p>
          <p className="text-muted text-xs">{settled.length} settled</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {['active', 'settled'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ background: tab === t ? 'rgba(255,255,255,0.22)' : 'transparent', color: 'var(--text-primary)', border: tab === t ? '1px solid rgba(255,255,255,0.4)' : '1px solid var(--card-border)', borderRadius: 12, padding: '8px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer', transition: 'all 0.15s' }}>
            {t === 'active' ? `Active (${active.length})` : `Settled (${settled.length})`}
          </button>
        ))}
      </div>

      <div className="card p-5">
        {displayed.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">👥</div>
            <p className="font-semibold text-primary">No {tab === 'active' ? 'Active' : 'Settled'} Loans</p>
            {tab === 'active' && <button onClick={openAdd} className="btn-primary mt-4">+ Add a Loan</button>}
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map(loan => {
              const currentAmt = calcWithInterest(loan.amount, loan.interest_rate, loan.loan_date)
              const interest = currentAmt - loan.amount
              const isLent = loan.type === 'lent'
              return (
                <div key={loan.id} className="flex items-center justify-between p-4 rounded-xl" style={{ border: '1px solid var(--card-border)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                      style={{ background: isLent ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }}>
                      {isLent ? '↗' : '↘'}
                    </div>
                    <div>
                      <p className="font-semibold text-primary">{loan.person_name}</p>
                      <p className="text-xs text-muted">{isLent ? 'You lent' : 'You borrowed'} · {loan.loan_date}</p>
                      {loan.interest_rate > 0 && <p className="text-xs text-muted">{loan.interest_rate}% APR · Interest: {fmt(interest)}</p>}
                      {loan.notes && <p className="text-xs text-muted">{loan.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-bold" style={{ color: isLent ? 'var(--text-primary)' : '#ef4444' }}>{fmt(currentAmt)}</p>
                      {loan.interest_rate > 0 && <p className="text-xs text-muted">Original: {fmt(loan.amount)}</p>}
                    </div>
                    <div className="flex gap-1">
                      {!loan.settled && (
                        <button onClick={() => handleSettle(loan.id)}
                          className="text-xs px-2 py-1 rounded-lg font-medium hover:opacity-80"
                          style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--text-primary)', border: '1px solid rgba(16,185,129,0.3)' }}>
                          ✓ Settle
                        </button>
                      )}
                      <button onClick={() => handleDelete(loan.id)} className="text-sm px-1 hover:opacity-60" style={{ color: '#ef4444' }}>🗑</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <p className="font-semibold text-lg text-primary">Add Loan / Debt</p>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-primary text-xl">✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="mb-4"><label className="label">Person's Name</label><input className="input-field" placeholder="e.g., John Smith" value={form.person_name} onChange={e => setForm(f => ({ ...f, person_name: e.target.value }))} required /></div>
              <div className="mb-4">
                <label className="label">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setForm(f => ({ ...f, type: 'lent' }))}
                    className="py-3 rounded-xl text-sm font-semibold transition-colors"
                    style={{ border: form.type === 'lent' ? '1px solid rgba(16,185,129,0.6)' : '1px solid var(--card-border)', background: form.type === 'lent' ? 'rgba(16,185,129,0.15)' : 'transparent', color: 'var(--text-primary)' }}>
                    💸 I Lent Money
                  </button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, type: 'borrowed' }))}
                    className="py-3 rounded-xl text-sm font-semibold transition-colors"
                    style={{ border: form.type === 'borrowed' ? '1px solid rgba(239,68,68,0.6)' : '1px solid var(--card-border)', background: form.type === 'borrowed' ? 'rgba(239,68,68,0.15)' : 'transparent', color: form.type === 'borrowed' ? '#ef4444' : 'var(--text-primary)' }}>
                    🤲 I Borrowed
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div><label className="label">Original Amount ($)</label><input className="input-field" type="number" step="0.01" min="0" placeholder="500.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required /></div>
                <div><label className="label">Annual Interest Rate (%)</label><input className="input-field" type="number" step="0.01" min="0" placeholder="0 = interest-free" value={form.interest_rate} onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))} /></div>
              </div>
              <div className="mb-4"><label className="label">Loan Date</label><input className="input-field" type="date" value={form.loan_date} onChange={e => setForm(f => ({ ...f, loan_date: e.target.value }))} required /></div>
              <div className="mb-6"><label className="label">Notes (optional)</label><input className="input-field" placeholder="e.g., For rent payment" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary justify-center">{saving ? 'Saving...' : 'Add Loan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
