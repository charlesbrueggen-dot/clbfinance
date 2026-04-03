import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const today = () => new Date().toISOString().split('T')[0]
const CATEGORIES = ['Real Estate', 'Vehicle', 'Electronics', 'Jewelry', 'Savings', 'Cash', 'Other']
const CAT_ICONS = { 'Real Estate': '🏠', Vehicle: '🚗', Electronics: '💻', Jewelry: '💎', Savings: '🏦', Cash: '💵', Other: '📦' }

export default function NetWorth() {
  const { user } = useAuth()
  const [assets, setAssets] = useState([])
  const [investments, setInvestments] = useState([])
  const [income, setIncome] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ name: '', value: '', category: 'Other', purchase_date: today(), notes: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const [{ data: a }, { data: inv }, { data: inc }, { data: ln }, { data: exp }] = await Promise.all([
      supabase.from('assets').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('investments').select('*').eq('user_id', user.id),
      supabase.from('income').select('amount').eq('user_id', user.id),
      supabase.from('loans').select('*').eq('user_id', user.id),
      supabase.from('expenses').select('amount, recurring').eq('user_id', user.id),
    ])
    setAssets(a || [])
    setInvestments(inv || [])
    setIncome(inc || [])
    setLoans(ln || [])
    setExpenses(exp || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [user.id])

  const openAdd = () => { setEditItem(null); setForm({ name: '', value: '', category: 'Other', purchase_date: today(), notes: '' }); setShowModal(true) }
  const openEdit = item => { setEditItem(item); setForm({ name: item.name, value: item.value, category: item.category, purchase_date: item.purchase_date, notes: item.notes || '' }); setShowModal(true) }

  const handleSave = async e => {
    e.preventDefault()
    setSaving(true)
    const payload = { name: form.name.trim(), value: parseFloat(form.value), category: form.category, purchase_date: form.purchase_date, notes: form.notes, user_id: user.id }
    if (editItem) await supabase.from('assets').update(payload).eq('id', editItem.id).eq('user_id', user.id)
    else await supabase.from('assets').insert(payload)
    setSaving(false); setShowModal(false); load()
  }

  const handleDelete = async id => {
    await supabase.from('assets').delete().eq('id', id).eq('user_id', user.id)
    load()
  }

  // Only one-time (non-recurring) expenses come out of balance
  const oneTimeExpenses = expenses.filter(e => !e.recurring).reduce((s, e) => s + e.amount, 0)
  const balance = income.reduce((s, i) => s + i.amount, 0) - oneTimeExpenses
  const physicalAssets = assets.reduce((s, a) => s + a.value, 0)
  const portValue = investments.reduce((s, i) => s + (i.shares * (i.current_price || i.avg_cost)), 0)
  const moneyLent = loans.filter(l => l.type === 'lent' && !l.settled).reduce((s, l) => s + l.amount, 0)
  const moneyOwed = loans.filter(l => l.type === 'borrowed' && !l.settled).reduce((s, l) => s + l.amount, 0)
  const netWorth = balance + physicalAssets + portValue + moneyLent - moneyOwed

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-t-transparent border-t-transparent rounded-full animate-spin"></div></div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Net Worth</h1>
        <p className="text-muted text-sm mt-1">Track your total financial position</p>
      </div>

      <button onClick={openAdd} className="btn-primary mb-6">+ Add Asset</button>

      {/* Net Worth Hero */}
      <div className="rounded-2xl p-6 mb-6 text-white flex items-center justify-between" style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)' }}>
        <div>
          <p className="text-white/80 text-sm mb-1">Total Net Worth</p>
          <p className="text-4xl font-bold">{fmt(netWorth)}</p>
        </div>
        <span className="text-4xl opacity-50">↗</span>
      </div>

      {/* Breakdown Cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { label: 'Balance', value: balance, icon: '$' },
          { label: 'Investments', value: portValue, icon: '◔' },
          { label: 'Physical Assets', value: physicalAssets, icon: '◔' },
          { label: 'Money Lent Out', value: moneyLent, icon: '👐', color: 'text-primary' },
          { label: 'Money You Owe', value: moneyOwed, icon: '👐', negative: true },
        ].map(item => (
          <div key={item.label} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted text-xs mb-1">{item.label}</p>
                <p className={`text-xl font-bold ${item.negative ? 'text-red-500' : 'text-primary'}`}>
                  {item.negative ? '-' : ''}{fmt(item.value)}
                </p>
              </div>
              <span className="text-2xl opacity-30">{item.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Asset Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {assets.length === 0 && <div className="col-span-2 text-center py-12 text-muted">No assets added yet.</div>}
        {assets.map(item => (
          <div key={item.id} className="card p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <span>{CAT_ICONS[item.category] || '📦'}</span>
                </div>
                <div>
                  <p className="font-semibold text-primary">{item.name}</p>
                  <p className="text-muted text-xs">{item.category}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(item)} className="text-muted hover:text-primary text-sm">✎</button>
                <button onClick={() => handleDelete(item.id)} className="text-muted hover:text-red-500 text-sm">🗑</button>
              </div>
            </div>
            <p className="text-2xl font-bold text-primary">{fmt(item.value)}</p>
            <p className="text-muted text-sm mt-1">Purchased: {item.purchase_date}</p>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <p className="accent-text font-semibold text-lg">{editItem ? 'Edit Asset' : 'Add Asset'}</p>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-primary text-xl">✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="mb-4"><label className="label">Asset Name</label><input className="input-field" placeholder="e.g., House, Car, Jewelry" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
              <div className="mb-4"><label className="label">Current Value</label><input className="input-field" type="number" step="0.01" min="0" placeholder="0.00" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} required /></div>
              <div className="mb-4"><label className="label">Category</label><select className="input-field" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
              <div className="mb-4"><label className="label">Purchase Date</label><input className="input-field" type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} /></div>
              <div className="mb-6"><label className="label">Notes (Optional)</label><textarea className="input-field resize-none" rows={2} placeholder="Additional information about this asset" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary justify-center">{saving ? 'Saving...' : editItem ? 'Save Changes' : 'Add Asset'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
