// Shared pie chart palette/styling used across Income, Expenses/Analytics, Investments & Dashboard.

// Theme-tinted palette (blue shades in light mode, green shades in dark mode) — used where a
// single-hue "brand" look fits and slice count stays low (e.g. Income sources).
export const PIE_COLORS_LIGHT = ['#3b82f6','#60a5fa','#93c5fd','#bfdbfe','#2563eb','#1d4ed8','#1e40af','#dbeafe','#93c5fd','#60a5fa']
export const PIE_COLORS_DARK  = ['#10b981','#34d399','#6ee7b7','#a7f3d0','#059669','#047857','#065f46','#d1fae5','#6ee7b7','#34d399']

export const pieColors = dark => (dark ? PIE_COLORS_DARK : PIE_COLORS_LIGHT)

// Distinct-hue categorical palette — used wherever a chart may have several unrelated categories
// that need to stay visually distinguishable from one another (e.g. investment sectors/types).
// Same hues in both themes since they're already vivid enough to read on both a near-black and a
// light-glass background.
export const CATEGORICAL_COLORS = ['#3b82f6','#f97316','#8b5cf6','#ef4444','#06b6d4','#84cc16','#ec4899','#14b8a6','#f59e0b']
export const CATEGORICAL_OTHER_COLOR = '#64748b'

// Picks a color for a categorical slice by name/index, reserving a fixed neutral color for any
// slice literally named "Other" (see groupSmallSlices below).
export const categoricalColor = (name, i) =>
  name === 'Other' ? CATEGORICAL_OTHER_COLOR : CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]

// Collapses the smallest slices of a { name, value } dataset into a single "Other" slice once
// there are more categories than the palette has distinct colors for, so no two slices ever end
// up sharing (or nearly sharing) a color.
export const groupSmallSlices = (data, maxSlices = CATEGORICAL_COLORS.length) => {
  if (data.length <= maxSlices) return data
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const top     = sorted.slice(0, maxSlices - 1)
  const rest    = sorted.slice(maxSlices - 1)
  const other   = rest.reduce((s, d) => s + d.value, 0)
  return [...top, { name: 'Other', value: other }]
}

// Slice divider — matches the surrounding card surface so slices always get a clean, visible gap
// between them, in both themes (fixes light mode having black dividers while dark mode had none).
export const PIE_STROKE_PROPS = { stroke: 'var(--card-bg-solid)', strokeWidth: 1.5 }

export const pieTooltipStyle = dark => ({
  background: dark ? '#111' : '#fff',
  border: '1px solid var(--card-border)',
  borderRadius: 10,
  color: '#10b981',
  fontSize: 13,
})
export const pieTooltipItemStyle  = { color: '#10b981' }
export const pieTooltipLabelStyle = { color: '#10b981' }
