// src/pages/Analytics.jsx
// ─────────────────────────────────────────────────────────────────────────────
//  Analytics — now includes account_transactions in all totals:
//   • Income  = income table  + account_transactions kind='income'
//   • Expenses = expenses table + account_transactions kind='expense'
//  All charts auto-reflect the merged data.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { useTransactions } from '../hooks/useTransactions'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell
} from 'recharts'

const fmt      = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const fmtShort = n => { if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`; return fmt(n) }
const MONTHS   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const TABS     = ['Overview', 'Cash Flow', 'Spending', 'Net Worth', 'Loans']
const PIE_COLORS = ['#3b82f6','#f97316','#8b5cf6','#ef4444','#06b6d4','#84cc16','#ec4899','#14b8a6','#f59e0b','#64748b']

const calcWithInterest = (principal, rate, startDate) => {
  if (!rate || !startDate) return principal
  const years = (new Date() - new Date(startDate + 'T12:00:00')) / (365.25 * 24 * 60 * 60 * 1000)
  if (years <= 0) return principal
  return principal * Math.pow(1 + rate / 100, years)
}

const StatCard = ({ label, value, sub, color, onClick }) => (
  <div className="card p-4 cursor-pointer hover:opacity-90 transition-opacity" onClick={onClick}
    style={{ borderLeft: color ? `3px solid ${color}` : undefined }}>
    <p className="text-muted text-xs mb-1">{label}</p>
    <p className="text-xl font-black text-primary">{value}</p>
    {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
  </div>
)

export default function Analytics() {
  const { user }                              = useAuth()
  const { expenseTxns, incomeTxns, loading: txnLoading } = useTransactions()

  // Own data
  const [income,      setIncome]      = useState([])
  const [expenses,    setExpenses]    = useState([])
  const [investments, setInvestments] = useState([])
  const [loans,       setLoans]       = useState([])
  const [assets,      setAssets]      = useState([])
  const [balance,     setBalance]     = useState([])
  const [dataLoading, setDataLoading] = useState(true)

  const [tab,   setTab]   = useState('Overview')
  const [range, setRange] = useState('6')
  const [dark,  setDarkDetect] = useState(document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const obs = new MutationObserver(() => setDarkDetect(document.documentElement.classList.contains('dark')))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const load = async () => {
      const [{ data: inc }, { data: exp }, { data: inv }, { data: ln }, { data: ast }, { data: bal }] = await Promise.all([
        supabase.from('income').select('*').eq('user_id', user.id),
        supabase.from('expenses').select('*').eq('user_id', user.id),
        supabase.from('investments').select('*').eq('user_id', user.id),
        supabase.from('loans').select('*').eq('user_id', user.id),
        supabase.from('assets').select('*').eq('user_id', user.id),
        supabase.from('balance').select('*').eq('user_id', user.id),
      ])
      setIncome(inc || []); setExpenses(exp || []); setInvestments(inv || [])
      setLoans(ln || []); setAssets(ast || []); setBalance(bal || [])
      setDataLoading(false)
    }
    load()
  }, [user.id])

  // ── Merge account_transactions into income/expense pools ──────────────────
  const allIncome = useMemo(() => [
    ...income,
    ...incomeTxns.map(t => ({ id: t.id, amount: t.amount, date: t.date, source: t.source || 'Account', _fromAcct: true })),
  ], [income, incomeTxns])

  const allExpenses = useMemo(() => [
    ...expenses,
    ...expenseTxns.map(t => ({ id: t.id, amount: t.amount, date: t.date, category: t.category || 'Wants', subcategory: t.subcategory || 'Other', _fromAcct: true })),
  ], [expenses, expenseTxns])

  // ── Month buckets ─────────────────────────────────────────────────────────
  const months = parseInt(range)
  const now    = new Date()

  const chartData = useMemo(() => {
    const monthMap = {}
    for (let i = months - 1; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthMap[key] = { label: `${MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`, income: 0, expenses: 0 }
    }
    allIncome.forEach(i => { if (monthMap[i.date?.slice(0, 7)]) monthMap[i.date.slice(0, 7)].income += parseFloat(i.amount) })
    allExpenses.forEach(e => { if (monthMap[e.date?.slice(0, 7)]) monthMap[e.date.slice(0, 7)].expenses += parseFloat(e.amount) })
    return Object.values(monthMap).map(m => ({ ...m, net: m.income - m.expenses, savings: Math.max(0, m.income - m.expenses) }))
  }, [allIncome, allExpenses, months])

  // ── Summary numbers ───────────────────────────────────────────────────────
  const totalIncome   = allIncome.reduce((s, i) => s + parseFloat(i.amount), 0)
  const totalExpenses = allExpenses.reduce((s, e) => s + parseFloat(e.amount), 0)
  const totalBalance  = balance.reduce((s, b) => s + b.amount, 0)
  const avgMonthlyIncome   = chartData.length ? chartData.reduce((s, m) => s + m.income, 0) / chartData.length : 0
  const avgMonthlyExpenses = chartData.length ? chartData.reduce((s, m) => s + m.expenses, 0) / chartData.length : 0
  const avgMonthlySavings  = avgMonthlyIncome - avgMonthlyExpenses
  const savingsRate = avgMonthlyIncome > 0 ? ((avgMonthlySavings / avgMonthlyIncome) * 100).toFixed(1) : '0.0'

  // ── Net Worth ─────────────────────────────────────────────────────────────
  const portValue      = investments.reduce((s, i) => s + (i.shares * (i.current_price || i.avg_cost)), 0)
  const physicalAssets = assets.reduce((s, a) => s + a.value, 0)
  const moneyLent      = loans.filter(l => l.type === 'lent'     && !l.settled).reduce((s, l) => s + calcWithInterest(l.amount, l.interest_rate, l.loan_date), 0)
  const moneyOwed      = loans.filter(l => l.type === 'borrowed' && !l.settled).reduce((s, l) => s + calcWithInterest(l.amount, l.interest_rate, l.loan_date), 0)
  const cashBase       = totalBalance > 0 ? totalBalance : totalIncome - totalExpenses
  const netWorth       = cashBase + portValue + physicalAssets + moneyLent - moneyOwed

  const nwPieData = [
    cashBase > 0      && { name: 'Cash / Balance',   value: cashBase },
    portValue > 0     && { name: 'Investments',       value: portValue },
    physicalAssets > 0 && { name: 'Physical Assets', value: physicalAssets },
    moneyLent > 0     && { name: 'Money Lent',        value: moneyLent },
  ].filter(Boolean)

  // ── Spending by category (merged) ─────────────────────────────────────────
  const catMap = {}
  allExpenses.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + parseFloat(e.amount) })
  const catData = Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))

  // Subcategory breakdown (new — powered by account_transactions)
  const subCatMap = {}
  allExpenses.forEach(e => {
    const key = `${e.category}: ${e.subcategory || 'Other'}`
    subCatMap[key] = (subCatMap[key] || 0) + parseFloat(e.amount)
  })
  const subCatData = Object.entries(subCatMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }))

  const spendTrendData   = chartData.map(m => ({ label: m.label, expenses: m.expenses }))
  const savingsRateData  = chartData.map(m => ({ label: m.label, rate: m.income > 0 ? parseFloat(((m.income - m.expenses) / m.income * 100).toFixed(1)) : 0 }))

  // Loans
  const activeLoans   = loans.filter(l => !l.settled)
  const lentLoans     = activeLoans.filter(l => l.type === 'lent')
  const borrowedLoans = activeLoans.filter(l => l.type === 'borrowed')
  const totalLent     = lentLoans.reduce((s, l) => s + calcWithInterest(l.amount, l.interest_rate, l.loan_date), 0)
  const totalOwed     = borrowedLoans.reduce((s, l) => s + calcWithInterest(l.amount, l.interest_rate, l.loan_date), 0)

  const lineColorIncome = dark ? '#10b981' : '#1a3a6b'
  const lineColorExp    = dark ? '#ef4444' : '#e05c2a'
  const lineColorNet    = dark ? '#34d399' : '#f0a500'
  const tooltipStyle    = { background: 'var(--modal-bg)', border: '1px solid var(--card-border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 13 }

  const exportCSV = () => {
    const rows = ['Date,Income,Expenses,Net,Savings Rate %']
      .concat(chartData.map(m => `${m.label},${m.income},${m.expenses},${m.net},${m.income > 0 ? ((m.net / m.income) * 100).toFixed(1) : 0}`))
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a    = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'stride-analytics.csv'; a.click()
  }

  const loading = dataLoading || txnLoading
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }} />
    </div>
  )

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tight">Analytics</h1>
          <p className="text-muted text-sm mt-1">Full picture — manual entries + account transactions</p>
        </div>
        <button onClick={exportCSV} className="btn-secondary text-sm flex-shrink-0">⬇ CSV</button>
      </div>

      {/* Account txn inclusion notice */}
      {(expenseTxns.length > 0 || incomeTxns.length > 0) && (
        <div className="rounded-xl px-4 py-3 mb-4 flex items-center gap-2 text-xs font-medium"
          style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#3b82f6' }}>
          <span>💳</span>
          <span>Includes {expenseTxns.length} account expense{expenseTxns.length !== 1 ? 's' : ''} and {incomeTxns.length} account income transaction{incomeTxns.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Range selector + tabs */}
      <div className="flex gap-2 overflow-x-auto mb-4 pb-1" style={{ scrollbarWidth: 'none' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all"
            style={{
              background: tab === t ? 'var(--text-primary)' : 'var(--input-bg)',
              color:      tab === t ? 'var(--bg-primary)'   : 'var(--text-muted)',
              border:     '1px solid var(--card-border)',
            }}>
            {t}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-5">
        {[['3','3M'],['6','6M'],['12','1Y']].map(([v, l]) => (
          <button key={v} onClick={() => setRange(v)}
            className="px-3 py-1 rounded-lg text-xs font-bold transition-all"
            style={{
              background: range === v ? 'var(--text-primary)' : 'var(--input-bg)',
              color:      range === v ? 'var(--bg-primary)'   : 'var(--text-muted)',
              border:     '1px solid var(--card-border)',
            }}>
            {l}
          </button>
        ))}
      </div>

      {/* ═══════════════════════ OVERVIEW ═══════════════════════ */}
      {tab === 'Overview' && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCard label="Total Income"    value={fmt(totalIncome)}   sub={`${allIncome.length} entries`}   color="#10b981" />
            <StatCard label="Total Expenses"  value={fmt(totalExpenses)} sub={`${allExpenses.length} entries`} color="#ef4444" />
            <StatCard label="Avg Monthly Income"  value={fmt(avgMonthlyIncome)}   sub="over selected period" color={lineColorIncome} />
            <StatCard label="Avg Monthly Expense" value={fmt(avgMonthlyExpenses)} sub="over selected period" color={lineColorExp} />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="card p-4">
              <p className="text-muted text-xs mb-1">Savings Rate</p>
              <p className="text-2xl font-black text-primary">{savingsRate}%</p>
              <p className="text-xs text-muted mt-0.5">{parseFloat(savingsRate) >= 20 ? '✅ Healthy' : '⚠ Below 20%'}</p>
            </div>
            <div className="card p-4">
              <p className="text-muted text-xs mb-1">Avg Monthly Saved</p>
              <p className="text-2xl font-black" style={{ color: avgMonthlySavings >= 0 ? 'var(--text-primary)' : '#ef4444' }}>{fmt(avgMonthlySavings)}</p>
              <p className="text-xs text-muted mt-0.5">per month</p>
            </div>
          </div>

          <div className="card p-5 mb-4">
            <p className="font-bold text-primary text-sm mb-3">Income vs Expenses</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={lineColorIncome} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={lineColorIncome} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={lineColorExp} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={lineColorExp} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => fmt(v)} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="income"   name="Income"   stroke={lineColorIncome} fill="url(#colorInc)" strokeWidth={2.5} dot={{ r: 3 }} />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke={lineColorExp}    fill="url(#colorExp)" strokeWidth={2.5} dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-5">
            <p className="font-bold text-primary text-sm mb-3">Monthly Net (Income − Expenses)</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => fmt(v)} />
                <Bar dataKey="net" name="Net" radius={[4,4,0,0]}>
                  {chartData.map((m, i) => <Cell key={i} fill={m.net >= 0 ? lineColorIncome : lineColorExp} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* ═══════════════════════ CASH FLOW ═══════════════════════ */}
      {tab === 'Cash Flow' && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCard label="Total Cash In"  value={fmt(totalIncome)}   sub={`${allIncome.length} entries`}   color="#10b981" />
            <StatCard label="Total Cash Out" value={fmt(totalExpenses)} sub={`${allExpenses.length} entries`} color="#ef4444" />
          </div>
          <div className="card p-5 mb-4">
            <p className="font-bold text-primary text-sm mb-3">Cash Flow Over Time</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => fmt(v)} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="income"   name="Income"   stroke={lineColorIncome} strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="expenses" name="Expenses" stroke={lineColorExp}    strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="net"      name="Net"      stroke={lineColorNet}    strokeWidth={2}   dot={{ r: 3 }} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-5">
            <p className="font-bold text-primary text-sm mb-3">Savings Accumulated</p>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => fmt(v)} />
                <Area type="monotone" dataKey="savings" name="Saved" stroke="#10b981" fill="rgba(16,185,129,0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* ═══════════════════════ SPENDING ═══════════════════════ */}
      {tab === 'Spending' && (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatCard label="Total Spent"   value={fmt(totalExpenses)}  sub={`${allExpenses.length} entries`} color="#ef4444" />
            <StatCard label="Avg / Month"   value={fmt(avgMonthlyExpenses)} sub="over period" color="#f97316" />
          </div>

          {catData.length > 0 && (
            <div className="card p-5 mb-4">
              <p className="font-bold text-primary text-sm mb-3">Spending by Category</p>
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

          {/* Subcategory breakdown — powered by account_transactions data */}
          {subCatData.length > 0 && (
            <div className="card p-5 mb-4">
              <p className="font-bold text-primary text-sm mb-1">Subcategory Breakdown</p>
              <p className="text-muted text-xs mb-3">Top 8 subcategories across all sources</p>
              <div className="space-y-3">
                {subCatData.map(({ name, value }) => (
                  <div key={name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-primary font-medium">{name}</span>
                      <span className="text-muted">{fmt(value)}</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${Math.min(100, (value / totalExpenses) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card p-5 mb-4">
            <p className="font-bold text-primary text-sm mb-3">Monthly Spending Trend</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={spendTrendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                <Tooltip contentStyle={tooltipStyle} formatter={v => fmt(v)} />
                <Bar dataKey="expenses" name="Spending" fill={lineColorExp} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* ═══════════════════════ NET WORTH ═══════════════════════ */}
      {tab === 'Net Worth' && (
        <>
          <div className="card p-6 mb-4 flex items-center justify-between">
            <div>
              <p className="text-muted text-xs mb-1">Total Net Worth</p>
              <p className="text-4xl font-black" style={{ color: netWorth >= 0 ? 'var(--text-primary)' : '#ef4444' }}>{fmt(Math.abs(netWorth))}</p>
              <p className="text-xs text-muted mt-1">{netWorth >= 0 ? 'Positive position' : 'Deficit'}</p>
            </div>
            <span className="text-5xl opacity-30">{netWorth >= 0 ? '↗' : '↘'}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'Cash / Balance',   value: cashBase,              color: '#10b981', icon: '💵' },
              { label: 'Portfolio',         value: portValue,             color: '#3b82f6', icon: '📈' },
              { label: 'Physical Assets',   value: physicalAssets,        color: '#8b5cf6', icon: '🏠' },
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
            <StatCard label="Money Lent Out"   value={fmt(totalLent)} sub={`${lentLoans.length} active`}     color="#10b981" />
            <StatCard label="Money You Owe"    value={fmt(totalOwed)} sub={`${borrowedLoans.length} active`} color="#ef4444" />
            <StatCard label="Net Loan Position" value={fmt(totalLent - totalOwed)} sub={totalLent - totalOwed >= 0 ? 'In your favor' : 'You owe more'} color={totalLent - totalOwed >= 0 ? '#10b981' : '#ef4444'} />
          </div>

          {activeLoans.length > 0 && (
            <div className="card p-5 mb-4">
              <p className="font-bold text-primary mb-3 text-sm">Active Loans Breakdown</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={activeLoans.map(l => ({ name: l.person_name, amount: parseFloat(calcWithInterest(l.amount, l.interest_rate, l.loan_date).toFixed(2)), type: l.type }))} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
                  <Tooltip contentStyle={tooltipStyle} formatter={v => fmt(v)} />
                  <Bar dataKey="amount" name="Amount" radius={[4,4,0,0]}>
                    {activeLoans.map((l, i) => <Cell key={i} fill={l.type === 'lent' ? '#10b981' : '#ef4444'} />)}
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
                  const current  = calcWithInterest(loan.amount, loan.interest_rate, loan.loan_date)
                  const interest = current - loan.amount
                  const isLent   = loan.type === 'lent'
                  return (
                    <div key={loan.id} className="flex items-center justify-between p-3 rounded-xl" style={{ border: '1px solid var(--card-border)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ background: isLent ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }}>
                          {isLent ? '↗' : '↘'}
                        </div>
                        <div>
                          <p className="font-semibold text-primary text-sm">{loan.person_name}</p>
                          <p className="text-xs text-muted">{isLent ? 'You lent' : 'You borrowed'} · {loan.loan_date}</p>
                          {loan.interest_rate > 0 && <p className="text-xs" style={{ color: '#f59e0b' }}>+{fmt(interest)} interest accrued</p>}
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
