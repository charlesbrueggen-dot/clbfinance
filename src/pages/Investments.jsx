import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const PIE_COLORS = ['#3b82f6','#f97316','#8b5cf6','#ef4444','#06b6d4','#84cc16','#ec4899','#14b8a6']
const TYPES = ['Stock', 'ETF', 'Crypto', 'Bond', 'Mutual Fund', 'Other']
const SECTORS = ['Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer', 'Real Estate', 'Utilities', 'Materials', 'Communication', 'Industrials', 'Other']

// Only stocks get auto-refresh and auto-detect
const isStock = type => type === 'Stock'

// Known ticker → company / sector map for instant offline lookup
const TICKER_HINTS = {
  AAPL: { name: 'Apple Inc.', sector: 'Technology' },
  MSFT: { name: 'Microsoft Corp.', sector: 'Technology' },
  GOOGL: { name: 'Alphabet Inc.', sector: 'Communication' },
  GOOG: { name: 'Alphabet Inc.', sector: 'Communication' },
  AMZN: { name: 'Amazon.com Inc.', sector: 'Consumer' },
  META: { name: 'Meta Platforms Inc.', sector: 'Communication' },
  TSLA: { name: 'Tesla Inc.', sector: 'Consumer' },
  NVDA: { name: 'NVIDIA Corp.', sector: 'Technology' },
  AMD: { name: 'Advanced Micro Devices', sector: 'Technology' },
  NFLX: { name: 'Netflix Inc.', sector: 'Communication' },
  INTC: { name: 'Intel Corp.', sector: 'Technology' },
  ORCL: { name: 'Oracle Corp.', sector: 'Technology' },
  CRM: { name: 'Salesforce Inc.', sector: 'Technology' },
  ADBE: { name: 'Adobe Inc.', sector: 'Technology' },
  PYPL: { name: 'PayPal Holdings', sector: 'Finance' },
  JPM: { name: 'JPMorgan Chase', sector: 'Finance' },
  BAC: { name: 'Bank of America', sector: 'Finance' },
  WFC: { name: 'Wells Fargo', sector: 'Finance' },
  GS: { name: 'Goldman Sachs', sector: 'Finance' },
  V: { name: 'Visa Inc.', sector: 'Finance' },
  MA: { name: 'Mastercard Inc.', sector: 'Finance' },
  JNJ: { name: 'Johnson & Johnson', sector: 'Healthcare' },
  PFE: { name: 'Pfizer Inc.', sector: 'Healthcare' },
  UNH: { name: 'UnitedHealth Group', sector: 'Healthcare' },
  ABBV: { name: 'AbbVie Inc.', sector: 'Healthcare' },
  XOM: { name: 'ExxonMobil Corp.', sector: 'Energy' },
  CVX: { name: 'Chevron Corp.', sector: 'Energy' },
  WMT: { name: 'Walmart Inc.', sector: 'Consumer' },
  TGT: { name: 'Target Corp.', sector: 'Consumer' },
  KO: { name: 'Coca-Cola Co.', sector: 'Consumer' },
  PEP: { name: 'PepsiCo Inc.', sector: 'Consumer' },
  DIS: { name: 'Walt Disney Co.', sector: 'Communication' },
  SPOT: { name: 'Spotify Technology', sector: 'Communication' },
  UBER: { name: 'Uber Technologies', sector: 'Industrials' },
  LYFT: { name: 'Lyft Inc.', sector: 'Industrials' },
  BA: { name: 'Boeing Co.', sector: 'Industrials' },
  CAT: { name: 'Caterpillar Inc.', sector: 'Industrials' },
  SPY: { name: 'S&P 500 ETF (SPDR)', sector: 'Other' },
  QQQ: { name: 'Invesco QQQ Trust', sector: 'Technology' },
  VTI: { name: 'Vanguard Total Stock ETF', sector: 'Other' },
  VOO: { name: 'Vanguard S&P 500 ETF', sector: 'Other' },
}

const EMPTY_FORM = { symbol: '', name: '', type: 'Stock', shares: '', avg_cost: '', current_price: '', portfolio_pct: '', sector: 'Technology' }

export default function Investments() {
  const { user } = useAuth()
  const [investments, setInvestments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const [lookupStatus, setLookupStatus] = useState('') // 'loading' | 'found' | 'not_found' | ''

  const load = async () => {
    const { data } = await supabase.from('investments').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setInvestments(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [user.id])

  const openAdd = () => { setEditItem(null); setForm(EMPTY_FORM); setLookupStatus(''); setShowModal(true) }
  const openEdit = item => {
    setEditItem(item)
    setForm({ symbol: item.symbol, name: item.name || '', type: item.type, shares: item.shares, avg_cost: item.avg_cost, current_price: item.current_price || '', portfolio_pct: item.portfolio_pct || '', sector: item.sector || 'Technology' })
    setLookupStatus('')
    setShowModal(true)
  }

  // Auto-detect stock info when symbol changes (only for stocks)
  const lookupStock = useCallback(async (symbol, type) => {
    if (!isStock(type) || symbol.length < 1) { setLookupStatus(''); return }
    const upper = symbol.toUpperCase().trim()

    // 1. Instant local lookup
    if (TICKER_HINTS[upper]) {
      const hint = TICKER_HINTS[upper]
      setForm(f => ({ ...f, name: hint.name, sector: hint.sector }))
      setLookupStatus('found')
      return
    }

    // 2. API lookup via Yahoo Finance (via proxy)
    setLookupStatus('loading')
    try {
      const res = await fetch(`/api/stock-price?symbol=${upper}`)
      const data = await res.json()
      const meta = data?.chart?.result?.[0]?.meta
      if (meta) {
        const price = meta.regularMarketPrice
        const longName = meta.longName || meta.shortName || ''
        setForm(f => ({
          ...f,
          name: longName || f.name,
          current_price: price ? String(price) : f.current_price,
        }))
        setLookupStatus(longName ? 'found' : 'not_found')
      } else {
        setLookupStatus('not_found')
      }
    } catch {
      setLookupStatus('not_found')
    }
  }, [])

  // Debounce symbol lookup
  useEffect(() => {
    if (!showModal) return
    const timer = setTimeout(() => {
      if (form.symbol.length >= 1) lookupStock(form.symbol, form.type)
    }, 600)
    return () => clearTimeout(timer)
  }, [form.symbol, form.type, showModal, lookupStock])

  const handleSave = async e => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      symbol: form.symbol.toUpperCase().trim(),
      name: form.name.trim(),
      type: form.type,
      shares: parseFloat(form.shares),
      avg_cost: parseFloat(form.avg_cost),
      current_price: parseFloat(form.current_price) || parseFloat(form.avg_cost),
      portfolio_pct: parseFloat(form.portfolio_pct) || 0,
      sector: form.sector,
      user_id: user.id
    }
    if (editItem) await supabase.from('investments').update(payload).eq('id', editItem.id).eq('user_id', user.id)
    else await supabase.from('investments').insert(payload)
    setSaving(false); setShowModal(false); load()
  }

  const handleDelete = async id => {
    await supabase.from('investments').delete().eq('id', id).eq('user_id', user.id)
    load()
  }

  // Only refresh STOCKS
  const refreshPrices = async () => {
    setRefreshing(true)
    setRefreshError('')
    const stocks = investments.filter(i => isStock(i.type))
    let updatedCount = 0

    for (const inv of stocks) {
      try {
        const res = await fetch(`/api/stock-price?symbol=${inv.symbol}`)
        const data = await res.json()
        const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
        if (price && price > 0) {
          await supabase.from('investments').update({ current_price: price }).eq('id', inv.id).eq('user_id', user.id)
          updatedCount++
        }
      } catch { /* skip */ }
    }

    setRefreshing(false)
    if (stocks.length === 0) {
      setRefreshError('No stocks to refresh. Only Stock-type holdings update automatically.')
    } else if (updatedCount === 0) {
      setRefreshError('Could not fetch stock prices. Check your ticker symbols (e.g. AAPL, TSLA).')
    }
    load()
  }

  // Stats
  const totalValue = investments.reduce((s, i) => s + (i.shares * (i.current_price || i.avg_cost)), 0)
  const totalCost = investments.reduce((s, i) => s + (i.shares * i.avg_cost), 0)
  const totalGL = totalValue - totalCost
  const totalReturn = totalCost > 0 ? (totalGL / totalCost * 100).toFixed(2) : '0.00'

  // Sector pie
  const sectorMap = {}
  investments.forEach(i => { sectorMap[i.sector || 'Other'] = (sectorMap[i.sector || 'Other'] || 0) + (i.shares * (i.current_price || i.avg_cost)) })
  const sectorData = Object.entries(sectorMap).map(([name, value]) => ({ name, value }))

  // Type breakdown
  const typeMap = {}
  investments.forEach(i => { typeMap[i.type] = (typeMap[i.type] || 0) + (i.shares * (i.current_price || i.avg_cost)) })
  const typeData = Object.entries(typeMap).map(([name, value]) => ({ name, value }))

  const stockCount = investments.filter(i => isStock(i.type)).length
  const nonStockCount = investments.length - stockCount

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }}></div>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Investments</h1>
        <p className="text-muted text-sm mt-1">Track your investment portfolio performance</p>
      </div>

      <div className="flex gap-3 mb-1 flex-wrap">
        <button onClick={refreshPrices} disabled={refreshing} className="btn-secondary">
          ↻ {refreshing ? 'Refreshing stocks...' : `Refresh Stock Prices (${stockCount})`}
        </button>
        <button onClick={openAdd} className="btn-primary">+ Add Investment</button>
      </div>
      {nonStockCount > 0 && (
        <p className="text-xs text-muted mb-2 mt-1">
          ℹ {nonStockCount} non-stock holding{nonStockCount !== 1 ? 's' : ''} (crypto, ETF, bond, etc.) are not auto-refreshed — update prices manually.
        </p>
      )}
      {refreshError && <p className="text-red-500 text-xs mb-3">{refreshError}</p>}
      {!refreshError && <div className="mb-4" />}

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl p-4" style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)' }}>
          <p className="text-muted text-xs mb-1">Portfolio Value</p>
          <p className="text-xl font-bold">{fmt(totalValue)}</p>
          <p className="text-muted text-xs mt-0.5">{investments.length} holdings</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)' }}>
          <p className="text-muted text-xs mb-1">Total Gain/Loss</p>
          <p className="text-xl font-bold" style={{ color: totalGL >= 0 ? '#10b981' : '#ef4444' }}>{totalGL >= 0 ? '+' : ''}{fmt(totalGL)}</p>
          <p className="text-muted text-xs mt-0.5">vs cost basis</p>
        </div>
        <div className="card p-4">
          <p className="text-muted text-xs mb-1">Total Return</p>
          <p className={`text-xl font-bold ${totalGL >= 0 ? 'text-primary' : 'text-red-500'}`}>{totalReturn}%</p>
          <p className="text-muted text-xs mt-0.5">all time</p>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="card p-5 mb-6">
        <div className="flex items-center gap-2 mb-4 font-semibold text-primary text-sm">
          <span>◔</span><span>Portfolio Holdings</span>
        </div>
        {investments.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📊</div>
            <p className="font-semibold text-primary">No Investments Yet</p>
            <p className="text-muted text-sm mt-1">Add your investments to start tracking portfolio performance.</p>
            <button onClick={openAdd} className="btn-primary mt-4">+ Add Your First Investment</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted border-b" style={{ borderColor: 'var(--card-border)' }}>
                  {['Symbol', 'Type', 'Shares', 'Avg. Cost', 'Current', 'Value', 'G/L', 'Actions'].map(h => (
                    <th key={h} className="text-left py-2 px-2 font-medium text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {investments.map(item => {
                  const val = item.shares * (item.current_price || item.avg_cost)
                  const cost = item.shares * item.avg_cost
                  const gl = val - cost
                  const glPct = cost > 0 ? (gl / cost * 100).toFixed(1) : '0.0'
                  return (
                    <tr key={item.id} className="border-b last:border-0" style={{ borderColor: 'var(--card-border)' }}>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-primary">{item.symbol}</span>
                          {isStock(item.type) && <span className="text-xs px-1 rounded" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>auto</span>}
                        </div>
                        <span className="text-xs text-muted">{item.name}</span>
                      </td>
                      <td className="py-3 px-2">
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--input-bg)', color: 'var(--text-muted)' }}>{item.type}</span>
                      </td>
                      <td className="py-3 px-2 text-primary">{item.shares}</td>
                      <td className="py-3 px-2 text-primary">${item.avg_cost?.toFixed(2)}</td>
                      <td className="py-3 px-2 text-primary">
                        ${(item.current_price || item.avg_cost)?.toFixed(2)}
                        {!isStock(item.type) && <span className="block text-xs text-muted">manual</span>}
                      </td>
                      <td className="py-3 px-2 font-medium text-primary">{fmt(val)}</td>
                      <td className="py-3 px-2">
                        <span className={`font-medium ${gl >= 0 ? 'text-primary' : 'text-red-500'}`}>{gl >= 0 ? '+' : ''}{fmt(gl)}</span>
                        <br /><span className={`text-xs ${gl >= 0 ? 'text-primary' : 'text-red-500'}`}>{glPct}%</span>
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(item)} className="text-muted hover:text-primary text-sm">✎</button>
                          <button onClick={() => handleDelete(item.id)} className="text-muted hover:text-red-500 text-sm">🗑</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 mb-6" style={{ gridTemplateColumns: sectorData.length > 0 && typeData.length > 0 ? '1fr 1fr' : '1fr' }}>
        {/* Sector Allocation */}
        {sectorData.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4 font-semibold text-primary text-sm"><span>◑</span><span>Sector Allocation</span></div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={sectorData} dataKey="value" cx="50%" cy="50%" outerRadius={75}
                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} fontSize={10}>
                  {sectorData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, color: 'var(--text-primary)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1">
              {sectorData.map((s, i) => (
                <div key={s.name} className="flex justify-between text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}></span>
                    <span className="text-muted">{s.name}</span>
                  </span>
                  <span className="font-medium text-primary">{fmt(s.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Type Allocation */}
        {typeData.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4 font-semibold text-primary text-sm"><span>◔</span><span>By Type</span></div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={typeData} dataKey="value" cx="50%" cy="50%" outerRadius={75}
                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`} fontSize={10}>
                  {typeData.map((_, i) => <Cell key={i} fill={PIE_COLORS[(i + 4) % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, color: 'var(--text-primary)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1">
              {typeData.map((t, i) => (
                <div key={t.name} className="flex justify-between text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ background: PIE_COLORS[(i + 4) % PIE_COLORS.length] }}></span>
                    <span className="text-muted">{t.name}</span>
                  </span>
                  <span className="font-medium text-primary">{fmt(t.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <span>↗</span><span>{editItem ? 'Edit Investment' : 'Add Investment'}</span>
              </div>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-primary text-xl">✕</button>
            </div>

            <form onSubmit={handleSave}>
              {/* Type first — controls what fields appear */}
              <div className="mb-4">
                <label className="label">Investment Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {TYPES.map(t => (
                    <button
                      key={t} type="button"
                      onClick={() => { setForm(f => ({ ...f, type: t, name: '', sector: 'Technology' })); setLookupStatus('') }}
                      className="py-2 rounded-xl text-xs font-semibold transition-colors"
                      style={{
                        border: form.type === t ? '1px solid rgba(16,185,129,0.6)' : '1px solid var(--card-border)',
                        background: form.type === t ? 'rgba(16,185,129,0.15)' : 'transparent',
                        color: form.type === t ? '#10b981' : 'var(--text-muted)',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Symbol + auto-detect badge */}
              <div className="mb-4">
                <label className="label">
                  Ticker Symbol
                  {isStock(form.type) && (
                    <span className="ml-2 text-xs font-normal" style={{ color: '#10b981' }}>
                      · auto-detect enabled
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    className="input-field pr-20"
                    placeholder={isStock(form.type) ? 'AAPL → auto-fills name & sector' : 'e.g. BTC, VTSAX'}
                    value={form.symbol}
                    onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                    required
                  />
                  {isStock(form.type) && lookupStatus && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium" style={{
                      color: lookupStatus === 'found' ? '#10b981' : lookupStatus === 'loading' ? '#f0a500' : '#ef4444'
                    }}>
                      {lookupStatus === 'loading' ? '⟳ looking…' : lookupStatus === 'found' ? '✓ found' : '? not found'}
                    </span>
                  )}
                </div>
              </div>

              {/* Company Name — always shown, auto-filled for stocks */}
              <div className="mb-4">
                <label className="label">
                  Company / Fund Name
                  {isStock(form.type) && lookupStatus === 'found' && (
                    <span className="ml-2 text-xs font-normal" style={{ color: '#10b981' }}>· auto-filled</span>
                  )}
                </label>
                <input
                  className="input-field"
                  placeholder={isStock(form.type) ? 'Auto-filled from ticker…' : 'e.g. Bitcoin, Vanguard 500'}
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              {/* Shares + Avg Cost — always */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="label">Shares / Units</label>
                  <input className="input-field" type="number" step="0.0001" min="0" placeholder="10" value={form.shares}
                    onChange={e => setForm(f => ({ ...f, shares: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Avg Cost / Unit</label>
                  <input className="input-field" type="number" step="0.01" min="0" placeholder="150.00" value={form.avg_cost}
                    onChange={e => setForm(f => ({ ...f, avg_cost: e.target.value }))} required />
                </div>
              </div>

              {/* Current Price — shown for all types (stocks auto-fill, others manual) */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="label">
                    Current Price
                    {!isStock(form.type) && <span className="ml-1 text-xs font-normal text-muted">(manual)</span>}
                    {isStock(form.type) && <span className="ml-1 text-xs font-normal" style={{ color: '#10b981' }}>(auto-refreshed)</span>}
                  </label>
                  <input className="input-field" type="number" step="0.01" min="0"
                    placeholder={isStock(form.type) ? 'Fetched on refresh' : 'Enter current price'}
                    value={form.current_price}
                    onChange={e => setForm(f => ({ ...f, current_price: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Portfolio %</label>
                  <input className="input-field" type="number" step="0.1" min="0" max="100" placeholder="15.5"
                    value={form.portfolio_pct} onChange={e => setForm(f => ({ ...f, portfolio_pct: e.target.value }))} />
                </div>
              </div>

              {/* Sector — shown for stocks (auto-filled) and ETFs; hidden for crypto/bond/mutual fund */}
              {(isStock(form.type) || form.type === 'ETF') && (
                <div className="mb-6">
                  <label className="label">
                    Sector
                    {isStock(form.type) && lookupStatus === 'found' && (
                      <span className="ml-2 text-xs font-normal" style={{ color: '#10b981' }}>· auto-filled</span>
                    )}
                  </label>
                  <select className="input-field" value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}>
                    {SECTORS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              )}

              {/* Info banner for non-stock types */}
              {!isStock(form.type) && (
                <div className="mb-4 p-3 rounded-xl text-xs" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}>
                  ℹ {form.type} prices are <strong>not auto-refreshed</strong>. Update the current price manually as needed.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary justify-center">
                  {saving ? 'Saving…' : editItem ? 'Save Changes' : 'Add Investment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
