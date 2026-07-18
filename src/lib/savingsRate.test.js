import { describe, it, expect } from 'vitest'
import { bucketMonthlyTotals, computeSavingsRate } from './savingsRate'

const FIXED_NOW = new Date(2026, 5, 15) // June 15, 2026

describe('bucketMonthlyTotals', () => {
  it('creates one zero-initialized bucket per requested month, oldest first', () => {
    const buckets = bucketMonthlyTotals([], [], 3, FIXED_NOW)
    expect(buckets).toHaveLength(3)
    expect(buckets.map(b => b.key)).toEqual(['2026-04', '2026-05', '2026-06'])
    expect(buckets.every(b => b.income === 0 && b.expenses === 0)).toBe(true)
  })

  it('sums income and expenses into the bucket matching their date', () => {
    const income = [{ date: '2026-06-01', amount: 1000 }, { date: '2026-05-10', amount: 500 }]
    const expenses = [{ date: '2026-06-15', amount: 300 }]
    const buckets = bucketMonthlyTotals(income, expenses, 3, FIXED_NOW)
    const june = buckets.find(b => b.key === '2026-06')
    const may  = buckets.find(b => b.key === '2026-05')
    expect(june.income).toBe(1000)
    expect(june.expenses).toBe(300)
    expect(may.income).toBe(500)
  })

  it('ignores entries outside the requested window', () => {
    const income = [{ date: '2025-01-01', amount: 9999 }]
    const buckets = bucketMonthlyTotals(income, [], 3, FIXED_NOW)
    expect(buckets.reduce((s, b) => s + b.income, 0)).toBe(0)
  })

  it('derives net and savings per bucket', () => {
    const income = [{ date: '2026-06-01', amount: 1000 }]
    const expenses = [{ date: '2026-06-01', amount: 400 }]
    const [june] = bucketMonthlyTotals(income, expenses, 1, FIXED_NOW)
    expect(june.net).toBe(600)
    expect(june.savings).toBe(600)
  })

  it('floors savings at zero for a net-negative month (never shows negative "saved")', () => {
    const income = [{ date: '2026-06-01', amount: 100 }]
    const expenses = [{ date: '2026-06-01', amount: 400 }]
    const [june] = bucketMonthlyTotals(income, expenses, 1, FIXED_NOW)
    expect(june.net).toBe(-300)
    expect(june.savings).toBe(0)
  })
})

describe('computeSavingsRate', () => {
  it('returns 0.0 for an empty set of months', () => {
    expect(computeSavingsRate([])).toEqual({ avgMonthlyIncome: 0, avgMonthlyExpenses: 0, avgMonthlySavings: 0, rate: '0.0' })
  })

  it('returns 0.0 rather than dividing by zero when average income is zero', () => {
    const months = [{ income: 0, expenses: 200 }]
    expect(computeSavingsRate(months).rate).toBe('0.0')
  })

  it('computes the average monthly savings rate across months', () => {
    const months = [
      { income: 1000, expenses: 700 }, // 30% saved
      { income: 1000, expenses: 900 }, // 10% saved
    ]
    const result = computeSavingsRate(months)
    expect(result.avgMonthlyIncome).toBe(1000)
    expect(result.avgMonthlyExpenses).toBe(800)
    expect(result.avgMonthlySavings).toBe(200)
    expect(result.rate).toBe('20.0')
  })

  it('can go negative when spending exceeds income on average', () => {
    const months = [{ income: 500, expenses: 1500 }]
    const result = computeSavingsRate(months)
    expect(result.rate).toBe('-200.0')
  })
})
