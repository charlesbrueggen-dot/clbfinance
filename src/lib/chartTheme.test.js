import { describe, it, expect } from 'vitest'
import { pieColors, PIE_COLORS_LIGHT, PIE_COLORS_DARK, pieCellOpacity } from './chartTheme'

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
