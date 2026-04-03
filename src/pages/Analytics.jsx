import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell
} from 'recharts'

const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const fmtShort = n => {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return fmt(n)
}
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const TABS = ['Overview', 'Cash Flow', 'Spending', 'Net Worth', 'Loans']
const PIE_COLORS = ['#3b82f6','#f97316','#8b5cf6','#ef4444','#06b6d4','#84cc16','#ec4899','#14b8a6','#f59e0b','#64748b']

const calcWithInterest = (principal, rate, startDate) => {
  if (!rate || !startDate) return principal
  const years = (new Date() - new Date(startDate + 'T12:00:00')) / (365.25 * 24 * 60 * 60 * 1000)
  if (years <= 0) return principal
  return principal * Math.pow(1 + rate / 100, years)
}

const StatCard = ({ label, value, sub, color, onClick }) => (
  <div
    className="card p-4 cursor-pointer hover:opacity-90 transition-opacity"
    onClick={onClick}
    style={{ borderLeft: color ? `3px solid ${color}` : undefined }}
  >
    <p className="text-muted text-xs mb-1">{label}</p>
    <p className="text-xl font-black text-primary">{value}</p>
    {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
  </div>
)

export default function Analytics() {
  const { user } = useAuth()
  const [income, setIncome] = useState([])
  const [expenses, setExpenses] = useState([])
  const [investments, setInvestments] = useState([])
  const [loans, setLoans] = useState([])
  const [assets, setAssets] = useState([])
  const [balance, setBalance] = useState([])
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
      const [
        { data: inc }, { data: exp }, { data: inv },
        { data: ln }, { data: ast }, { data: bal }
      ] = await Promise.all([
        supabase.from('income').select('*').eq('user_id', user.id),
        supabase.from('expenses').select('*').eq('user_id', user.id),
        supabase.from('investments').select('*').eq('user_id', user.id),
        supabase.from('loans').select('*').eq('user_id', user.id),
        supabase.from('assets').select('*').eq('user_id', user.id),
        supabase.from('balance').select('*').eq('user_id', user.id),
      ])
      setIncome(inc || [])
      setExpenses(exp || [])
      setInvestments(inv || [])
      setLoans(ln || [])
      setAssets(ast || [])
      setBalance(bal || [])
      setLoading(false)
    }
    load()
  }, [user.id])

  // --- Month buckets ---
  const months = parseInt(range)
  const now = new Date()
  const monthMap = {}
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthMap[key] = { label: `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`, income: 0, expenses: 0 }
  }
  income.forEach(i => { if (monthMap[i.date?.slice(0, 7)]) monthMap[i.date.slice(0, 7)].income += i.amount })
  expenses.forEach(e => { if (monthMap[e.date?.slice(0, 7)]) monthMap[e.date.slice(0, 7)].expenses += e.amount })
  const chartData = Object.values(monthMap).map(m => ({ ...m, net: m.income - m.expenses, savings: Math.max(0, m.income - m.expenses) }))

  // --- Summary numbers ---
  const totalIncome = income.reduce((s, i) => s + i.amount, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const totalBalance = balance.reduce((s, b) => s + b.amount, 0)
  const avgMonthlyIncome = chartData.length ? chartData.reduce((s, m) => s + m.income, 0) / chartData.length : 0
  const avgMonthlyExpenses = chartData.length ? chartData.reduce((s, m) => s + m.expenses, 0) / chartData.length : 0
  const avgMonthlySavings = avgMonthlyIncome - avgMonthlyExpenses
  const savingsRate = avgMonthlyIncome > 0 ? ((avgMonthlySavings / avgMonthlyIncome) * 100).toFixed(1) : '0.0'

  // --- Net Worth ---
  const portValue = investments.reduce((s, i) => s + (i.shares * (i.current_price || i.avg_cost)), 0)
  const physicalAssets = assets.reduce((s, a) => s + a.value, 0)
  const moneyLent = loans.filter(l => l.type === 'lent' && !l.settled).reduce((s, l) => s + calcWithInterest(l.amount, l.interest_rate, l.loan_date), 0)
  const moneyOwed = loans.filter(l => l.type === 'borrowed' && !l.settled).reduce((s, l) => s + calcWithInterest(l.amount, l.interest_rate, l.loan_date), 0)
  const cashBase = totalBalance > 0 ? totalBalance : totalIncome - totalExpenses
  const netWorth = cashBase + portValue + physicalAssets + moneyLent - moneyOwed

  // Net worth breakdown for pie
  const nwPieData = [
    cashBase > 0 && { name: 'Cash / Balance', value: cashBase },
    portValue > 0 && { name: 'Investments', value: portValue },
    physicalAssets > 0 && { name: 'Physical Assets', value: physicalAssets },
    moneyLent > 0 && { name: 'Money Lent', value: moneyLent },
  ].filter(Boolean)

  // --- Spending by category ---
  const catMap = {}
  expenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.amount })
  const catData = Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))

  // --- Monthly spending trend (bar) ---
  const spendTrendData = chartData.map(m => ({ label: m.label, expenses: m.expenses }))

  // --- Savings rate per month ---
  const savingsRateData = chartData.map(m => ({
    label: m.label,
    rate: m.income > 0 ? parseFloat(((m.income - m.expenses) / m.income * 100).toFixed(1)) : 0
  }))

  // --- Loans summary ---
  const activeLoans = loans.filter(l => !l.settled)
  const lentLoans = activeLoans.filter(l => l.type === 'lent')
  const borrowedLoans = activeLoans.filter(l => l.type === 'borrowed')
  const totalLent = lentLoans.reduce((s, l) => s + calcWithInterest(l.amount, l.interest_rate, l.loan_date), 0)
  const totalOwed = borrowedLoans.reduce((s, l) => s + calcWithInterest(l.amount, l.interest_rate, l.loan_date), 0)

  // Colors
  const lineColorIncome = dark ? '#10b981' : '#1a3a6b'
  const lineColorExp    = dark ? '#ef4444' : '#e05c2a'
  const lineColorNet    = dark ? '#34d399' : '#f0a500'
  const tooltipStyle = {
    background: 'var(--modal-bg)', border: '1px solid var(--card-border)',
    borderRadius: 10, color: 'var(--text-primary)', fontSize: 13
  }

  const exportCSV = () => {
    const rows = ['Date,Income,Expenses,Net,Savings Rate %']
      .concat(chartData.map(m => `${m.label},${m.income},${m.expenses},${m.net},${m.income > 0 ? ((m.net / m.income) * 100).toFixed(1) : 0}`))
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'stride-analytics.csv'; a.click()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }}></div>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-primary tracking-tight">Analytics & Reports</h1>
        <p className="text-muted text-sm mt-1">Deep insights into your complete financial picture</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select className="input-field w-36" value={range} onChange={e => setRange(e.target.value)}>
          <option value="3">3 Months</option>
          <option value="6">6 Months</option>
          <option value="12">12 Months</option>
        </select>
        <button className="btn-secondary" onClick={() => window.location.reload()}>↻ Refresh</button>
        <button className="btn-secondary" onClick={exportCSV}>↓ Export CSV</button>
      </div>

      {/* Tabs */}
      <div className="grid gap-1 mb-6 card p-1 rounded-xl" style={{ gridTemplateColumns: `repeat(${TABS.length}, 1fr)` }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="py-2 rounded-lg text-xs font-bold transition-all"
            style={{ background: tab === t ? 'var(--input-bg)' : 'transparent', color: 'var(--text-primary)' }}>
            {t}
          </button>
        ))}
      </div>

      {/* ═══════════════════════ OVERVIEW ═══════════════════════ */}
      {tab === 'Overview' && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCard label="Net Worth" value={fmt(netWorth)} sub="Total financial position" color="#10b981" />
            <StatCard label="Savings Rate" value={`${savingsRate}%`} sub="Avg this period" color={parseFloat(savingsRate) >= 20 ? '#10b981' : '#f0a500'} />
            <StatCard label="Avg Monthly Income" value={fmt(avgMonthlyIncome)} />
            <StatCard label="Avg Monthly Expenses" value={fmt(avgMonthlyExpenses)} />
          </div>

          {/* Net position including loans */}
          <div className="card p-4 mb-4">
            <p className="font-black text-primary text-sm mb-3">Financial Position Snapshot</p>
            <div className="space-y-2">
              {[
                { label: 'Cash / Balance', value: cashBase, color: '#10b981' },
                { label: 'Investment Portfolio', value: portValue, color: '#3b82f6' },
                { label: 'Physical Assets', value: physicalAssets, color: '#8b5cf6' },
                { label: 'Money Lent Out', value: moneyLent, color: '#f59e0b' },
                { label: 'Money You Owe', value: -moneyOwed, color: '#ef4444' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: row.color }}></div>
                    <span className="text-muted">{row.label}</span>
                  </div>
                  <span className="font-bold" style={{ color: row.value >= 0 ? 'var(--text-primary)' : '#ef4444' }}>
                    {row.value >= 0 ? '' : '-'}{fmt(Math.abs(row.value))}
                  </span>
                </div>
              ))}
              <div className="border-t pt-2 mt-2 flex justify-between text-sm font-black" style={{ borderColor: 'var(--card-border)' }}>
                <span className="text-primary">Net Worth</span>
                <span style={{ color: netWorth >= 0 ? '#10b981' : '#ef4444' }}>{fmt(netWorth)}</span>
              </div>
            </div>
          </div>

          {/* Income vs Expenses trend */}
          <div className="card p-5 mb-4">
            <p className="font-bold text-primary mb-1 text-sm">↗ Income vs Expenses</p>
            <div className="flex gap-4 mb-3 text-xs font-bold">
              <span style={{ color: lineColorIncome }}>● Income</span>
              <span style={{ color: lineColorExp }}>● Expenses</span>
              <span style={{ color: lineColorNet }}>● Net</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => fmt(v)} />
                <Line type="monotone" dataKey="income" stroke={lineColorIncome} strokeWidth={3} dot={{ r: 3 }} name="Income" legendType="none" />
                <Line type="monotone" dataKey="expenses" stroke={lineColorExp} strokeWidth={3} dot={{ r: 3 }} name="Expenses" legendType="none" />
                <Line type="monotone" dataKey="net" stroke={lineColorNet} strokeWidth={2} dot={{ r: 2 }} name="Net" strokeDasharray="5 3" legendType="none" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* ═══════════════════════ CASH FLOW ═══════════════════════ */}
      {tab === 'Cash Flow' && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard label="Total Income" value={fmt(totalIncome)} sub={`${income.length} entries`} color="#10b981" />
            <StatCard label="Total Expenses" value={fmt(totalExpenses)} sub={`${expenses.length} entries`} color="#ef4444" />
            <StatCard label="Net Cash Flow" value={fmt(totalIncome - totalExpenses)}
              sub={totalIncome - totalExpenses >= 0 ? 'Positive' : 'Negative'}
              color={totalIncome - totalExpenses >= 0 ? '#10b981' : '#ef4444'} />
          </div>

          <div className="card p-5 mb-4">
            <p className="font-bold text-primary mb-3 text-sm">Monthly Cash Flow (Area)</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={lineColorIncome} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={lineColorIncome} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={lineColorExp} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={lineColorExp} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => fmt(v)} />
                <Area type="monotone" dataKey="income" stroke={lineColorIncome} fill="url(#incGrad)" strokeWidth={2} name="Income" />
                <Area type="monotone" dataKey="expenses" stroke={lineColorExp} fill="url(#expGrad)" strokeWidth={2} name="Expenses" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-5">
            <p className="font-bold text-primary mb-3 text-sm">Monthly Savings Rate (%)</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={savingsRateData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => `${v}%`} />
                <Bar dataKey="rate" name="Savings Rate %" radius={[4, 4, 0, 0]}>
                  {savingsRateData.map((entry, i) => (
                    <Cell key={i} fill={entry.rate >= 20 ? '#10b981' : entry.rate >= 0 ? '#f0a500' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* ═══════════════════════ SPENDING ═══════════════════════ */}
      {tab === 'Spending' && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCard label="Avg Monthly Spend" value={fmt(avgMonthlyExpenses)} />
            <StatCard label="Top Category" value={catData[0]?.name || 'N/A'} sub={fmt(catData[0]?.value || 0)} color="#ef4444" />
          </div>

          {/* Monthly spend bar */}
          <div className="card p-5 mb-4">
            <p className="font-bold text-primary mb-3 text-sm">Monthly Spending Trend</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={spendTrendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => fmt(v)} />
                <Bar dataKey="expenses" fill={lineColorExp} name="Expenses" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category breakdown with progress bars */}
          <div className="card p-5 mb-4">
            <p className="font-bold text-primary mb-4 text-sm">Expenses by Category</p>
            {catData.length === 0 ? (
              <p className="text-muted text-sm text-center py-4">No expense data yet.</p>
            ) : catData.map(({ name, value }) => (
              <div key={name} className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-primary font-semibold">{name}</span>
                  <span className="text-muted">{fmt(value)} · {(value / totalExpenses * 100).toFixed(1)}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(value / totalExpenses * 100)}%` }}></div>
                </div>
              </div>
            ))}
          </div>

          {/* Category pie */}
          {catData.length > 0 && (
            <div className="card p-5">
              <p className="font-bold text-primary mb-3 text-sm">Spending Distribution</p>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={catData} dataKey="value" cx="50%" cy="50%" outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={10}>
                    {catData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v)} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════ NET WORTH ═══════════════════════ */}
      {tab === 'Net Worth' && (
        <>
          <div className="rounded-2xl p-6 mb-4 flex items-center justify-between"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)' }}>
            <div>
              <p className="text-muted text-xs mb-1">Total Net Worth</p>
              <p className="text-4xl font-black" style={{ color: netWorth >= 0 ? '#10b981' : '#ef4444' }}>{fmt(netWorth)}</p>
            </div>
            <span className="text-5xl opacity-30">{netWorth >= 0 ? '↗' : '↘'}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'Cash / Balance', value: cashBase, color: '#10b981', icon: '💵' },
              { label: 'Portfolio', value: portValue, color: '#3b82f6', icon: '📈' },
              { label: 'Physical Assets', value: physicalAssets, color: '#8b5cf6', icon: '🏠' },
              { label: 'Net Loan Position', value: moneyLent - moneyOwed, color: moneyLent - moneyOwed >= 0 ? '#f59e0b' : '#ef4444', icon: '🤝' },
            ].map(item => (
              <div key={item.label} className="card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span>{item.icon}</span>
                  <p className="text-muted text-xs">{item.label}</p>
                </div>
                <p className="text-lg font-black" style={{ color: item.value >= 0 ? 'var(--text-primary)' : '#ef4444' }}>
                  {fmt(Math.abs(item.value))}
                </p>
              </div>
            ))}
          </div>

          {nwPieData.length > 0 && (
            <div className="card p-5 mb-4">
              <p className="font-bold text-primary mb-3 text-sm">Asset Allocation</p>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={nwPieData} dataKey="value" cx="50%" cy="50%" outerRadius={85}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={10}>
                    {nwPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt(v)} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="card p-5">
            <p className="font-bold text-primary mb-3 text-sm">Savings Rate Trend</p>
            <p className="text-muted text-xs mb-3">20%+ is considered healthy</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={savingsRateData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => `${v}%`} />
                <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} name="Savings Rate" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* ═══════════════════════ LOANS ═══════════════════════ */}
      {tab === 'Loans' && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatCard label="Money Lent Out" value={fmt(totalLent)} sub={`${lentLoans.length} active`} color="#10b981" />
            <StatCard label="Money You Owe" value={fmt(totalOwed)} sub={`${borrowedLoans.length} active`} color="#ef4444" />
            <StatCard
              label="Net Loan Position"
              value={fmt(totalLent - totalOwed)}
              sub={totalLent - totalOwed >= 0 ? 'In your favor' : 'You owe more'}
              color={totalLent - totalOwed >= 0 ? '#10b981' : '#ef4444'}
            />
          </div>

          {activeLoans.length > 0 && (
            <div className="card p-5 mb-4">
              <p className="font-bold text-primary mb-3 text-sm">Active Loans Breakdown</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={activeLoans.map(l => ({
                    name: l.person_name,
                    amount: parseFloat(calcWithInterest(l.amount, l.interest_rate, l.loan_date).toFixed(2)),
                    type: l.type
                  }))}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                  <Tooltip contentStyle={tooltipStyle} formatter={v => fmt(v)} />
                  <Bar dataKey="amount" name="Amount" radius={[4, 4, 0, 0]}>
                    {activeLoans.map((l, i) => (
                      <Cell key={i} fill={l.type === 'lent' ? '#10b981' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 text-xs font-bold">
                <span style={{ color: '#10b981' }}>● Lent Out</span>
                <span style={{ color: '#ef4444' }}>● Borrowed</span>
              </div>
            </div>
          )}

          <div className="card p-5">
            <p className="font-bold text-primary mb-4 text-sm">Active Loans Detail</p>
            {activeLoans.length === 0 ? (
              <p className="text-center text-muted text-sm py-6">No active loans.</p>
            ) : (
              <div className="space-y-3">
                {activeLoans.map(loan => {
                  const current = calcWithInterest(loan.amount, loan.interest_rate, loan.loan_date)
                  const interest = current - loan.amount
                  const isLent = loan.type === 'lent'
                  return (
                    <div key={loan.id} className="flex items-center justify-between p-3 rounded-xl"
                      style={{ border: '1px solid var(--card-border)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                          style={{ background: isLent ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }}>
                          {isLent ? '↗' : '↘'}
                        </div>
                        <div>
                          <p className="font-semibold text-primary text-sm">{loan.person_name}</p>
                          <p className="text-xs text-muted">{isLent ? 'You lent' : 'You borrowed'} · {loan.loan_date}</p>
                          {loan.interest_rate > 0 && (
                            <p className="text-xs" style={{ color: '#f59e0b' }}>+{fmt(interest)} interest accrued</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-sm" style={{ color: isLent ? '#10b981' : '#ef4444' }}>{fmt(current)}</p>
                        {loan.interest_rate > 0 && <p className="text-xs text-muted">orig: {fmt(loan.amount)}</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Impact on net worth */}
          <div className="card p-4 mt-4">
            <p className="font-bold text-primary text-sm mb-2">Impact on Net Worth</p>
            <p className="text-xs text-muted mb-3">Loans affect your total financial position</p>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Loans add to net worth</span>
              <span className="font-bold" style={{ color: '#10b981' }}>+{fmt(totalLent)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted">Debts reduce net worth</span>
              <span className="font-bold" style={{ color: '#ef4444' }}>-{fmt(totalOwed)}</span>
            </div>
            <div className="border-t mt-2 pt-2 flex justify-between text-sm font-black" style={{ borderColor: 'var(--card-border)' }}>
              <span className="text-primary">Net contribution</span>
              <span style={{ color: totalLent - totalOwed >= 0 ? '#10b981' : '#ef4444' }}>{fmt(totalLent - totalOwed)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
