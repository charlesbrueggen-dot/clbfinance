import { describe, it, expect } from 'vitest'
import { autoCategorize } from './useTransactions'

describe('autoCategorize', () => {
  it('categorizes rent paid through a payment app as Needs/Rent, not a payment-app income transfer', () => {
    const result = autoCategorize('Rent Payment - Zelle')
    expect(result.kind).toBe('expense')
    expect(result.category).toBe('Needs')
    expect(result.subcategory).toBe('Rent')
  })

  it('still categorizes a generic payment-app transfer as income when nothing more specific matches', () => {
    const result = autoCategorize('Zelle from John Smith')
    expect(result.kind).toBe('income')
    expect(result.source).toBe('Transfer In')
  })

  it('categorizes payroll as income', () => {
    const result = autoCategorize('Payroll Direct Deposit - Acme Corp')
    expect(result.kind).toBe('income')
    expect(result.source).toBe('Salary')
  })

  it('categorizes groceries as Needs even when paid via a payment app', () => {
    const result = autoCategorize('Whole Foods Market - Venmo')
    expect(result.kind).toBe('expense')
    expect(result.category).toBe('Needs')
    expect(result.subcategory).toBe('Groceries')
  })

  it('falls back to expense/Wants/Other for anything unrecognized', () => {
    const result = autoCategorize('XYZ Unknown Merchant 12345')
    expect(result).toEqual({ kind: 'expense', category: 'Wants', subcategory: 'Other', source: null, auto: false })
  })
})
