import { Sector } from 'recharts'

// Shared pie chart palette/styling used across Income, Analytics, Investments & Dashboard.

// Theme-tinted palette (blue shades in light mode, green shades in dark mode).
export const PIE_COLORS_LIGHT = ['#3b82f6','#60a5fa','#93c5fd','#bfdbfe','#2563eb','#1d4ed8','#1e40af','#dbeafe','#93c5fd','#60a5fa']
export const PIE_COLORS_DARK  = ['#10b981','#34d399','#6ee7b7','#a7f3d0','#059669','#047857','#065f46','#d1fae5','#6ee7b7','#34d399']

export const pieColors = dark => (dark ? PIE_COLORS_DARK : PIE_COLORS_LIGHT)

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

// Renders the hovered/tapped slice slightly larger — the visual "this one" indicator used by
// every pie chart in the app. Pair with a Cell fillOpacity of pieCellOpacity(activeIndex, i) so
// the other slices dim while one is active, and with onMouseEnter/onMouseLeave/onClick handlers
// that track an `activeIndex` state (hover on desktop, tap-to-toggle on touch devices).
//
// In light mode the palette leans on pale blues, which can visually blend into the card
// background right at the slice's own outer edge — a solid black outline keeps the active
// slice readable there. Dark mode's fills already read clearly against the near-black card,
// so it keeps the same subtle card-matching border the inactive slices use.
// Usage: activeShape={renderActivePieSector(dark)}
export const renderActivePieSector = (dark) => (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
  return (
    <Sector
      cx={cx} cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 8}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      stroke={dark ? 'var(--card-bg-solid)' : '#000'}
      strokeWidth={dark ? 1.5 : 2}
    />
  )
}

// Full opacity for the active slice (or all slices when none is active), dimmed otherwise.
export const pieCellOpacity = (activeIndex, i) =>
  activeIndex == null || activeIndex === i ? 1 : 0.45
