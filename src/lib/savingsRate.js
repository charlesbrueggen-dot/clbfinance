const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// Buckets income/expense entries (each a { date: 'YYYY-MM-DD', amount }) into the trailing
// `months` calendar months ending with the current month. Shared by every page that shows a
// month-by-month or average "savings rate" figure, so they can't drift out of sync with each
// other the way Dashboard and Analytics once did.
export function bucketMonthlyTotals(income, expenses, months, now = new Date()) {
  const monthMap = {}
  for (let i = months - 1; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthMap[key] = { key, label: `${MONTH_ABBR[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`, income: 0, expenses: 0 }
  }
  income.forEach(i => { const key = i.date?.slice(0, 7); if (monthMap[key]) monthMap[key].income += parseFloat(i.amount) })
  expenses.forEach(e => { const key = e.date?.slice(0, 7); if (monthMap[key]) monthMap[key].expenses += parseFloat(e.amount) })
  return Object.values(monthMap).map(m => ({ ...m, net: m.income - m.expenses, savings: Math.max(0, m.income - m.expenses) }))
}

// Trailing average savings rate (%) over a set of bucketed months (see bucketMonthlyTotals).
export function computeSavingsRate(monthlyTotals) {
  if (!monthlyTotals.length) return { avgMonthlyIncome: 0, avgMonthlyExpenses: 0, avgMonthlySavings: 0, rate: '0.0' }
  const avgMonthlyIncome   = monthlyTotals.reduce((s, m) => s + m.income, 0) / monthlyTotals.length
  const avgMonthlyExpenses = monthlyTotals.reduce((s, m) => s + m.expenses, 0) / monthlyTotals.length
  const avgMonthlySavings  = avgMonthlyIncome - avgMonthlyExpenses
  const rate = avgMonthlyIncome > 0 ? ((avgMonthlySavings / avgMonthlyIncome) * 100).toFixed(1) : '0.0'
  return { avgMonthlyIncome, avgMonthlyExpenses, avgMonthlySavings, rate }
}

// Day-by-day version of bucketMonthlyTotals — same shape, one point per calendar day instead
// of per calendar month, so line/area charts get real resolution (dozens to hundreds of points)
// instead of 3-12 chunky monthly dots. Also carries `cumulativeSavings`, a running income-minus-
// expenses total *within the selected window* (starts at 0 on the first day shown), which is
// what a "Savings Accumulated" style chart should actually plot — the old `savings` field
// (kept for parity with bucketMonthlyTotals) resets every bucket and isn't cumulative.
export function bucketDailyTotals(income, expenses, days, now = new Date()) {
  const dayMap = {}
  const order  = []
  for (let i = days - 1; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    order.push(key)
    dayMap[key] = { key, label: `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`, income: 0, expenses: 0 }
  }
  income.forEach(i => { const key = i.date?.slice(0, 10); if (dayMap[key]) dayMap[key].income += parseFloat(i.amount) })
  expenses.forEach(e => { const key = e.date?.slice(0, 10); if (dayMap[key]) dayMap[key].expenses += parseFloat(e.amount) })

  let cumulative = 0
  return order.map(key => {
    const m   = dayMap[key]
    const net = m.income - m.expenses
    cumulative += net
    return { ...m, net, savings: Math.max(0, net), cumulativeSavings: cumulative }
  })
}

// Smooths a raw day-by-day savings rate into a trailing-window curve. A literal day's rate
// (that day's income vs. that day's expenses) is mostly meaningless — income usually lands on
// only a few days a month, so the raw series is flat 0% punctuated by spikes on paydays. Summing
// income/expenses over a trailing window first, then taking the ratio, gives a genuinely smooth
// trend line instead of a sawtooth.
export function rollingSavingsRate(dailyTotals, windowDays = 7) {
  const window = []
  let wIncome = 0, wExpenses = 0
  return dailyTotals.map(d => {
    window.push(d)
    wIncome += d.income
    wExpenses += d.expenses
    if (window.length > windowDays) {
      const dropped = window.shift()
      wIncome -= dropped.income
      wExpenses -= dropped.expenses
    }
    const rate = wIncome > 0 ? parseFloat((((wIncome - wExpenses) / wIncome) * 100).toFixed(1)) : 0
    return { label: d.label, rate }
  })
}
