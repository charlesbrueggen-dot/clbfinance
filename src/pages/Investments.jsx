import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const PIE_COLORS = ['#3b82f6','#f97316','#8b5cf6','#ef4444','#06b6d4','#84cc16','#ec4899','#14b8a6']
const TYPES = ['Stock', 'ETF', 'Crypto', 'Bond', 'Mutual Fund', 'Other']
const SECTORS = ['Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer', 'Real Estate', 'Utilities', 'Materials', 'Other']

export default function Investments() {
  const { user } = useAuth()
  const [investments, setInvestments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ symbol: '', name: '', type: 'Stock', shares: '', avg_cost: '', current_price: '', portfolio_pct: '', sector: 'Technology' })
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState('')

  const load = async () => {
    const { data } = await supabase.from('investments').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setInvestments(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [user.id])

  const openAdd = () => { setEditItem(null); setForm({ symbol: '', name: '', type: 'Stock', shares: '', avg_cost: '', current_price: '', portfolio_pct: '', sector: 'Technology' }); setShowModal(true) }
  const openEdit = item => { setEditItem(item); setForm({ symbol: item.symbol, name: item.name || '', type: item.type, shares: item.shares, avg_cost: item.avg_cost, current_price: item.current_price || '', portfolio_pct: item.portfolio_pct || '', sector: item.sector || 'Technology' }); setShowModal(true) }

  const handleSave = async e => {
    e.preventDefault()
    setSaving(true)
    const payload = { symbol: form.symbol.toUpperCase().trim(), name: form.name.trim(), type: form.type, shares: parseFloat(form.shares), avg_cost: parseFloat(form.avg_cost), current_price: parseFloat(form.current_price) || parseFloat(form.avg_cost), portfolio_pct: parseFloat(form.portfolio_pct) || 0, sector: form.sector, user_id: user.id }
    if (editItem) await supabase.from('investments').update(payload).eq('id', editItem.id).eq('user_id', user.id)
    else await supabase.from('investments').insert(payload)
    setSaving(false); setShowModal(false); load()
  }

  const handleDelete = async id => {
    if (!confirm('Delete this investment?')) return
    await supabase.from('investments').delete().eq('id', id).eq('user_id', user.id)
    load()
  }

  const refreshPrices = async () => {
    setRefreshing(true)
    setRefreshError('')
    let updatedCount = 0

    for (const inv of investments) {
      try {
        // Use allorigins CORS proxy to bypass browser restrictions
        const res = await fetch(`/api/stock-price?symbol=${inv.symbol}`)
        const data = await res.json()
        const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
        if (price && price > 0) {
          await supabase.from('investments').update({ current_price: price }).eq('id', inv.id).eq('user_id', user.id)
          updatedCount++
        }
      } catch {
        // Skip symbols that fail (e.g. crypto tickers may differ)
      }
    }

    setRefreshing(false)
    if (updatedCount === 0 && investments.length > 0) {
      setRefreshError('Could not fetch prices. Check your ticker symbols are valid (e.g. AAPL, TSLA, BTC-USD).')
    }
    load()
  }

  const totalValue = investments.reduce((s, i) => s + (i.shares * (i.current_price || i.avg_cost)), 0)
  const totalCost = investments.reduce((s, i) => s + (i.shares * i.avg_cost), 0)
  const totalGL = totalValue - totalCost
  const totalReturn = totalCost > 0 ? (totalGL / totalCost * 100).toFixed(2) : '0.00'

  const sectorMap = {}
  investments.forEach(i => { sectorMap[i.sector || 'Other'] = (sectorMap[i.sector || 'Other'] || 0) + (i.shares * (i.current_price || i.avg_cost)) })
  const sectorData = Object.entries(sectorMap).map(([name, value]) => ({ name, value }))

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Investments</h1>
        <p className="text-muted text-sm mt-1">Track your investment portfolio performance</p>
      </div>

      <div className="flex gap-3 mb-2">
        <button onClick={refreshPrices} disabled={refreshing} className="btn-secondary">↻ {refreshing ? 'Refreshing...' : 'Refresh Prices'}</button>
        <button onClick={openAdd} className="btn-primary">+ Add Investment</button>
      </div>
      {refreshError && <p className="text-red-500 text-sm mb-4">{refreshError}</p>}
      {!refreshError && <div className="mb-4" />}

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl p-4 text-white" style={{ background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)' }}>
          <p className="text-white/80 text-xs mb-1">Portfolio Value</p>
          <p className="text-xl font-bold">{fmt(totalValue)}</p>
        </div>
        <div className="rounded-xl p-4 text-white" style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
          <p className="text-white/80 text-xs mb-1">Total Gain/Loss</p>
          <p className="text-xl font-bold">{fmt(totalGL)}</p>
        </div>
        <div className="card p-4">
          <p className="text-muted text-xs mb-1">Total Return</p>
          <p className={`text-xl font-bold ${totalGL >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{totalReturn}%</p>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="card p-5 mb-6">
        <div className="flex items-center gap-2 mb-4 accent-text font-semibold"><span>◔</span><span>Portfolio Holdings</span></div>
        {investments.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">📊</div>
            <p className="font-semibold text-primary">No Investments Yet</p>
            <p className="text-muted text-sm mt-1">Add your investments to start tracking your portfolio performance.</p>
            <button onClick={openAdd} className="btn-primary mt-4">+ Add Your First Investment</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted border-b" style={{ borderColor: 'var(--card-border)' }}>
                  {['Symbol', 'Shares', 'Avg. Price', 'Current Price', 'Market Value', 'Gain/Loss', 'Actions'].map(h => (
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
                      <td className="py-3 px-2"><span className="font-bold text-primary">{item.symbol}</span><br /><span className="text-xs text-muted">{item.name}</span></td>
                      <td className="py-3 px-2 text-primary">{item.shares}</td>
                      <td className="py-3 px-2 text-primary">${item.avg_cost?.toFixed(2)}</td>
                      <td className="py-3 px-2 text-primary">${(item.current_price || item.avg_cost)?.toFixed(2)}</td>
                      <td className="py-3 px-2 font-medium text-primary">{fmt(val)}</td>
                      <td className="py-3 px-2">
                        <span className={`font-medium ${gl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{gl >= 0 ? '+' : ''}{fmt(gl)}</span>
                        <br /><span className={`text-xs ${gl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{glPct}%</span>
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

      {/* Sector Allocation */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4 accent-text font-semibold"><span>◑</span><span>Sector Allocation</span></div>
        {sectorData.length === 0 ? (
          <p className="text-center text-muted text-sm py-6">No sector data available.</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={sectorData} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={11}>
                {sectorData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => fmt(v)} contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, color: 'var(--text-primary)' }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 accent-text font-semibold"><span>↗</span><span>{editItem ? 'Edit Investment' : 'Add Investment'}</span></div>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-primary text-xl">✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="label">Symbol</label><input className="input-field" placeholder="AAPL" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))} required /></div>
                <div><label className="label">Type</label><select className="input-field" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>{TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              </div>
              <div className="mb-4"><label className="label">Company/Fund Name</label><input className="input-field" placeholder="Apple Inc." value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="label">Shares</label><input className="input-field" type="number" step="0.001" min="0" placeholder="10" value={form.shares} onChange={e => setForm(f => ({ ...f, shares: e.target.value }))} required /></div>
                <div><label className="label">Avg Cost</label><input className="input-field" type="number" step="0.01" min="0" placeholder="150.00" value={form.avg_cost} onChange={e => setForm(f => ({ ...f, avg_cost: e.target.value }))} required /></div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="label">Current Price</label><input className="input-field" type="number" step="0.01" min="0" placeholder="165.00" value={form.current_price} onChange={e => setForm(f => ({ ...f, current_price: e.target.value }))} /></div>
                <div><label className="label">Portfolio %</label><input className="input-field" type="number" step="0.1" min="0" max="100" placeholder="15.5" value={form.portfolio_pct} onChange={e => setForm(f => ({ ...f, portfolio_pct: e.target.value }))} /></div>
              </div>
              <div className="mb-6"><label className="label">Sector</label><select className="input-field" value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}>{SECTORS.map(s => <option key={s}>{s}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary justify-center">{saving ? 'Saving...' : editItem ? 'Save Changes' : 'Add Investment'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
