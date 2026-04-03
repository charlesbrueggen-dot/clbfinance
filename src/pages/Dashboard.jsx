import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)

const PIE_COLORS_LIGHT = ['#1a3a6b','#2e6da4','#4a9fd4','#f0a500','#e05c2a','#7b2d8b','#2a8b5a','#c0392b','#16a085','#8e44ad']
const PIE_COLORS_DARK  = ['#10b981','#34d399','#6ee7b7','#a7f3d0','#059669','#047857','#065f46','#d1fae5','#6ee7b7','#34d399']

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [income, setIncome] = useState([])
  const [expenses, setExpenses] = useState([])
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [dark, setDarkDetect] = useState(document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const obs = new MutationObserver(() => setDarkDetect(document.documentElement.classList.contains('dark')))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const load = async () => {
      const [{ data: inc }, { data: exp }, { data: gls }] = await Promise.all([
        supabase.from('income').select('*').eq('user_id', user.id),
        supabase.from('expenses').select('*').eq('user_id', user.id),
        supabase.from('goals').select('*').eq('user_id', user.id),
      ])
      setIncome(inc || [])
      setExpenses(exp || [])
      setGoals(gls || [])
      setLoading(false)
    }
    load()
  }, [user.id])

  const totalBalance = income.reduce((s, i) => s + i.amount, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthExp = expenses.filter(e => e.date?.slice(0, 7) === thisMonth).reduce((s, e) => s + e.amount, 0)
  const savingsPct = totalBalance > 0 ? ((totalBalance - totalExpenses) / totalBalance * 100).toFixed(1) : '0.0'

  const srcMap = {}
  income.forEach(i => { srcMap[i.source] = (srcMap[i.source] || 0) + i.amount })
  const pieData = Object.entries(srcMap).map(([name, value]) => ({ name, value }))
  const pieColors = dark ? PIE_COLORS_DARK : PIE_COLORS_LIGHT

  const catMap = {}
  expenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.amount })
  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1])
  const largestCat = sorted[0] || ['N/A', 0]

  const recentActivity = [...income.map(i => ({ ...i, kind: 'income' })), ...expenses.map(e => ({ ...e, kind: 'expense' }))]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)

  const surplus = totalBalance - totalExpenses
  const surplusColor = surplus >= 0 ? (dark ? '#10b981' : 'rgba(255,255,255,0.9)') : '#ef4444'

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }}></div>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-primary tracking-tight">Dashboard</h1>
        <p className="text-muted text-sm mt-1">Real-time overview of your financial health</p>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Link to="/analytics" className="btn-secondary justify-center text-sm no-underline">◑ Analytics</Link>
        <button className="btn-secondary justify-center text-sm" onClick={() => window.location.reload()}>↻ Refresh</button>
        <Link to="/income" className="btn-primary justify-center text-sm no-underline">⊕ Add</Link>
      </div>

      {/* Balance Hero + Pie */}
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-2 mb-1 font-bold" style={{ color: 'var(--text-primary)' }}>
          <span>◔</span>
          <span>Balance: {fmt(totalBalance)}</span>
        </div>
        <p className="text-muted text-xs mb-3">{income.length} income source{income.length !== 1 ? 's' : ''}</p>
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={85} stroke={dark ? 'transparent' : '#000'} strokeWidth={dark ? 0 : 1.5}>
                {pieData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
              </Pie>
              <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--modal-bg)', border: '1px solid var(--card-border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-40 flex items-center justify-center text-muted text-sm">Add income entries to see breakdown</div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card p-4">
          <p className="text-muted text-xs mb-1">Monthly Expenses</p>
          <p className="text-2xl font-black text-primary">{fmt(monthExp)}</p>
          <p className="text-xs text-muted mt-1">This month</p>
        </div>
        <div className="card p-4">
          <p className="text-muted text-xs mb-1">Savings Rate</p>
          <p className="text-2xl font-black text-primary">{savingsPct}%</p>
          <p className="text-xs text-muted mt-1">Of income saved</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card p-4 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/expenses')}>
          <p className="text-muted text-xs mb-1">Top Expense</p>
          <p className="font-black text-primary text-sm">{largestCat[0]}</p>
          <p className="text-muted text-sm mt-0.5">{fmt(largestCat[1])}</p>
        </div>
        <div className="card p-4 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/goals')}>
          <p className="text-muted text-xs mb-1">Active Goals</p>
          <p className="font-black text-primary text-2xl">{goals.length}</p>
          <p className="text-muted text-xs">in progress</p>
        </div>
        <div className="card p-4 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/import')}>
          <p className="text-muted text-xs font-semibold mb-1">Bank Sync</p>
          <p className="font-black text-primary text-sm">Import Data</p>
          <p className="text-muted text-xs">Upload CSV files</p>
        </div>
        <div className="card p-4 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/investments')}>
          <p className="text-muted text-xs font-semibold mb-1">Portfolio</p>
          <p className="font-black text-primary text-sm">Investments</p>
          <p className="text-muted text-xs">Track holdings</p>
        </div>
      </div>

      {/* Budget Overview */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-primary">Budget Overview</h2>
          <span className="text-xs font-bold px-3 py-1.5 rounded-full"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)', color: surplusColor }}>
            {surplus >= 0 ? '↗' : '↘'} {fmt(Math.abs(surplus))} {surplus >= 0 ? 'surplus' : 'deficit'}
          </span>
        </div>
        {expenses.length === 0 ? (
          <div className="text-center py-6 text-muted text-sm">No budget data yet — add some expenses</div>
        ) : (
          <div className="space-y-3">
            {sorted.slice(0, 4).map(([cat, amt]) => (
              <div key={cat}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-primary font-semibold">{cat}</span>
                  <span className="text-muted">{fmt(amt)}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${Math.min(100, (amt / totalExpenses) * 100)}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="card p-5 mb-4">
        <h2 className="font-black text-primary mb-4">Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <div className="text-center py-6 text-muted text-sm">No activity yet</div>
        ) : (
          <div className="space-y-1">
            {recentActivity.map(item => (
              <div key={item.id + item.kind} className="flex items-center justify-between py-2.5" style={{ borderBottom: '1px solid var(--card-border)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ background: item.kind === 'income' ? 'rgba(255,255,255,0.18)' : 'rgba(239,68,68,0.18)', color: item.kind === 'income' ? 'var(--text-primary)' : '#ef4444' }}>
                    {item.kind === 'income' ? '↗' : '↘'}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-primary">{item.source || item.description}</p>
                    <p className="text-xs text-muted">{item.date}</p>
                  </div>
                </div>
                <span className="font-black text-sm" style={{ color: item.kind === 'income' ? 'var(--text-primary)' : '#ef4444' }}>
                  {item.kind === 'income' ? '+' : '-'}{fmt(item.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card p-5">
        <h2 className="font-black text-primary mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Add Income', icon: '↗', path: '/income' },
            { label: 'Add Expense', icon: '↘', path: '/expenses' },
            { label: 'Set Goal', icon: '◎', path: '/goals' },
            { label: 'View Reports', icon: '◑', path: '/analytics' },
          ].map(a => (
            <Link key={a.path} to={a.path} className="no-underline">
              <button className="w-full py-4 rounded-xl font-bold text-sm text-primary flex flex-col items-center gap-2 transition-opacity hover:opacity-75"
                style={{ border: '1px solid var(--card-border)', background: 'var(--input-bg)' }}>
                <span className="text-lg">{a.icon}</span>
                {a.label}
              </button>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
