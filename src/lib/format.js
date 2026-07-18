export const fmtCurrency = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)

// Abbreviates large amounts (e.g. 12.4K, 125K, 1.2M) so they don't overflow fixed-width containers.
// Anything under $10,000 keeps full precision.
export const fmtCompact = n => {
  const v    = n || 0
  const abs  = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 100_000)   return `${sign}$${Math.round(abs / 1000)}K`
  if (abs >= 10_000)    return `${sign}$${(abs / 1000).toFixed(1)}K`
  return fmtCurrency(v)
}
