import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const TABS = ['Overview', 'Expenses', 'Income', 'Investments']

export default function Analytics() {
  const { user } = useAuth()
  const [income, setIncome] = useState([])
  const [expenses, setExpenses] = useState([])
  const [investments, setInvestments] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Overview')
  const [range, setRange] = useState('6')
  const [dark, setDarkDetect] = useState(document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const obs = new MutationObserver(() => setDarkDetect(document.documentElement.classList.contains('dark')))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const load = async () => {
      const [{ data: inc }, { data: exp }, { data: inv }] = await Promise.all([
        supabase.from('income').select('*').eq('user_id', user.id),
        supabase.from('expenses').select('*').eq('user_id', user.id),
        supabase.from('investments').select('*').eq('user_id', user.id),
      ])
      setIncome(inc || []); setExpenses(exp || []); setInvestments(inv || [])
      setLoading(false)
    }
    load()
  }, [user.id])

  const monthMap = {}
  const now = new Date()
  const months = parseInt(range)
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthMap[key] = { label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, income: 0, expenses: 0 }
  }
  income.forEach(i => { if (monthMap[i.date?.slice(0, 7)]) monthMap[i.date.slice(0, 7)].income += i.amount })
  expenses.forEach(e => { if (monthMap[e.date?.slice(0, 7)]) monthMap[e.date.slice(0, 7)].expenses += e.amount })
  const chartData = Object.values(monthMap).map(m => ({ ...m, net: m.income - m.expenses }))

  const totalIncome = income.reduce((s, i) => s + i.amount, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const avgMonthlyIncome = chartData.length ? chartData.reduce((s, m) => s + m.income, 0) / chartData.length : 0
  const avgMonthlyExpenses = chartData.length ? chartData.reduce((s, m) => s + m.expenses, 0) / chartData.length : 0

  const catMap = {}
  expenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.amount })

  const lineColor = dark ? '#10b981' : '#ffffff'
  const lineColorExp = dark ? '#ef4444' : 'rgba(255,255,255,0.5)'
  const lineColorNet = dark ? '#34d399' : 'rgba(255,255,255,0.75)'
  const tooltipStyle = { background: 'var(--modal-bg)', border: '1px solid var(--card-border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13 }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }}></div>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-primary tracking-tight">Analytics & Reports</h1>
        <p className="text-muted text-sm mt-1">Real-time insights into your financial performance</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select className="input-field w-36" value={range} onChange={e => setRange(e.target.value)}>
          <option value="3">3 Months</option>
          <option value="6">6 Months</option>
          <option value="12">12 Months</option>
        </select>
        <button className="btn-secondary" onClick={() => window.location.reload()}>↻ Refresh</button>
        <button className="btn-secondary" onClick={() => {
          const csv = ['Date,Income,Expenses,Net'].concat(chartData.map(m => `${m.label},${m.income},${m.expenses},${m.net}`)).join('\n')
          const blob = new Blob([csv], { type: 'text/csv' })
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'stride-export.csv'; a.click()
        }}>↓ Export CSV</button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1 mb-6 card p-1 rounded-xl">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="py-2.5 rounded-lg text-sm font-bold transition-all"
            style={{ background: tab === t ? 'var(--input-bg)' : 'transparent', color: 'var(--text-primary)' }}>
            {t}
          </button>
        ))}
      </div>

      {/* Line Chart */}
      <div className="card p-5 mb-6">
        <div className="flex items-center gap-2 mb-4 font-bold text-primary"><span>↗</span><span>Income vs Expenses Trend</span></div>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
            <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
            <Tooltip contentStyle={tooltipStyle} formatter={v => fmt(v)} />
            <Legend />
            <Line type="monotone" dataKey="income" stroke={lineColor} strokeWidth={2.5} dot={{ r: 4, fill: lineColor }} name="Income" />
            <Line type="monotone" dataKey="expenses" stroke={lineColorExp} strokeWidth={2.5} dot={{ r: 4, fill: lineColorExp }} name="Expenses" />
            <Line type="monotone" dataKey="net" stroke={lineColorNet} strokeWidth={2} dot={{ r: 3 }} name="Net" strokeDasharray="5 3" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Cards — theme-neutral */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Avg Monthly Income', value: avgMonthlyIncome },
          { label: 'Avg Monthly Expenses', value: avgMonthlyExpenses },
          { label: 'Avg Monthly Savings', value: avgMonthlyIncome - avgMonthlyExpenses },
        ].map(item => (
          <div key={item.label} className="card p-4">
            <p className="text-muted text-xs mb-1">{item.label}</p>
            <p className="text-xl font-black text-primary">{fmt(item.value)}</p>
          </div>
        ))}
      </div>

      {/* Category Breakdown */}
      {tab === 'Expenses' && (
        <div className="card p-5">
          <p className="font-black text-primary mb-4">Expenses by Category</p>
          {Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
            <div key={cat} className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-primary font-semibold">{cat}</span>
                <span className="text-muted">{fmt(amt)}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${(amt / totalExpenses * 100)}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
