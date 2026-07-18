import { describe, it, expect } from 'vitest'
import { detectBankIncomeFrequencies } from './incomeFrequency'

describe('detectBankIncomeFrequencies', () => {
  it('returns all zeros for no income', () => {
    expect(detectBankIncomeFrequencies([])).toEqual({ weekly: 0, biweekly: 0, monthly: 0 })
  })

  it('leaves a single deposit from a source uncategorized (no gap to measure)', () => {
    const income = [{ source: 'Acme Corp', date: '2026-07-17', amount: 1000 }]
    expect(detectBankIncomeFrequencies(income)).toEqual({ weekly: 0, biweekly: 0, monthly: 0 })
  })

  it('classifies same-source deposits ~7 days apart as weekly', () => {
    const income = [
      { source: 'Acme Corp', date: '2026-07-03', amount: 500 },
      { source: 'Acme Corp', date: '2026-07-10', amount: 500 },
      { source: 'Acme Corp', date: '2026-07-17', amount: 500 },
    ]
    expect(detectBankIncomeFrequencies(income).weekly).toBe(1500)
  })

  it('classifies same-source deposits ~14 days apart as biweekly', () => {
    const income = [
      { source: 'Acme Corp', date: '2026-07-03', amount: 900 },
      { source: 'Acme Corp', date: '2026-07-17', amount: 900 },
    ]
    expect(detectBankIncomeFrequencies(income).biweekly).toBe(1800)
  })

  it('classifies same-source deposits ~30 days apart as monthly', () => {
    const income = [
      { source: 'Acme Corp', date: '2026-06-17', amount: 4000 },
      { source: 'Acme Corp', date: '2026-07-17', amount: 4000 },
    ]
    expect(detectBankIncomeFrequencies(income).monthly).toBe(8000)
  })

  it('keeps different sources in separate groups', () => {
    const income = [
      { source: 'Acme Corp', date: '2026-07-03', amount: 500 },
      { source: 'Acme Corp', date: '2026-07-10', amount: 500 },
      { source: 'Freelance Client', date: '2026-06-17', amount: 2000 },
      { source: 'Freelance Client', date: '2026-07-17', amount: 2000 },
    ]
    const result = detectBankIncomeFrequencies(income)
    expect(result.weekly).toBe(1000)
    expect(result.monthly).toBe(4000)
  })

  it('falls back to description and a default key when source is missing', () => {
    const income = [
      { description: 'Payroll Deposit', date: '2026-07-03', amount: 300 },
      { description: 'Payroll Deposit', date: '2026-07-10', amount: 300 },
    ]
    expect(detectBankIncomeFrequencies(income).weekly).toBe(600)
  })

  it('is case/whitespace-insensitive when grouping by source', () => {
    const income = [
      { source: ' Acme Corp ', date: '2026-07-03', amount: 500 },
      { source: 'acme corp', date: '2026-07-10', amount: 500 },
    ]
    expect(detectBankIncomeFrequencies(income).weekly).toBe(1000)
  })
})
