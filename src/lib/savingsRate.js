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
