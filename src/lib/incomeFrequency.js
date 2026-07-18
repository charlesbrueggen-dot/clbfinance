const MS_PER_DAY = 1000 * 60 * 60 * 24

// `source` on a bank-synced transaction is one of a handful of generic buckets (Salary,
// Freelance, Refund, Other, ...) shared by every payer that matches that pattern — grouping by
// it would lump unrelated one-off deposits together just because they got the same label, and
// averaging their dates produces a bogus cadence. The description/merchant text is what actually
// identifies a specific payer, so it's used first; `source` is only a fallback for the rare
// row with no description at all. Trailing reference/batch numbers are stripped so the same
// payer still groups together even when each deposit's descriptor ends in a different number.
function groupKey(item) {
  const text = (item.description || item.merchant || item.source || 'bank income')
    .trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+\d{2,}\s*$/, '')
    .trim()
  return text || 'bank income'
}

// A repeat only counts as a given cadence if its average gap lands inside one of these windows
// AND every individual gap stays within `tolerance` of that average — otherwise a handful of
// unrelated deposits that happen to average out near a cadence (e.g. one this week, one seven
// weeks ago) would get misclassified as recurring.
const CADENCES = [
  { frequency: 'weekly',   target: 7,  tolerance: 2 },
  { frequency: 'biweekly', target: 14, tolerance: 3 },
  { frequency: 'monthly',  target: 30, tolerance: 6 },
]

function classifyCadence(avgGap) {
  return CADENCES.find(c => Math.abs(avgGap - c.target) <= c.tolerance) || null
}

// Estimates a recurring cadence (weekly/biweekly/monthly) for bank-synced income by grouping
// same-payer deposits and looking at the regularity of the gaps between them — unlike manual
// income entries, a bank transaction has no declared `frequency`, so this is the only way to
// tell a recurring paycheck from a one-off deposit. A payer needs at least 2 occurrences to have
// a gap to measure, and the gaps need to actually be regular; anything else (including a single
// deposit) is left out of the totals rather than guessed at.
//
// The totals are a rate — "how much shows up every week/2 weeks/month" — not a lifetime sum of
// every past deposit. A payer synced from years of statement history would otherwise dwarf the
// figure with money already spent long ago, so each recurring payer contributes its *average
// per-occurrence* amount, and those averages are what get summed across payers sharing a cadence.
export function detectBankIncomeFrequencies(bankIncome) {
  const groups = {}
  bankIncome.forEach(item => {
    const key = groupKey(item)
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
    const cadence = classifyCadence(avgGap)
    const regular = cadence && gaps.every(g => Math.abs(g - avgGap) <= cadence.tolerance)
    if (!regular) return

    const avgAmount = sorted.reduce((s, i) => s + Number(i.amount), 0) / sorted.length
    totals[cadence.frequency] += avgAmount
  })
  return totals
}
