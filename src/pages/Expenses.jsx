import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const today = () => new Date().toISOString().split('T')[0]
const QUICK_AMOUNTS = [1, 5, 10, 50, 100, 500]

const QUICK_CATS = [
  { label: 'Rent/Mortgage', icon: '🏠', category: 'Needs', sub: 'Rent' },
  { label: 'Groceries', icon: '🛒', category: 'Needs', sub: 'Groceries' },
  { label: 'Utilities', icon: '⚡', category: 'Needs', sub: 'Utilities' },
  { label: 'Transportation', icon: '🚗', category: 'Needs', sub: 'Transportation' },
  { label: 'Healthcare', icon: '🏥', category: 'Needs', sub: 'Healthcare' },
]

const CATEGORIES = ['Needs', 'Wants', 'Savings']
const SUBCATEGORIES = {
  Needs: ['Rent', 'Groceries', 'Utilities', 'Transportation', 'Healthcare', 'Insurance', 'Other'],
  Wants: ['Dining', 'Entertainment', 'Shopping', 'Travel', 'Subscriptions', 'Other'],
  Savings: ['Emergency Fund', 'Retirement', 'Investment', 'Vacation', 'Other'],
}

const FILTER_TABS = ['All', 'Needs', 'Wants', 'Savings']

export default function Expenses() {
  const { user } = useAuth()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('All')
  const [step, setStep] = useState(null) // null | 'quick' | 'form'
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ description: '', amount: '', category: 'Needs', subcategory: 'Other', date: today(), notes: '', recurring: false })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('expenses').select('*').eq('user_id', user.id).order('date', { ascending: false })
    setExpenses(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [user.id])

  const openAdd = () => { setEditItem(null); setForm({ description: '', amount: '', category: 'Needs', subcategory: 'Other', date: today(), notes: '', recurring: false }); setStep('quick') }
  const openEdit = item => { setEditItem(item); setForm({ description: item.description, amount: item.amount, category: item.category, subcategory: item.subcategory || 'Other', date: item.date, notes: item.notes || '', recurring: item.recurring || false }); setStep('form') }

  const selectQuickCat = qc => { setForm(f => ({ ...f, description: qc.label, category: qc.category, subcategory: qc.sub })); setStep('form') }

  const handleSave = async e => {
    e.preventDefault()
    if (!form.description.trim() || !form.amount) return
    setSaving(true)
    const payload = { description: form.description.trim(), amount: parseFloat(form.amount), category: form.category, subcategory: form.subcategory, date: form.date, notes: form.notes, recurring: form.recurring, user_id: user.id }
    if (editItem) {
      await supabase.from('expenses').update(payload).eq('id', editItem.id).eq('user_id', user.id)
    } else {
      await supabase.from('expenses').insert(payload)
    }
    setSaving(false)
    setStep(null)
    load()
  }

  const handleDelete = async id => {
    if (!confirm('Delete this expense?')) return
    await supabase.from('expenses').delete().eq('id', id).eq('user_id', user.id)
    load()
  }

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const needs = expenses.filter(e => e.category === 'Needs').reduce((s, e) => s + e.amount, 0)
  const wants = expenses.filter(e => e.category === 'Wants').reduce((s, e) => s + e.amount, 0)
  const savings = expenses.filter(e => e.category === 'Savings').reduce((s, e) => s + e.amount, 0)

  const filtered = expenses.filter(e => {
    const matchTab = tab === 'All' || e.category === tab
    const matchSearch = !search || e.description.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch
  })

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-t-transparent border-t-transparent rounded-full animate-spin"></div></div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Expenses</h1>
        <p className="text-muted text-sm mt-1">Track and categorize all your spending</p>
      </div>

      <button onClick={openAdd} className="btn-primary mb-6">+ Add Expense</button>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl p-4" style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)' }}>
          <p className="text-muted text-xs mb-1">Total Expenses</p>
          <p className="text-2xl font-bold text-primary">{fmt(totalExpenses)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1"><p className="text-muted text-xs">Needs</p><div className="w-2.5 h-2.5 rounded-full bg-white dark:bg-white/50 dark:bg-emerald-400"></div></div>
          <p className="font-bold text-primary">{fmt(needs)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1"><p className="text-muted text-xs">Wants</p><div className="w-2.5 h-2.5 rounded-full bg-white/70 dark:bg-purple-500"></div></div>
          <p className="font-bold text-primary">{fmt(wants)}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-1"><p className="text-muted text-xs">Savings</p><div className="w-2.5 h-2.5 rounded-full bg-white/50 dark:bg-emerald-400"></div></div>
          <p className="font-bold text-primary">{fmt(savings)}</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">🔍</span>
          <input className="input-field pl-9" placeholder="Search expenses..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Expense History */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4 accent-text font-semibold">
          <span>$</span>
          <span>Expense History ({filtered.length})</span>
        </div>
        {/* Tabs */}
        <div className="grid grid-cols-4 gap-1 mb-4 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {FILTER_TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-white dark:bg-gray-900 shadow text-primary' : 'text-muted'}`}>
              {t}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🧾</div>
            <p className="font-semibold text-primary">No expenses yet</p>
            <p className="text-muted text-sm mt-1">Start tracking your spending to better manage your budget</p>
            <button onClick={openAdd} className="btn-primary mt-4">+ Add Your First Expense</button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: 'var(--card-border)' }}>
                <div>
                  <p className="font-medium text-sm text-primary">{item.description}</p>
                  <p className="text-xs text-muted mt-0.5">{item.category} · {item.subcategory} · {item.date}{item.recurring ? ' · 🔁' : ''}</p>
                  {item.notes && <p className="text-xs text-muted">{item.notes}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-red-500">-{fmt(item.amount)}</span>
                  <button onClick={() => openEdit(item)} className="text-muted hover:text-primary text-sm">✎</button>
                  <button onClick={() => handleDelete(item.id)} className="text-muted hover:text-red-500 text-sm">🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* STEP 1: Quick Category Select */}
      {step === 'quick' && (
        <div className="modal-overlay" onClick={() => setStep(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 accent-text font-semibold"><span>$</span><span>Add Expense</span></div>
              <button onClick={() => setStep(null)} className="text-muted hover:text-primary text-xl">✕</button>
            </div>
            <p className="font-bold text-primary text-lg mb-4">Quick Select Category</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {QUICK_CATS.map(qc => (
                <button key={qc.label} onClick={() => selectQuickCat(qc)}
                  className="flex flex-col items-center gap-2 p-4 border rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  style={{ borderColor: 'var(--card-border)' }}>
                  <span className="text-2xl">{qc.icon}</span>
                  <span className="text-xs font-medium text-primary text-center">{qc.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setStep('form')} className="w-full text-muted text-sm hover:text-primary transition-colors py-2">Or fill manually</button>
          </div>
        </div>
      )}

      {/* STEP 2: Full Form */}
      {step === 'form' && (
        <div className="modal-overlay" onClick={() => setStep(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 accent-text font-semibold"><span>$</span><span>{editItem ? 'Edit Expense' : 'Add Expense'}</span></div>
              <button onClick={() => setStep(null)} className="text-muted hover:text-primary text-xl">✕</button>
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
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-primary" style={{ borderColor: 'var(--card-border)' }}>
                      + USD{a}
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
              <div className="mb-4">
                <label className="label">Date</label>
                <input className="input-field" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div className="mb-4">
                <label className="label">Notes (optional)</label>
                <textarea className="input-field resize-none" rows={2} placeholder="Any extra details..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="mb-6 flex items-center gap-3 cursor-pointer" onClick={() => setForm(f => ({ ...f, recurring: !f.recurring }))}>
                <div className={`w-12 h-6 rounded-full transition-colors relative ${form.recurring ? 'bg-white/50 dark:bg-emerald-400' : 'bg-gray-200 dark:bg-gray-700'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${form.recurring ? 'left-6' : 'left-0.5'}`}></div>
                </div>
                <span className="text-sm text-muted">This is a recurring expense</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setStep(null)} className="btn-secondary justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary justify-center">{saving ? 'Saving...' : editItem ? 'Save Changes' : 'Add Expense'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
