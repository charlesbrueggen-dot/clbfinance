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

export default function Loans() {
  const { user } = useAuth()
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('active')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ person_name: '', type: 'lent', amount: '', interest_rate: '', loan_date: today(), notes: '' })
  const [saving, setSaving] = useState(false)

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
    if (!confirm('Mark this loan as settled?')) return
    await supabase.from('loans').update({ settled: true }).eq('id', id).eq('user_id', user.id)
    load()
  }

  const handleDelete = async id => {
    if (!confirm('Delete this loan?')) return
    await supabase.from('loans').delete().eq('id', id).eq('user_id', user.id)
    load()
  }

  const active = loans.filter(l => !l.settled)
  const settled = loans.filter(l => l.settled)
  const displayed = tab === 'active' ? active : settled

  const moneyLent = active.filter(l => l.type === 'lent').reduce((s, l) => s + calcWithInterest(l.amount, l.interest_rate, l.loan_date), 0)
  const moneyOwed = active.filter(l => l.type === 'borrowed').reduce((s, l) => s + calcWithInterest(l.amount, l.interest_rate, l.loan_date), 0)
  const netPosition = moneyLent - moneyOwed

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-t-transparent border-t-transparent rounded-full animate-spin"></div></div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Loans & Debts</h1>
        <p className="text-muted text-sm mt-1">Track money lent and owed with interest</p>
      </div>

      <button onClick={openAdd} className="btn-primary mb-6">+ Add Loan</button>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl p-4" style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)' }}>
          <p className="text-muted text-xs mb-1">Money Lent Out</p>
          <p className="text-2xl font-bold">{fmt(moneyLent)}</p>
          <p className="text-white/70 text-xs">{active.filter(l => l.type === 'lent').length} active</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)' }}>
          <p className="text-muted text-xs mb-1">Money You Owe</p>
          <p className="text-2xl font-bold">{fmt(moneyOwed)}</p>
          <p className="text-white/70 text-xs">{active.filter(l => l.type === 'borrowed').length} active</p>
        </div>
        <div className="card p-4">
          <p className="text-muted text-xs mb-1">Net Position</p>
          <p className={`text-2xl font-bold ${netPosition >= 0 ? 'text-primary' : 'text-red-500'}`}>{fmt(netPosition)}</p>
          <p className="text-muted text-xs">{settled.length} settled</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('active')} className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${tab === 'active' ? 'bg-white dark:bg-gray-900 shadow text-primary border-gray-200 dark:border-gray-700' : 'text-muted border-transparent'}`}>
          Active ({active.length})
        </button>
        <button onClick={() => setTab('settled')} className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${tab === 'settled' ? 'bg-white dark:bg-gray-900 shadow text-primary border-gray-200 dark:border-gray-700' : 'text-muted border-transparent'}`}>
          Settled ({settled.length})
        </button>
      </div>

      {/* Loan List */}
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
                <div key={loan.id} className="flex items-center justify-between p-4 rounded-xl border" style={{ borderColor: 'var(--card-border)' }}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${isLent ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
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
                      <p className={`font-bold ${isLent ? 'text-primary' : 'text-red-500'}`}>{fmt(currentAmt)}</p>
                      {loan.interest_rate > 0 && <p className="text-xs text-muted">Original: {fmt(loan.amount)}</p>}
                    </div>
                    <div className="flex gap-1">
                      {!loan.settled && <button onClick={() => handleSettle(loan.id)} className="text-xs px-2 py-1 rounded-lg bg-emerald-100 text-primary dark:bg-emerald-900/30 dark:text-primary font-medium hover:opacity-80">✓ Settle</button>}
                      <button onClick={() => handleDelete(loan.id)} className="text-muted hover:text-red-500 text-sm px-1">🗑</button>
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
              <p className="accent-text font-semibold text-lg">Add Loan / Debt</p>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-primary text-xl">✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="mb-4"><label className="label">Person's Name</label><input className="input-field" placeholder="e.g., John Smith" value={form.person_name} onChange={e => setForm(f => ({ ...f, person_name: e.target.value }))} required /></div>
              <div className="mb-4">
                <label className="label">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setForm(f => ({ ...f, type: 'lent' }))} className={`py-3 rounded-xl text-sm font-semibold border transition-colors ${form.type === 'lent' ? 'border-t-transparent bg-emerald-50 dark:bg-emerald-900/20 text-primary dark:text-primary' : 'border-gray-200 dark:border-gray-700 text-muted'}`}>
                    💸 I Lent Money
                  </button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, type: 'borrowed' }))} className={`py-3 rounded-xl text-sm font-semibold border transition-colors ${form.type === 'borrowed' ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'border-gray-200 dark:border-gray-700 text-muted'}`}>
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
