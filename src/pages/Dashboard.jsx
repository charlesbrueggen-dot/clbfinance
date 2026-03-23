import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const PIE_COLORS = ['#3b82f6','#f97316','#8b5cf6','#ef4444','#06b6d4','#84cc16','#ec4899','#14b8a6','#f59e0b','#6366f1','#22c55e','#e11d48']

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [income, setIncome] = useState([])
  const [expenses, setExpenses] = useState([])
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)

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

  // Pie chart data from income sources
  const srcMap = {}
  income.forEach(i => { srcMap[i.source] = (srcMap[i.source] || 0) + i.amount })
  const pieData = Object.entries(srcMap).map(([name, value]) => ({ name, value }))

  // Largest expense category
  const catMap = {}
  expenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.amount })
  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1])
  const largestCat = sorted[0] || ['N/A', 0]

  const recentActivity = [...income.map(i => ({ ...i, kind: 'income' })), ...expenses.map(e => ({ ...e, kind: 'expense' }))]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Financial Dashboard</h1>
        <p className="text-muted text-sm mt-1">Real-time overview of your financial health</p>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Link to="/income" className="btn-secondary justify-center text-sm no-underline">🧠 AI Coach</Link>
        <button className="btn-secondary justify-center text-sm" onClick={() => window.location.reload()}>↻ Refresh</button>
        <Link to="/income" className="btn-primary justify-center text-sm no-underline">⊕ Add Transaction</Link>
      </div>

      {/* Balance + Pie */}
      <div className="card p-5 mb-4">
        <div className="flex items-center gap-2 mb-1 accent-text font-semibold">
          <span>◔</span>
          <span>Balance: {fmt(totalBalance)}</span>
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
          <div className="h-48 flex items-center justify-center text-muted text-sm">Add income entries to see breakdown</div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card p-4">
          <p className="text-muted text-xs mb-1">Monthly Expenses</p>
          <p className="text-2xl font-bold text-primary">{fmt(monthExp)}</p>
          <p className="text-xs text-muted mt-1">This month</p>
        </div>
        <div className="card p-4">
          <p className="text-muted text-xs mb-1">Savings Progress</p>
          <p className="text-2xl font-bold accent-text">{savingsPct}%</p>
          <p className="text-xs text-muted mt-1">Of income saved</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/expenses')}>
          <p className="text-muted text-xs mb-1">Largest Expense Category</p>
          <p className="font-bold text-primary text-base">{largestCat[0]}</p>
          <p className="text-muted text-sm">{fmt(largestCat[1])}</p>
        </div>
        <div className="card p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/goals')}>
          <p className="text-muted text-xs mb-1">Active Goals</p>
          <p className="font-bold text-primary text-2xl">{goals.length}</p>
          <p className="text-muted text-sm">Goals in progress</p>
        </div>
        <div className="card p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/import')}>
          <p className="accent-text text-xs font-semibold mb-1">Bank Sync</p>
          <p className="font-bold text-primary">Import Data</p>
          <p className="text-muted text-sm">Upload CSV files</p>
        </div>
        <div className="card p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/investments')}>
          <p className="accent-text text-xs font-semibold mb-1">Portfolio</p>
          <p className="font-bold text-primary">Investments</p>
          <p className="text-muted text-sm">Track holdings</p>
        </div>
      </div>

      {/* Budget Overview */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-primary">Budget Overview</h2>
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            ↗ {fmt(totalBalance - totalExpenses)} surplus
          </span>
        </div>
        {expenses.length === 0 ? (
          <div className="text-center py-6 text-muted text-sm">
            <p>No budget data available</p>
            <p className="text-xs mt-1">Set up your monthly budgets to see progress</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.slice(0, 4).map(([cat, amt]) => (
              <div key={cat}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-primary font-medium">{cat}</span>
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
        <h2 className="font-bold text-primary mb-4">Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <div className="text-center py-6 text-muted text-sm">No activity yet</div>
        ) : (
          <div className="space-y-2">
            {recentActivity.map(item => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: 'var(--card-border)' }}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${item.kind === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
                    {item.kind === 'income' ? '↗' : '↘'}
                  </div>
                  <div>
                    <p className="font-medium text-sm text-primary">{item.source || item.description}</p>
                    <p className="text-xs text-muted">{item.date}</p>
                  </div>
                </div>
                <span className={`font-bold text-sm ${item.kind === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                  {item.kind === 'income' ? '+' : '-'}{fmt(item.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Insights */}
      <div className="card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span>🧠</span>
            <h2 className="font-bold text-primary">AI Insights</h2>
          </div>
          <button className="btn-secondary text-sm py-1.5 px-4">💬 Ask AI</button>
        </div>
        <div className="text-center py-8 text-muted">
          <div className="text-4xl mb-3">🧠</div>
          <p className="font-medium text-sm">No insights available yet</p>
          <p className="text-xs mt-1">Add more transactions to see AI-powered insights</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-5">
        <h2 className="font-bold accent-text mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Add Income', icon: '↗', path: '/income' },
            { label: 'Add Expense', icon: '↘', path: '/expenses' },
            { label: 'Set Goal', icon: '◎', path: '/goals' },
            { label: 'View Reports', icon: '↗', path: '/analytics' },
          ].map(a => (
            <Link key={a.path} to={a.path} className="no-underline">
              <button className="w-full py-4 rounded-xl font-semibold text-sm text-primary border flex flex-col items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" style={{ borderColor: 'var(--card-border)' }}>
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
