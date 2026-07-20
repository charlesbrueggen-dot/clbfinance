import { useState, useEffect } from 'react'
import {
  ArrowUpRight, ArrowDownRight, Check, Trash2,
  Users, HandCoins, Wallet, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { fmtCompact, fmtCurrency as fmt } from '../lib/format'
import { calcWithInterest } from '../lib/loanMath'
import { PageHeader, StatCard, EmptyState, PageSkeleton, SegTabs } from '../components/ui'

const today = () => new Date().toISOString().split('T')[0]

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

  // Deep link from the Dashboard's "+ Add" menu: /loans?add=1 opens the form
  useEffect(() => {
    if (!loading && new URLSearchParams(window.location.search).get('add') === '1') openAdd()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

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

  if (loading) return <PageSkeleton stats={3} hero={false} />

  return (
    <div>
      <PageHeader title="Loans & Debts" subtitle="Track money lent and owed with interest">
        <button onClick={openAdd} className="btn-primary text-sm">+ Add Loan</button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="Money Lent Out" value={fmtCompact(moneyLent)} tone="#10b981"
          sub={`${active.filter(l => l.type === 'lent').length} active`} />
        <StatCard label="Money You Owe" value={fmtCompact(moneyOwed)} tone="#ef4444"
          sub={`${active.filter(l => l.type === 'borrowed').length} active`} />
        <StatCard label="Net Position" value={fmtCompact(netPosition)}
          valueStyle={netPosition < 0 ? { color: 'var(--negative-strong)' } : undefined}
          sub={`${settled.length} settled`} />
      </div>

      <div className="mb-4">
        <SegTabs
          tabs={[
            { value: 'active', label: `Active (${active.length})` },
            { value: 'settled', label: `Settled (${settled.length})` },
          ]}
          active={tab} onChange={setTab}
        />
      </div>

      <div className="card p-5">
        {displayed.length === 0 ? (
          <EmptyState Icon={Users} title={`No ${tab === 'active' ? 'Active' : 'Settled'} Loans`}>
            {tab === 'active' && <button onClick={openAdd} className="btn-primary">+ Add a Loan</button>}
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {displayed.map(loan => {
              const currentAmt = calcWithInterest(loan.amount, loan.interest_rate, loan.loan_date)
              const interest = currentAmt - loan.amount
              const isLent = loan.type === 'lent'
              return (
                <div key={loan.id} className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-xl" style={{ border: '1px solid var(--card-border)' }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: isLent ? 'var(--positive-bg)' : 'var(--negative-bg)', color: isLent ? 'var(--positive)' : 'var(--negative)' }}>
                      {isLent ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-primary truncate">{loan.person_name}</p>
                      <p className="text-xs text-muted">{isLent ? 'You lent' : 'You borrowed'} · {loan.loan_date}</p>
                      {loan.interest_rate > 0 && <p className="text-xs text-muted">{loan.interest_rate}% APR · Interest: {fmtCompact(interest)}</p>}
                      {loan.notes && <p className="text-xs text-muted truncate">{loan.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="font-bold" style={{ color: isLent ? 'var(--text-primary)' : 'var(--negative-strong)' }} title={fmt(currentAmt)}>{fmtCompact(currentAmt)}</p>
                      {loan.interest_rate > 0 && <p className="text-xs text-muted">Original: {fmtCompact(loan.amount)}</p>}
                    </div>
                    <div className="flex gap-1">
                      {!loan.settled && (
                        <button onClick={() => handleSettle(loan.id)}
                          className="text-xs px-2 py-1 rounded-lg font-medium hover:opacity-80"
                          style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--text-primary)', border: '1px solid rgba(16,185,129,0.3)' }}>
                          <Check size={12} className="inline" /> Settle
                        </button>
                      )}
                      <button onClick={() => handleDelete(loan.id)} className="px-1 hover:opacity-60" style={{ color: 'var(--negative-strong)' }}><Trash2 size={15} /></button>
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
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-primary"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="mb-4"><label className="label">Person's Name</label><input className="input-field" placeholder="e.g., John Smith" value={form.person_name} onChange={e => setForm(f => ({ ...f, person_name: e.target.value }))} required /></div>
              <div className="mb-4">
                <label className="label">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setForm(f => ({ ...f, type: 'lent' }))}
                    className="py-3 rounded-xl text-sm font-semibold transition-colors"
                    style={{ border: form.type === 'lent' ? '1px solid rgba(16,185,129,0.6)' : '1px solid var(--card-border)', background: form.type === 'lent' ? 'rgba(16,185,129,0.15)' : 'transparent', color: 'var(--text-primary)' }}>
                    <HandCoins size={15} className="inline mr-1" /> I Lent Money
                  </button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, type: 'borrowed' }))}
                    className="py-3 rounded-xl text-sm font-semibold transition-colors"
                    style={{ border: form.type === 'borrowed' ? '1px solid var(--negative)' : '1px solid var(--card-border)', background: form.type === 'borrowed' ? 'var(--negative-bg)' : 'transparent', color: form.type === 'borrowed' ? 'var(--negative)' : 'var(--text-primary)' }}>
                    <Wallet size={15} className="inline mr-1" /> I Borrowed
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4 items-end">
                <div><label className="label">Amount ($)</label><input className="input-field" type="number" step="0.01" min="0" placeholder="500.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required /></div>
                <div><label className="label">Interest (%/yr)</label><input className="input-field" type="number" step="0.01" min="0" placeholder="0 = interest-free" value={form.interest_rate} onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))} /></div>
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
