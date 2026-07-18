import { describe, it, expect } from 'vitest'
import { pieColors, PIE_COLORS_LIGHT, PIE_COLORS_DARK, pieCellOpacity, pieStrokeProps, sortByValueDesc } from './chartTheme'

describe('pieColors', () => {
  it('picks the theme-appropriate palette', () => {
    expect(pieColors(false)).toBe(PIE_COLORS_LIGHT)
    expect(pieColors(true)).toBe(PIE_COLORS_DARK)
  })
})

describe('pieCellOpacity', () => {
  it('keeps every slice at full opacity when nothing is active', () => {
    expect(pieCellOpacity(null, 0)).toBe(1)
    expect(pieCellOpacity(undefined, 3)).toBe(1)
  })

  it('keeps the active slice at full opacity', () => {
    expect(pieCellOpacity(2, 2)).toBe(1)
  })

  it('dims every slice that is not the active one', () => {
    expect(pieCellOpacity(2, 0)).toBeLessThan(1)
    expect(pieCellOpacity(2, 5)).toBeLessThan(1)
  })
})

describe('pieStrokeProps', () => {
  it('uses a black divider in light mode so it reads against the all-blue palette', () => {
    expect(pieStrokeProps(false).stroke).toBe('#000')
  })

  it('uses the card-matching divider in dark mode', () => {
    expect(pieStrokeProps(true).stroke).toBe('var(--card-bg-solid)')
  })

  it('uses the same stroke width regardless of theme (only color differs)', () => {
    expect(pieStrokeProps(false).strokeWidth).toBe(pieStrokeProps(true).strokeWidth)
  })
})

describe('sortByValueDesc', () => {
  it('orders entries from largest to smallest value', () => {
    const data = [{ name: 'A', value: 10 }, { name: 'B', value: 50 }, { name: 'C', value: 30 }]
    expect(sortByValueDesc(data).map(d => d.name)).toEqual(['B', 'C', 'A'])
  })

  it('does not mutate the original array', () => {
    const data = [{ name: 'A', value: 1 }, { name: 'B', value: 2 }]
    const original = [...data]
    sortByValueDesc(data)
    expect(data).toEqual(original)
  })
})
