import { describe, it, expect } from 'vitest'
import { fmtCurrency, fmtCompact } from './format'

describe('fmtCurrency', () => {
  it('formats a positive amount as USD', () => {
    expect(fmtCurrency(1234.5)).toBe('$1,234.50')
  })

  it('treats null/undefined/NaN-ish input as zero', () => {
    expect(fmtCurrency(null)).toBe('$0.00')
    expect(fmtCurrency(undefined)).toBe('$0.00')
    expect(fmtCurrency(0)).toBe('$0.00')
  })

  it('formats negative amounts', () => {
    expect(fmtCurrency(-42)).toBe('-$42.00')
  })
})

describe('fmtCompact', () => {
  it('keeps full precision under $10,000', () => {
    expect(fmtCompact(9999.99)).toBe('$9,999.99')
    expect(fmtCompact(0)).toBe('$0.00')
  })

  it('abbreviates the 10K-100K range with one decimal', () => {
    expect(fmtCompact(12400)).toBe('$12.4K')
    expect(fmtCompact(10000)).toBe('$10.0K')
  })

  it('abbreviates values at or above 100K with no decimal', () => {
    expect(fmtCompact(125000)).toBe('$125K')
    expect(fmtCompact(999999)).toBe('$1000K')
  })

  it('abbreviates values at or above 1M', () => {
    expect(fmtCompact(1250000)).toBe('$1.3M')
    expect(fmtCompact(2000000)).toBe('$2.0M')
  })

  it('preserves the sign for negative amounts', () => {
    expect(fmtCompact(-12400)).toBe('-$12.4K')
    expect(fmtCompact(-1250000)).toBe('-$1.3M')
  })
})
