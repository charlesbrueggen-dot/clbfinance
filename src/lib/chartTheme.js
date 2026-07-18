// Shared pie chart palette/styling — matches the look used on Income (and Dashboard).
export const PIE_COLORS_LIGHT = ['#3b82f6','#60a5fa','#93c5fd','#bfdbfe','#2563eb','#1d4ed8','#1e40af','#dbeafe','#93c5fd','#60a5fa']
export const PIE_COLORS_DARK  = ['#10b981','#34d399','#6ee7b7','#a7f3d0','#059669','#047857','#065f46','#d1fae5','#6ee7b7','#34d399']

export const pieColors = dark => (dark ? PIE_COLORS_DARK : PIE_COLORS_LIGHT)

export const pieStrokeProps = dark => ({
  stroke: dark ? 'transparent' : '#000',
  strokeWidth: dark ? 0 : 1.5,
})

export const pieTooltipStyle = dark => ({
  background: dark ? '#111' : '#fff',
  border: '1px solid var(--card-border)',
  borderRadius: 10,
  color: '#10b981',
  fontSize: 13,
})
export const pieTooltipItemStyle  = { color: '#10b981' }
export const pieTooltipLabelStyle = { color: '#10b981' }
