// src/pages/Expenses.jsx
// ─────────────────────────────────────────────────────────────────────────────
//  Expenses — unified view of:
//   1. Legacy manual expenses (expenses table — unchanged)
//   2. Account transactions tagged kind='expense' (account_transactions table)
//  Both sources rendered together, sorted by date.
//  Account transactions show a credit-card badge and link to the account.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react'
import {
  CreditCard, Home, ShoppingCart, Zap, Car, Stethoscope, Clock,
  Receipt, Repeat, Pencil, Trash2, X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useTransactions } from '../hooks/useTransactions'

const fmt  = n  => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const today = () => new Date().toISOString().split('T')[0]
const QUICK_AMOUNTS = [1, 5, 10, 50, 100, 500]

const QUICK_CATS = [
  { label: 'Rent/Mortgage',   Icon: Home, category: 'Needs', sub: 'Rent' },
  { label: 'Groceries',       Icon: ShoppingCart, category: 'Needs', sub: 'Groceries' },
  { label: 'Utilities',       Icon: Zap, category: 'Needs', sub: 'Utilities' },
  { label: 'Transportation',  Icon: Car, category: 'Needs', sub: 'Transportation' },
  { label: 'Healthcare',      Icon: Stethoscope, category: 'Needs', sub: 'Healthcare' },
]

const CATEGORIES    = ['Needs', 'Wants', 'Savings']
const SUBCATEGORIES = {
  Needs:   ['Rent', 'Groceries', 'Utilities', 'Transportation', 'Healthcare', 'Insurance', 'Other'],
  Wants:   ['Dining', 'Entertainment', 'Shopping', 'Travel', 'Subscriptions', 'Other'],
  Savings: ['Emergency Fund', 'Retirement', 'Investment', 'Vacation', 'Other'],
}
const FILTER_TABS = ['All', 'Needs', 'Wants', 'Savings']

const FREQUENCY_OPTIONS = [
  { value: 'none',     label: 'One-Time',  icon: '1x'  },
  { value: 'weekly',   label: 'Weekly',    icon: '7d'  },
  { value: 'biweekly', label: 'Bi-Weekly', icon: '14d' },
  { value: 'monthly',  label: 'Monthly',   icon: '30d' },
]

const frequencyLabel = f => ({ none: 'One-Time', weekly: 'Weekly', biweekly: 'Bi-Weekly', monthly: 'Monthly' }[f] || 'One-Time')

const calcNextDue = (startDate, frequency) => {
  if (!startDate || frequency === 'none') return ''
  const d = new Date(startDate)
  if (isNaN(d)) return ''
  if (frequency === 'weekly')   d.setDate(d.getDate() + 7)
  if (frequency === 'biweekly') d.setDate(d.getDate() + 14)
  if (frequency === 'monthly')  d.setMonth(d.getMonth() + 1)
  return d.toISOString().split('T')[0]
}

export default function Expenses() {
  const { user }                                   = useAuth()
  const { expenseTxns, accounts, reload: reloadTxns } = useTransactions()

  // Legacy expenses table
  const [legacyExpenses, setLegacyExpenses] = useState([])
  const [loading,        setLoading]        = useState(true)

  const [search,   setSearch]   = useState('')
  const [tab,      setTab]      = useState('All')
  const [step,     setStep]     = useState(null)
  const [editItem, setEditItem] = useState(null)
  const [form,     setForm]     = useState({
    description: '', amount: '', category: 'Needs', subcategory: 'Other',
    date: today(), notes: '', frequency: 'none', next_due: '',
  })
  const [saving, setSaving] = useState(false)

  // Which source are we editing: 'legacy' | 'account_txn'
  const [editSource, setEditSource] = useState('legacy')

  const loadLegacy = async () => {
    const { data } = await supabase.from('expenses').select('*').eq('user_id', user.id).order('date', { ascending: false })
    setLegacyExpenses(data || [])
    setLoading(false)
  }
  useEffect(() => { loadLegacy() }, [user.id])

  // ── Merge both sources ──────────────────────────────────────────────────────
  const allExpenses = useMemo(() => {
    const legacy = legacyExpenses.map(e => ({ ...e, _source: 'legacy' }))
    const accTxns = expenseTxns.map(t => ({
      id:          t.id,
      description: t.description,
      amount:      t.amount,
      category:    t.category || 'Wants',
      subcategory: t.subcategory || 'Other',
      date:        t.date,
      notes:       t.notes || '',
      frequency:   'none',
      next_due:    null,
      recurring:   false,
      label:       t.label,
      merchant:    t.merchant,
      card_last4:  t.card_last4,
      account_id:  t.account_id,
      _source:     'account_txn',
      _account:    accounts.find(a => a.id === t.account_id),
    }))
    return [...legacy, ...accTxns].sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [legacyExpenses, expenseTxns, accounts])

  // ── CRUD — legacy ──────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditItem(null); setEditSource('legacy')
    setForm({ description: '', amount: '', category: 'Needs', subcategory: 'Other', date: today(), notes: '', frequency: 'none', next_due: '' })
    setStep('quick')
  }

  const openEdit = item => {
    setEditItem(item)
    setEditSource(item._source)
    setForm({
      description: item.description, amount: item.amount,
      category:    item.category,    subcategory: item.subcategory || 'Other',
      date:        item.date,        notes: item.notes || '',
      frequency:   item.frequency || 'none', next_due: item.next_due || '',
    })
    setStep('form')
  }

  const selectQuickCat = qc => {
    setForm(f => ({ ...f, description: qc.label, category: qc.category, subcategory: qc.sub }))
    setStep('form')
  }

  const handleSave = async e => {
    e.preventDefault()
    if (!form.description.trim() || !form.amount) return
    setSaving(true)

    if (editSource === 'account_txn' && editItem) {
      // Update in account_transactions
      await supabase.from('account_transactions').update({
        description: form.description.trim(),
        amount:      parseFloat(form.amount),
        category:    form.category,
        subcategory: form.subcategory,
        date:        form.date,
        notes:       form.notes,
      }).eq('id', editItem.id).eq('user_id', user.id)
      await reloadTxns()
    } else {
      // Legacy expenses table
      const payload = {
        description: form.description.trim(), amount: parseFloat(form.amount),
        category:    form.category,           subcategory: form.subcategory,
        date:        form.date,               notes: form.notes,
        frequency:   form.frequency,
        next_due:    form.frequency !== 'none' ? (form.next_due || calcNextDue(form.date, form.frequency) || null) : null,
        recurring:   form.frequency !== 'none',
        user_id:     user.id,
      }
      if (editItem) await supabase.from('expenses').update(payload).eq('id', editItem.id).eq('user_id', user.id)
      else          await supabase.from('expenses').insert(payload)
      await loadLegacy()
    }

    setSaving(false); setStep(null)
  }

  const handleDelete = async item => {
    if (item._source === 'account_txn') {
      await supabase.from('account_transactions').delete().eq('id', item.id).eq('user_id', user.id)
      reloadTxns()
    } else {
      await supabase.from('expenses').delete().eq('id', item.id).eq('user_id', user.id)
      loadLegacy()
    }
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalExpenses = allExpenses.reduce((s, e) => s + parseFloat(e.amount), 0)
  const needs         = allExpenses.filter(e => e.category === 'Needs').reduce((s, e) => s + parseFloat(e.amount), 0)
  const wants         = allExpenses.filter(e => e.category === 'Wants').reduce((s, e) => s + parseFloat(e.amount), 0)
  const savings       = allExpenses.filter(e => e.category === 'Savings').reduce((s, e) => s + parseFloat(e.amount), 0)

  const filtered = allExpenses.filter(e => {
    const matchTab    = tab === 'All' || e.category === tab
    const matchSearch = !search || e.description.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  const upcoming = legacyExpenses
    .filter(e => e.frequency && e.frequency !== 'none' && e.next_due)
    .sort((a, b) => new Date(a.next_due) - new Date(b.next_due))
    .slice(0, 5)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Expenses</h1>
        <p className="text-muted text-sm mt-1">All spending — manual entries & account transactions</p>
      </div>

      <button onClick={openAdd} className="btn-primary mb-6">+ Add Expense</button>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl p-4" style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)' }}>
          <p className="text-muted text-xs mb-1">Total Expenses</p>
          <p className="text-2xl font-bold text-primary">{fmt(totalExpenses)}</p>
          <p className="text-xs text-muted mt-1">{allExpenses.length} entries</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-muted text-xs">Needs</p>
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#10b981' }} />
          </div>
          <p className="font-bold text-primary">{fmt(needs)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-muted text-xs">Wants</p>
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#f59e0b' }} />
          </div>
          <p className="font-bold text-primary">{fmt(wants)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-muted text-xs">Savings</p>
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#3b82f6' }} />
          </div>
          <p className="font-bold text-primary">{fmt(savings)}</p>
        </div>
      </div>

      {/* Upcoming recurring */}
      {upcoming.length > 0 && (
        <div className="card p-4 mb-6">
          <p className="font-bold text-primary text-sm mb-3 flex items-center gap-1.5"><Clock size={14} /> Upcoming Recurring</p>
          <div className="space-y-2">
            {upcoming.map(e => (
              <div key={e.id} className="flex justify-between text-sm">
                <span className="text-muted">{e.description}</span>
                <div className="flex items-center gap-2">
                  <span className="text-primary font-medium">{fmt(e.amount)}</span>
                  <span className="text-muted text-xs">due {e.next_due}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source legend */}
      {expenseTxns.length > 0 && (
        <div className="flex gap-3 mb-4 text-xs">
          <span className="flex items-center gap-1.5 text-muted">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: '#ef4444' }} /> Manual entry
          </span>
          <span className="flex items-center gap-1.5 text-muted">
            <span className="text-blue-500 inline-flex"><CreditCard size={13} /></span> From account
          </span>
        </div>
      )}

      {/* Filter tabs + search */}
      <div className="flex items-center gap-2 overflow-x-auto mb-4 pb-1" style={{ scrollbarWidth: 'none' }}>
        {FILTER_TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all"
            style={{
              background: tab === t ? 'var(--text-primary)' : 'var(--input-bg)',
              color:      tab === t ? 'var(--page-bg)'       : 'var(--text-muted)',
              border:     '1px solid var(--card-border)',
            }}>
            {t}
          </button>
        ))}
        <input className="input-field flex-1 text-sm min-w-32" placeholder="Search…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Expense list */}
      {filtered.length === 0 ? (
        <div className="card p-4">
          <div className="text-center py-12">
            <div className="flex justify-center mb-3 text-muted"><Receipt size={36} /></div>
            <p className="font-semibold text-primary">No expenses yet</p>
            <p className="text-muted text-sm mt-1">Start tracking your spending</p>
            <button onClick={openAdd} className="btn-primary mt-4">+ Add Expense</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map(item => {
            const isRecurring = item.frequency && item.frequency !== 'none'
            const isAccTxn    = item._source === 'account_txn'
            return (
              <div key={`${item._source}-${item.id}`} className="card p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-primary"
                      style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)' }}>
                      {isAccTxn ? <CreditCard size={18} /> : <Receipt size={18} />}
                    </div>
                    <div>
                      <p className="font-bold text-primary">{item.description}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {isRecurring && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                            <Repeat size={11} className="inline mr-0.5" /> {frequencyLabel(item.frequency)}
                          </span>
                        )}
                        {isAccTxn && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
                            <CreditCard size={11} className="inline mr-0.5" /> {item._account?.name || 'Account'}
                            {item.card_last4 ? ` ··${item.card_last4}` : ''}
                          </span>
                        )}
                        {item.label && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
                            {item.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(item)} className="text-muted hover:text-primary transition-colors"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(item)} className="transition-colors" style={{ color: '#ef4444' }}><Trash2 size={14} /></button>
                  </div>
                </div>
                <p className="text-2xl font-black" style={{ color: '#ef4444' }}>-{fmt(item.amount)}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <p className="text-muted text-sm">{item.category} · {item.subcategory} · {item.date}</p>
                  {isRecurring && item.next_due && <p className="text-xs text-muted">· Next: {item.next_due}</p>}
                </div>
                {item.notes && <p className="text-xs text-muted mt-1">{item.notes}</p>}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Quick Category Modal ── */}
      {step === 'quick' && (
        <div className="modal-overlay" onClick={() => setStep(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 accent-text font-semibold"><span>$</span><span>Add Expense</span></div>
              <button onClick={() => setStep(null)} className="text-muted hover:text-primary"><X size={20} /></button>
            </div>
            <p className="font-bold text-primary text-lg mb-4">Quick Select Category</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {QUICK_CATS.map(qc => (
                <button key={qc.label} onClick={() => selectQuickCat(qc)}
                  className="flex flex-col items-center gap-2 p-4 border rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  style={{ borderColor: 'var(--card-border)' }}>
                  <qc.Icon size={26} />
                  <span className="text-xs font-medium text-primary text-center">{qc.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setStep('form')} className="w-full text-muted text-sm hover:text-primary transition-colors py-2">Or fill manually</button>
          </div>
        </div>
      )}

      {/* ── Full Form Modal ── */}
      {step === 'form' && (
        <div className="modal-overlay" onClick={() => setStep(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 accent-text font-semibold">
                <span>$</span><span>{editItem ? 'Edit Expense' : 'Add Expense'}</span>
                {editSource === 'account_txn' && <span className="text-xs text-blue-500 ml-1 inline-flex items-center gap-1"><CreditCard size={12} /> Account Txn</span>}
              </div>
              <button onClick={() => setStep(null)} className="text-muted hover:text-primary"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="mb-4">
                <label className="label">Description</label>
                <input className="input-field" placeholder="What did you spend on?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
              </div>
              <div className="mb-4">
                <label className="label">Amount (USD)</label>
                <input className="input-field" type="number" step="0.01" min="0" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div className="mb-4">
                <label className="label">Quick Add Amount</label>
                <div className="flex flex-wrap gap-2">
                  {QUICK_AMOUNTS.map(a => (
                    <button key={a} type="button" onClick={() => setForm(f => ({ ...f, amount: String((parseFloat(f.amount) || 0) + a) }))}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-primary"
                      style={{ borderColor: 'var(--card-border)' }}>
                      + ${a}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="label">Category</label>
                  <select className="input-field" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value, subcategory: SUBCATEGORIES[e.target.value][0] }))}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Subcategory</label>
                  <select className="input-field" value={form.subcategory} onChange={e => setForm(f => ({ ...f, subcategory: e.target.value }))}>
                    {SUBCATEGORIES[form.category].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Hide frequency for account_txn edits */}
              {editSource !== 'account_txn' && (
                <div className="mb-4">
                  <label className="label">Frequency</label>
                  <div className="grid grid-cols-4 gap-2">
                    {FREQUENCY_OPTIONS.map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => { const next = opt.value !== 'none' ? calcNextDue(form.date, opt.value) : ''; setForm(f => ({ ...f, frequency: opt.value, next_due: next })) }}
                        className="flex flex-col items-center gap-1 p-2 rounded-xl border text-xs font-semibold transition-all"
                        style={{
                          borderColor: form.frequency === opt.value ? '#10b981' : 'var(--card-border)',
                          background:  form.frequency === opt.value ? 'rgba(16,185,129,0.1)' : undefined,
                          color:       form.frequency === opt.value ? '#10b981' : 'var(--text-muted)',
                        }}>
                        <span className="font-bold">{opt.icon}</span>
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <label className="label">Date</label>
                <input className="input-field" type="date" value={form.date}
                  onChange={e => { const next = form.frequency !== 'none' ? calcNextDue(e.target.value, form.frequency) : ''; setForm(f => ({ ...f, date: e.target.value, next_due: next || f.next_due })) }} required />
              </div>

              {form.frequency !== 'none' && editSource !== 'account_txn' && (
                <div className="mb-4">
                  <label className="label">Next Due Date</label>
                  <input className="input-field" type="date" value={form.next_due} onChange={e => setForm(f => ({ ...f, next_due: e.target.value }))} />
                </div>
              )}

              <div className="mb-4">
                <label className="label">Notes (optional)</label>
                <textarea className="input-field resize-none" rows={2} placeholder="Any extra details…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setStep(null)} className="btn-secondary justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary justify-center">{saving ? 'Saving…' : editItem ? 'Save Changes' : 'Add Expense'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
