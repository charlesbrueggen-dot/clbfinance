import { describe, it, expect } from 'vitest'
import { detectBankIncomeFrequencies } from './incomeFrequency'

describe('detectBankIncomeFrequencies', () => {
  it('returns all zeros for no income', () => {
    expect(detectBankIncomeFrequencies([])).toEqual({ weekly: 0, biweekly: 0, monthly: 0 })
  })

  it('leaves a single deposit uncategorized (no gap to measure)', () => {
    const income = [{ description: 'Acme Corp Payroll', date: '2026-07-17', amount: 1000 }]
    expect(detectBankIncomeFrequencies(income)).toEqual({ weekly: 0, biweekly: 0, monthly: 0 })
  })

  it('reports the per-occurrence average, not the lifetime sum, for same-payer deposits ~7 days apart', () => {
    const income = [
      { description: 'Acme Corp Payroll', date: '2026-07-03', amount: 500 },
      { description: 'Acme Corp Payroll', date: '2026-07-10', amount: 500 },
      { description: 'Acme Corp Payroll', date: '2026-07-17', amount: 600 },
    ]
    expect(detectBankIncomeFrequencies(income).weekly).toBeCloseTo((500 + 500 + 600) / 3)
  })

  it('classifies same-payer deposits ~14 days apart as biweekly', () => {
    const income = [
      { description: 'Acme Corp Payroll', date: '2026-07-03', amount: 900 },
      { description: 'Acme Corp Payroll', date: '2026-07-17', amount: 900 },
    ]
    expect(detectBankIncomeFrequencies(income).biweekly).toBe(900)
  })

  it('classifies same-payer deposits ~30 days apart as monthly', () => {
    const income = [
      { description: 'Acme Corp Payroll', date: '2026-06-17', amount: 4000 },
      { description: 'Acme Corp Payroll', date: '2026-07-17', amount: 4000 },
    ]
    expect(detectBankIncomeFrequencies(income).monthly).toBe(4000)
  })

  it('does not let years of synced history inflate the figure beyond a single period\'s worth', () => {
    // 26 biweekly deposits of $2000 each (a year's worth of paychecks) should read as "$2000
    // every 2 weeks", not "$52,000" — the lifetime total the old (buggy) implementation reported.
    const income = []
    for (let i = 0; i < 26; i++) {
      const d = new Date('2026-01-01T00:00:00Z')
      d.setUTCDate(d.getUTCDate() + i * 14)
      income.push({ description: 'Acme Corp Payroll', date: d.toISOString().split('T')[0], amount: 2000 })
    }
    expect(detectBankIncomeFrequencies(income).biweekly).toBe(2000)
  })

  it('sums the per-occurrence averages of different payers sharing a cadence', () => {
    const income = [
      { description: 'Acme Corp Payroll 4471', date: '2026-07-03', amount: 500 },
      { description: 'Acme Corp Payroll 9902', date: '2026-07-10', amount: 500 },
      { description: 'Freelance Client Payout 1123', date: '2026-06-17', amount: 2000 },
      { description: 'Freelance Client Payout 8834', date: '2026-07-17', amount: 2000 },
    ]
    const result = detectBankIncomeFrequencies(income)
    expect(result.weekly).toBe(500)
    expect(result.monthly).toBe(2000)
  })

  it('does not merge unrelated deposits just because they share the same classified source', () => {
    // A CSV import tags many unrelated one-off deposits with the same generic `source` bucket
    // (e.g. "Other" or "Salary") regardless of who actually paid them. These three land 7 days
    // apart from each other and would average out to a perfectly "regular" weekly cadence if
    // grouped by that shared source — grouping by description instead keeps them apart, since
    // each is really a distinct one-time payer that happened to land in the same week.
    const income = [
      { description: 'Random Deposit A', source: 'Other', date: '2026-07-03', amount: 5000 },
      { description: 'Random Deposit B', source: 'Other', date: '2026-07-10', amount: 3000 },
      { description: 'Random Deposit C', source: 'Other', date: '2026-07-17', amount: 1000 },
    ]
    expect(detectBankIncomeFrequencies(income)).toEqual({ weekly: 0, biweekly: 0, monthly: 0 })
  })

  it('does not classify an irregular spread of dates just because the average happens to land near a cadence', () => {
    const income = [
      { description: 'Acme Corp Payroll', date: '2026-01-01', amount: 500 },
      { description: 'Acme Corp Payroll', date: '2026-01-02', amount: 500 },
      { description: 'Acme Corp Payroll', date: '2026-02-20', amount: 500 }, // huge gap after two adjacent days
    ]
    expect(detectBankIncomeFrequencies(income)).toEqual({ weekly: 0, biweekly: 0, monthly: 0 })
  })

  it('falls back to source only when there is no description or merchant text', () => {
    const income = [
      { source: 'Salary', date: '2026-07-03', amount: 300 },
      { source: 'Salary', date: '2026-07-10', amount: 300 },
    ]
    expect(detectBankIncomeFrequencies(income).weekly).toBe(300)
  })

  it('is case/whitespace-insensitive when grouping by description', () => {
    const income = [
      { description: ' Acme Corp Payroll ', date: '2026-07-03', amount: 500 },
      { description: 'ACME CORP PAYROLL', date: '2026-07-10', amount: 500 },
    ]
    expect(detectBankIncomeFrequencies(income).weekly).toBe(500)
  })
})
