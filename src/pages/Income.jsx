import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const PIE_COLORS = ['#3b82f6','#f97316','#8b5cf6','#ef4444','#06b6d4','#84cc16','#ec4899','#14b8a6','#f59e0b','#6366f1','#22c55e','#e11d48']
const QUICK_AMOUNTS = [1, 5, 10, 50, 100, 500]
const today = () => new Date().toISOString().split('T')[0]

export default function Income() {
  const { user } = useAuth()
  const [income, setIncome] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ source: '', amount: '', date: today() })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const { data } = await supabase.from('income').select('*').eq('user_id', user.id).order('date', { ascending: false })
    setIncome(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user.id])

  const openAdd = () => { setEditItem(null); setForm({ source: '', amount: '', date: today() }); setError(''); setShowModal(true) }
  const openEdit = item => { setEditItem(item); setForm({ source: item.source, amount: item.amount, date: item.date }); setError(''); setShowModal(true) }

  const handleSave = async e => {
    e.preventDefault()
    if (!form.source.trim() || !form.amount) { setError('Please fill in all fields'); return }
    setSaving(true)
    const payload = { source: form.source.trim(), amount: parseFloat(form.amount), date: form.date, user_id: user.id }
    if (editItem) {
      await supabase.from('income').update(payload).eq('id', editItem.id).eq('user_id', user.id)
    } else {
      await supabase.from('income').insert(payload)
    }
    setSaving(false)
    setShowModal(false)
    load()
  }

  const handleDelete = async id => {
    if (!confirm('Delete this income entry?')) return
    await supabase.from('income').delete().eq('id', id).eq('user_id', user.id)
    load()
  }

  const totalBalance = income.reduce((s, i) => s + i.amount, 0)

  // Normalize source names: trim whitespace, lowercase, then title-case
  // This merges "babysitting", "Babysitting", "Babysiting" into one slice
  const normalizeSource = (source) => {
    if (!source) return 'Other'
    return source.trim().toLowerCase()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  const srcMap = {}
  income.forEach(i => {
    const key = normalizeSource(i.source)
    srcMap[key] = (srcMap[key] || 0) + i.amount
  })
  const pieData = Object.entries(srcMap).map(([name, value]) => ({ name, value }))

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Balance</h1>
        <p className="text-muted text-sm mt-1">Track and manage all your income streams</p>
      </div>

      <button onClick={openAdd} className="btn-primary mb-6">+ Add Income Source</button>

      {/* Total Balance Hero */}
      <div className="rounded-2xl p-6 mb-6 text-white" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-4">
          <span className="text-white text-xl">◔</span>
        </div>
        <p className="text-white/80 text-sm mb-1">Total Balance</p>
        <p className="text-4xl font-bold">{fmt(totalBalance)}</p>
        <p className="text-white/70 text-sm mt-2">From {income.length} source{income.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Pie Chart */}
      <div className="card p-5 mb-6">
        <div className="flex items-center gap-2 mb-4 accent-text font-semibold">
          <span>◑</span>
          <span>Income Sources Breakdown</span>
        </div>
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={90}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, color: 'var(--text-primary)' }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-muted text-sm">No income data yet</div>
        )}
      </div>

      {/* Income Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {income.length === 0 && <div className="col-span-2 text-center py-12 text-muted">No income entries yet. Add your first above!</div>}
        {income.map(item => (
          <div key={item.id} className="card p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">$</div>
                <p className="font-semibold text-primary">{item.source}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(item)} className="text-muted hover:text-primary text-sm transition-colors">✎</button>
                <button onClick={() => handleDelete(item.id)} className="text-muted hover:text-red-500 text-sm transition-colors">🗑</button>
              </div>
            </div>
            <p className="text-2xl font-bold accent-text">{fmt(item.amount)}</p>
            <p className="text-muted text-sm mt-1">{item.date}</p>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 accent-text font-semibold">
                <span>$</span>
                <span>{editItem ? 'Edit Income Source' : 'Add Income Source'}</span>
              </div>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-primary text-xl">✕</button>
            </div>

            <form onSubmit={handleSave}>
              <div className="mb-4">
                <label className="label">Income Source</label>
                <input className="input-field" placeholder="e.g., Salary, Freelance, Side Hustle" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} required />
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
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 text-primary hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      + ${a}.00
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-6">
                <label className="label">Date</label>
                <input className="input-field" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>

              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">{error}</div>}

              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary justify-center">{saving ? 'Saving...' : editItem ? 'Save Changes' : 'Add Income'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
