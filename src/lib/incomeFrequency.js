const MS_PER_DAY = 1000 * 60 * 60 * 24

const normalizeKey = text => (text || 'Bank Income').trim().toLowerCase()

// Estimates a recurring cadence (weekly/biweekly/monthly) for bank-synced income by grouping
// same-source deposits and looking at the average gap between repeats — unlike manual income
// entries, a bank transaction has no declared `frequency`, so this is the only way to tell a
// recurring paycheck from a one-off deposit. A source needs at least 2 occurrences to have a gap
// to measure at all; a single deposit is left uncategorized rather than guessed at.
export function detectBankIncomeFrequencies(bankIncome) {
  const groups = {}
  bankIncome.forEach(item => {
    const key = normalizeKey(item.source || item.description)
    ;(groups[key] ||= []).push(item)
  })

  const totals = { weekly: 0, biweekly: 0, monthly: 0 }
  Object.values(groups).forEach(items => {
    if (items.length < 2) return
    const sorted = [...items].sort((a, b) => new Date(a.date) - new Date(b.date))
    const gaps = []
    for (let i = 1; i < sorted.length; i++) {
      gaps.push((new Date(sorted[i].date) - new Date(sorted[i - 1].date)) / MS_PER_DAY)
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length

    let frequency = null
    if (avgGap <= 10) frequency = 'weekly'
    else if (avgGap <= 20) frequency = 'biweekly'
    else if (avgGap <= 45) frequency = 'monthly'

    if (frequency) totals[frequency] += sorted.reduce((s, i) => s + Number(i.amount), 0)
  })
  return totals
}
