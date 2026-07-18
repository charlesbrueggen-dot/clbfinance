import { describe, it, expect } from 'vitest'
import { calcWithInterest } from './loanMath'

describe('calcWithInterest', () => {
  it('returns the principal unchanged when there is no rate', () => {
    expect(calcWithInterest(1000, 0, '2020-01-01')).toBe(1000)
    expect(calcWithInterest(1000, null, '2020-01-01')).toBe(1000)
  })

  it('returns the principal unchanged when there is no start date', () => {
    expect(calcWithInterest(1000, 5, null)).toBe(1000)
  })

  it('returns the principal unchanged for a start date in the future', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)
    const isoDate = future.toISOString().split('T')[0]
    expect(calcWithInterest(1000, 5, isoDate)).toBe(1000)
  })

  it('compounds annually forward from the start date', () => {
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const isoDate = oneYearAgo.toISOString().split('T')[0]

    const result = calcWithInterest(1000, 10, isoDate)
    // ~1 year at 10% simple compounding -> close to 1100, allow for day-count drift
    expect(result).toBeGreaterThan(1095)
    expect(result).toBeLessThan(1105)
  })

  it('grows with a higher rate over the same period', () => {
    const oneYearAgo = new Date()
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const isoDate = oneYearAgo.toISOString().split('T')[0]

    const low  = calcWithInterest(1000, 5, isoDate)
    const high = calcWithInterest(1000, 20, isoDate)
    expect(high).toBeGreaterThan(low)
  })
})
