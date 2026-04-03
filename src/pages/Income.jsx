import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const PIE_COLORS_LIGHT = ['#1a3a6b','#2e6da4','#4a9fd4','#f0a500','#e05c2a','#7b2d8b','#2a8b5a','#c0392b','#16a085','#8e44ad']
const PIE_COLORS_DARK  = ['#10b981','#34d399','#6ee7b7','#a7f3d0','#059669','#047857','#065f46','#d1fae5','#6ee7b7','#34d399']
const QUICK_AMOUNTS = [1, 5, 10, 50, 100, 500]
const today = () => new Date().toISOString().split('T')[0]

const FREQUENCY_OPTIONS = [
  { value: 'one-time',  label: 'One-Time',  icon: '1×' },
  { value: 'weekly',    label: 'Weekly',    icon: '7d' },
  { value: 'biweekly',  label: 'Bi-Weekly', icon: '14d' },
  { value: 'monthly',   label: 'Monthly',   icon: '30d' },
]

const frequencyLabel = f => FREQUENCY_OPTIONS.find(o => o.value === f)?.label || 'One-Time'
const frequencyIcon  = f => FREQUENCY_OPTIONS.find(o => o.value === f)?.icon  || '1×'

export default function Income() {
  const { user } = useAuth()
  const [income, setIncome]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ source: '', amount: '', date: today(), frequency: 'one-time', next_date: '' })
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [dark, setDarkDetect]   = useState(document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const obs = new MutationObserver(() => setDarkDetect(document.documentElement.classList.contains('dark')))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const load = async () => {
    const { data } = await supabase.from('income').select('*').eq('user_id', user.id).order('date', { ascending: false })
    setIncome(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [user.id])

  const openAdd = () => {
    setEditItem(null)
    setForm({ source: '', amount: '', date: today(), frequency: 'one-time', next_date: '' })
    setError('')
    setShowModal(true)
  }

  const openEdit = item => {
    setEditItem(item)
    setForm({
      source: item.source,
      amount: item.amount,
      date: item.date,
      frequency: item.frequency || 'one-time',
      next_date: item.next_date || '',
    })
    setError('')
    setShowModal(true)
  }

  const handleSave = async e => {
    e.preventDefault()
    if (!form.source.trim() || !form.amount) { setError('Please fill in all fields'); return }
    setSaving(true)
    const payload = {
      source:    form.source.trim(),
      amount:    parseFloat(form.amount),
      date:      form.date,
      frequency: form.frequency,
      next_date: form.frequency !== 'one-time' ? (form.next_date || null) : null,
      user_id:   user.id,
    }
    if (editItem) await supabase.from('income').update(payload).eq('id', editItem.id).eq('user_id', user.id)
    else          await supabase.from('income').insert(payload)
    setSaving(false); setShowModal(false); load()
  }

  const handleDelete = async id => {
    await supabase.from('income').delete().eq('id', id).eq('user_id', user.id)
    load()
  }

  const totalIncome = income.reduce((s, i) => s + i.amount, 0)
  const recurring   = income.filter(i => i.frequency && i.frequency !== 'one-time')
  const oneTime     = income.filter(i => !i.frequency || i.frequency === 'one-time')

  const normalizeSource = source => {
    if (!source) return 'Other'
    return source.trim().toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }
  const srcMap = {}
  income.forEach(i => { const key = normalizeSource(i.source); srcMap[key] = (srcMap[key] || 0) + i.amount })
  const pieData   = Object.entries(srcMap).map(([name, value]) => ({ name, value }))
  const pieColors = dark ? PIE_COLORS_DARK : PIE_COLORS_LIGHT

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }}></div>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-primary tracking-tight">Income</h1>
        <p className="text-muted text-sm mt-1">Track all your income streams — recurring and one-time</p>
      </div>

      <button onClick={openAdd} className="btn-primary mb-6">+ Add Income</button>

      {/* Hero */}
      <div className="card p-6 mb-6">
        <div className="w-11 h-11 rounded-full flex items-center justify-center mb-4"
          style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)' }}>
          <span className="text-primary text-lg font-bold">$</span>
        </div>
        <p className="text-muted text-sm mb-1">Total Income</p>
        <p className="text-4xl font-black text-primary">{fmt(totalIncome)}</p>
        <p className="text-muted text-sm mt-2">{recurring.length} recurring · {oneTime.length} one-time</p>
      </div>

      {/* Frequency breakdown mini-stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {['weekly','biweekly','monthly'].map(freq => {
          const total = recurring.filter(i => i.frequency === freq).reduce((s, i) => s + i.amount, 0)
          return (
            <div key={freq} className="card p-4">
              <p className="text-muted text-xs mb-1">{frequencyLabel(freq)}</p>
              <p className="font-black text-primary text-sm">{fmt(total)}</p>
              <p className="text-xs text-muted mt-1">{frequencyIcon(freq)}</p>
            </div>
          )
        })}
      </div>

      {/* Pie */}
      <div className="card p-5 mb-6">
        <div className="flex items-center gap-2 mb-4 font-bold text-primary">
          <span>◑</span><span>Income Sources Breakdown</span>
        </div>
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={85}
                stroke={dark ? 'transparent' : '#000'} strokeWidth={dark ? 0 : 1.5}>
                {pieData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
              </Pie>
              <Tooltip formatter={v => fmt(v)} contentStyle={{ background: dark ? '#111' : '#fff', border: '1px solid var(--card-border)', borderRadius: 10, color: '#10b981', fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-40 flex items-center justify-center text-muted text-sm">No income data yet</div>
        )}
      </div>

      {/* Recurring */}
      {recurring.length > 0 && (
        <div className="mb-4">
          <h2 className="font-bold text-primary mb-3 text-sm uppercase tracking-wider">🔁 Recurring Income</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recurring.map(item => <IncomeCard key={item.id} item={item} onEdit={openEdit} onDelete={handleDelete} />)}
          </div>
        </div>
      )}

      {/* One-time */}
      {oneTime.length > 0 && (
        <div className="mb-4">
          <h2 className="font-bold text-primary mb-3 text-sm uppercase tracking-wider">💵 One-Time Income</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {oneTime.map(item => <IncomeCard key={item.id} item={item} onEdit={openEdit} onDelete={handleDelete} />)}
          </div>
        </div>
      )}

      {income.length === 0 && (
        <div className="text-center py-12 text-muted">No income entries yet. Add your first above!</div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 font-bold text-primary">
                <span>$</span><span>{editItem ? 'Edit Income' : 'Add Income'}</span>
              </div>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-primary text-xl">✕</button>
            </div>
            <form onSubmit={handleSave}>

              {/* Frequency selector */}
              <div className="mb-4">
                <label className="label">Frequency</label>
                <div className="grid grid-cols-4 gap-2">
                  {FREQUENCY_OPTIONS.map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setForm(f => ({ ...f, frequency: opt.value, next_date: '' }))}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-sm font-semibold transition-all ${
                        form.frequency === opt.value ? 'text-primary' : 'text-muted hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                      style={{
                        borderColor:  form.frequency === opt.value ? '#10b981' : 'var(--card-border)',
                        background:   form.frequency === opt.value ? 'rgba(16,185,129,0.1)' : undefined,
                      }}>
                      <span className="text-xs font-bold" style={{ color: form.frequency === opt.value ? '#10b981' : 'inherit' }}>{opt.icon}</span>
                      <span className="text-xs">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="label">Income Source</label>
                <input className="input-field" placeholder="e.g., Salary, Freelance, Side Hustle"
                  value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} required />
              </div>

              <div className="mb-4">
                <label className="label">Amount (USD){form.frequency !== 'one-time' && <span className="text-muted font-normal ml-1">per {frequencyLabel(form.frequency).toLowerCase().replace('bi-','bi').replace('ly','')}</span>}</label>
                <input className="input-field" type="number" step="0.01" min="0" placeholder="0.00"
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>

              <div className="mb-4">
                <label className="label">Quick Add</label>
                <div className="flex flex-wrap gap-2">
                  {QUICK_AMOUNTS.map(a => (
                    <button key={a} type="button" onClick={() => setForm(f => ({ ...f, amount: String((parseFloat(f.amount) || 0) + a) }))}
                      className="px-3 py-1.5 rounded-lg text-sm font-bold text-primary transition-colors"
                      style={{ border: '1px solid var(--card-border)', background: 'var(--input-bg)' }}>
                      +${a}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="label">{form.frequency === 'one-time' ? 'Date Received' : 'Start Date'}</label>
                <input className="input-field" type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>

              {form.frequency !== 'one-time' && (
                <div className="mb-4">
                  <label className="label">Next Payment Date <span className="text-muted font-normal">(optional)</span></label>
                  <input className="input-field" type="date" value={form.next_date}
                    onChange={e => setForm(f => ({ ...f, next_date: e.target.value }))} />
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 rounded-xl text-sm"
                  style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary justify-center">
                  {saving ? 'Saving...' : editItem ? 'Save Changes' : 'Add Income'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function IncomeCard({ item, onEdit, onDelete }) {
  const isRecurring = item.frequency && item.frequency !== 'one-time'
  const frequencyLabel = f => ({ 'one-time': 'One-Time', weekly: 'Weekly', biweekly: 'Bi-Weekly', monthly: 'Monthly' }[f] || 'One-Time')
  const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-primary"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)' }}>
            {isRecurring ? '🔁' : '$'}
          </div>
          <div>
            <p className="font-bold text-primary">{item.source}</p>
            {isRecurring && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                {frequencyLabel(item.frequency)}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onEdit(item)} className="text-muted hover:text-primary text-sm transition-colors">✎</button>
          <button onClick={() => onDelete(item.id)} className="text-sm transition-colors" style={{ color: '#ef4444' }}>🗑</button>
        </div>
      </div>
      <p className="text-2xl font-black text-primary">{fmt(item.amount)}</p>
      <div className="flex items-center gap-2 mt-1 flex-wrap">
        <p className="text-muted text-sm">{item.date}</p>
        {isRecurring && item.next_date && <p className="text-xs text-muted">· Next: {item.next_date}</p>}
      </div>
    </div>
  )
}
