import { describe, it, expect } from 'vitest'
import { groupSmallSlices, categoricalColor, CATEGORICAL_COLORS, CATEGORICAL_OTHER_COLOR, pieColors, PIE_COLORS_LIGHT, PIE_COLORS_DARK } from './chartTheme'

describe('groupSmallSlices', () => {
  it('leaves data untouched when within the palette size', () => {
    const data = [{ name: 'A', value: 10 }, { name: 'B', value: 5 }]
    expect(groupSmallSlices(data, 9)).toEqual(data)
  })

  it('collapses the smallest slices into a single "Other" once over the limit', () => {
    const data = [
      { name: 'A', value: 50 }, { name: 'B', value: 40 }, { name: 'C', value: 30 },
      { name: 'D', value: 20 }, { name: 'E', value: 10 }, { name: 'F', value: 5 },
    ]
    const result = groupSmallSlices(data, 4)
    expect(result).toHaveLength(4)
    // Top 3 by value survive individually, the rest merge into "Other"
    expect(result.slice(0, 3).map(d => d.name)).toEqual(['A', 'B', 'C'])
    const other = result.find(d => d.name === 'Other')
    expect(other).toBeTruthy()
    expect(other.value).toBe(20 + 10 + 5) // D + E + F
  })

  it('never produces more slices than the requested max', () => {
    const data = Array.from({ length: 20 }, (_, i) => ({ name: `Cat ${i}`, value: 20 - i }))
    const result = groupSmallSlices(data, 9)
    expect(result.length).toBeLessThanOrEqual(9)
  })
})

describe('categoricalColor', () => {
  it('cycles through the distinct-hue palette for normal slices', () => {
    expect(categoricalColor('Technology', 0)).toBe(CATEGORICAL_COLORS[0])
    expect(categoricalColor('Finance', 1)).toBe(CATEGORICAL_COLORS[1])
  })

  it('always returns the reserved gray for a slice named "Other", regardless of index', () => {
    expect(categoricalColor('Other', 0)).toBe(CATEGORICAL_OTHER_COLOR)
    expect(categoricalColor('Other', 5)).toBe(CATEGORICAL_OTHER_COLOR)
  })

  it('produces distinct colors for the first N real categories', () => {
    const colors = CATEGORICAL_COLORS.map((_, i) => categoricalColor(`Cat ${i}`, i))
    expect(new Set(colors).size).toBe(colors.length)
  })
})

describe('pieColors', () => {
  it('picks the theme-appropriate palette', () => {
    expect(pieColors(false)).toBe(PIE_COLORS_LIGHT)
    expect(pieColors(true)).toBe(PIE_COLORS_DARK)
  })
})
