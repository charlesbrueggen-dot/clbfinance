import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import {
  PieChart as PieChartIcon, BarChart3, TrendingUp, Sparkle, Zap, RefreshCw, Check,
  AlertTriangle, Landmark, Info, Pencil, Trash2, X, ArrowUpRight,
} from 'lucide-react'
import { fmtCompact, fmtCurrency as fmt } from '../lib/format'
import { categoricalColor, groupSmallSlices, PIE_STROKE_PROPS, pieTooltipStyle, pieTooltipItemStyle, pieTooltipLabelStyle } from '../lib/chartTheme'
import { useDarkMode } from '../hooks/useDarkMode'

// Stocks AND ETFs get auto-refresh (both trade on exchanges with real-time tickers)
const isAutoRefresh = type => type === 'Stock' || type === 'ETF'
// Stocks AND ETFs support ticker auto-detect
const isTickerBased = type => type === 'Stock' || type === 'ETF'

const TYPES = ['Stock', 'ETF', 'Crypto', 'Bond', 'Mutual Fund']
const SECTORS = ['Technology','Healthcare','Finance','Energy','Consumer','Real Estate','Utilities','Materials','Communication','Industrials','Other']


function ProGate({ feature, Icon, description, userId }) {
  const [upgrading, setUpgrading] = useState(false)
  const handleUpgrade = async () => {
    setUpgrading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch { setUpgrading(false) }
  }
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-6">
      <div className="mb-4 text-primary"><Icon size={48} /></div>
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3"
        style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
        <Sparkle size={12} /> Pro Feature
      </div>
      <h2 className="text-xl font-black text-primary mb-2">{feature}</h2>
      <p className="text-muted text-sm mb-6 max-w-xs">{description}</p>
      <button onClick={handleUpgrade} disabled={upgrading} className="btn-primary px-8">
        {upgrading ? 'Redirecting…' : <><Zap size={16} /> Upgrade to Pro — $4.99/mo</>}
      </button>
    </div>
  )
}

// ─── Offline ticker hints (Stocks + ETFs) ─────────────────────────────────────
const TICKER_HINTS = {
  // Stocks
  AAPL:  { name: 'Apple Inc.',             sector: 'Technology'    },
  MSFT:  { name: 'Microsoft Corp.',        sector: 'Technology'    },
  GOOGL: { name: 'Alphabet Inc.',          sector: 'Communication' },
  GOOG:  { name: 'Alphabet Inc.',          sector: 'Communication' },
  AMZN:  { name: 'Amazon.com Inc.',        sector: 'Consumer'      },
  META:  { name: 'Meta Platforms Inc.',    sector: 'Communication' },
  TSLA:  { name: 'Tesla Inc.',             sector: 'Consumer'      },
  NVDA:  { name: 'NVIDIA Corp.',           sector: 'Technology'    },
  AMD:   { name: 'Advanced Micro Devices', sector: 'Technology'    },
  NFLX:  { name: 'Netflix Inc.',           sector: 'Communication' },
  INTC:  { name: 'Intel Corp.',            sector: 'Technology'    },
  ORCL:  { name: 'Oracle Corp.',           sector: 'Technology'    },
  CRM:   { name: 'Salesforce Inc.',        sector: 'Technology'    },
  ADBE:  { name: 'Adobe Inc.',             sector: 'Technology'    },
  PLTR:  { name: 'Palantir Technologies',  sector: 'Technology'    },
  COIN:  { name: 'Coinbase Global Inc.',   sector: 'Finance'       },
  PYPL:  { name: 'PayPal Holdings',        sector: 'Finance'       },
  JPM:   { name: 'JPMorgan Chase',         sector: 'Finance'       },
  BAC:   { name: 'Bank of America',        sector: 'Finance'       },
  WFC:   { name: 'Wells Fargo',            sector: 'Finance'       },
  GS:    { name: 'Goldman Sachs',          sector: 'Finance'       },
  V:     { name: 'Visa Inc.',              sector: 'Finance'       },
  MA:    { name: 'Mastercard Inc.',        sector: 'Finance'       },
  JNJ:   { name: 'Johnson & Johnson',      sector: 'Healthcare'    },
  PFE:   { name: 'Pfizer Inc.',            sector: 'Healthcare'    },
  UNH:   { name: 'UnitedHealth Group',     sector: 'Healthcare'    },
  ABBV:  { name: 'AbbVie Inc.',            sector: 'Healthcare'    },
  LLY:   { name: 'Eli Lilly and Co.',      sector: 'Healthcare'    },
  XOM:   { name: 'ExxonMobil Corp.',       sector: 'Energy'        },
  CVX:   { name: 'Chevron Corp.',          sector: 'Energy'        },
  WMT:   { name: 'Walmart Inc.',           sector: 'Consumer'      },
  TGT:   { name: 'Target Corp.',           sector: 'Consumer'      },
  KO:    { name: 'Coca-Cola Co.',          sector: 'Consumer'      },
  PEP:   { name: 'PepsiCo Inc.',           sector: 'Consumer'      },
  DIS:   { name: 'Walt Disney Co.',        sector: 'Communication' },
  SPOT:  { name: 'Spotify Technology',     sector: 'Communication' },
  UBER:  { name: 'Uber Technologies',      sector: 'Industrials'   },
  BA:    { name: 'Boeing Co.',             sector: 'Industrials'   },
  CAT:   { name: 'Caterpillar Inc.',       sector: 'Industrials'   },
  // ETFs
  SPY:   { name: 'SPDR S&P 500 ETF Trust',     sector: 'Other'      },
  QQQ:   { name: 'Invesco QQQ Trust',          sector: 'Technology' },
  VTI:   { name: 'Vanguard Total Stock ETF',   sector: 'Other'      },
  VOO:   { name: 'Vanguard S&P 500 ETF',       sector: 'Other'      },
  IWM:   { name: 'iShares Russell 2000 ETF',   sector: 'Other'      },
  VGT:   { name: 'Vanguard IT ETF',            sector: 'Technology' },
  XLF:   { name: 'Financial Select SPDR Fund', sector: 'Finance'    },
  XLE:   { name: 'Energy Select SPDR Fund',    sector: 'Energy'     },
  ARKK:  { name: 'ARK Innovation ETF',         sector: 'Technology' },
  GLD:   { name: 'SPDR Gold Shares ETF',       sector: 'Other'      },
  SCHD:  { name: 'Schwab US Dividend ETF',     sector: 'Other'      },
  BND:   { name: 'Vanguard Total Bond ETF',    sector: 'Other'      },
}

// ─── Default empty forms per type ────────────────────────────────────────────
const EMPTY = {
  'Stock':       { type: 'Stock',       symbol: '', name: '', sector: 'Technology', shares: '', avg_cost: '', current_price: '', purchase_date: '' },
  'ETF':         { type: 'ETF',         symbol: '', name: '', sector: 'Other',      shares: '', avg_cost: '', current_price: '', purchase_date: '' },
  'Crypto':      { type: 'Crypto',      symbol: '', name: '', shares: '', avg_cost: '', current_price: '', purchase_date: '' },
  'Bond':        { type: 'Bond',        name: '', face_value: '', coupon_rate: '', purchase_price: '', maturity_date: '', purchase_date: '' },
  'Mutual Fund': { type: 'Mutual Fund', symbol: '', name: '', shares: '', nav: '', purchase_date: '' },
}

export default function Investments() {
  const { user } = useAuth()
  const [investments, setInvestments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [showModal, setShowModal]     = useState(false)
  const [editItem, setEditItem]       = useState(null)
  const [activeType, setActiveType]   = useState('Stock')
  const [form, setForm]               = useState(EMPTY['Stock'])
  const [saving, setSaving]           = useState(false)
  const [saveError, setSaveError]     = useState('')
  const [refreshing, setRefreshing]   = useState(false)
  const [refreshError, setRefreshError] = useState('')
  const [lookupStatus, setLookupStatus] = useState('') // '' | 'loading' | 'found' | 'not_found'

  const [isPro, setIsPro] = useState(false)
  const [proLoading, setProLoading] = useState(true)
  const dark = useDarkMode()

  useEffect(() => {
    const checkPro = async () => {
      const { data } = await supabase
        .from('subscriptions').select('status')
        .eq('user_id', user.id).eq('status', 'active').maybeSingle()
      setIsPro(!!data)
      setProLoading(false)
    }
    checkPro()
  }, [user.id])

  // ─── Load ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data } = await supabase
      .from('investments').select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setInvestments(data || [])
    setLoading(false)
  }, [user.id])

  useEffect(() => { load() }, [load])

  // ─── Open add modal ───────────────────────────────────────────────────────
  const openAdd = () => {
    setEditItem(null)
    setActiveType('Stock')
    setForm(EMPTY['Stock'])
    setLookupStatus('')
    setSaveError('')
    setShowModal(true)
  }

  // ─── Open edit modal ──────────────────────────────────────────────────────
  const openEdit = item => {
    setEditItem(item)
    setActiveType(item.type)
    setLookupStatus(isTickerBased(item.type) && item.symbol ? 'found' : '')

    if (item.type === 'Bond') {
      setForm({
        type: 'Bond',
        name:           item.name          || '',
        face_value:     String(item.current_price || ''),  // face stored in current_price
        coupon_rate:    String(item.portfolio_pct || ''),  // coupon stored in portfolio_pct
        purchase_price: String(item.avg_cost || ''),
        maturity_date:  item.maturity_date || '',
        purchase_date:  item.purchase_date || '',
      })
    } else if (item.type === 'Mutual Fund') {
      setForm({
        type: 'Mutual Fund',
        symbol:        item.symbol || '',
        name:          item.name   || '',
        shares:        String(item.shares || ''),
        nav:           String(item.current_price || item.avg_cost || ''),
        purchase_date: item.purchase_date || '',
      })
    } else if (item.type === 'Crypto') {
      setForm({
        type: 'Crypto',
        symbol:        item.symbol || '',
        name:          item.name   || '',
        shares:        String(item.shares || ''),
        avg_cost:      String(item.avg_cost || ''),
        current_price: String(item.current_price || ''),
        purchase_date: item.purchase_date || '',
      })
    } else {
      // Stock / ETF
      setForm({
        type:          item.type,
        symbol:        item.symbol || '',
        name:          item.name   || '',
        sector:        item.sector || 'Technology',
        shares:        String(item.shares || ''),
        avg_cost:      String(item.avg_cost || ''),
        current_price: String(item.current_price || ''),
        purchase_date: item.purchase_date || '',
      })
    }
    setShowModal(true)
  }

  // ─── Switch type ──────────────────────────────────────────────────────────
  const switchType = type => {
    setActiveType(type)
    setForm(EMPTY[type])
    setLookupStatus('')
  }

  // ─── Ticker change handler ────────────────────────────────────────────────
  const handleSymbolChange = val => {
    const upper = val.toUpperCase().replace(/[^A-Z0-9.]/g, '')
    setForm(f => ({ ...f, symbol: upper, name: '', sector: f.sector }))
    setLookupStatus('')
  }

  // ─── Debounced ticker lookup (Stock + ETF only) ───────────────────────────
  useEffect(() => {
    if (!showModal || !isTickerBased(activeType) || !form.symbol) return
    const sym = form.symbol.trim()
    if (!sym) return

    // Instant local hit
    if (TICKER_HINTS[sym]) {
      const h = TICKER_HINTS[sym]
      setForm(f => ({ ...f, name: h.name, sector: h.sector }))
      setLookupStatus('found')
      return
    }

    // API fallback after 700ms
    setLookupStatus('loading')
    const timer = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/stock-price?symbol=${sym}`)
        const data = await res.json()
        if (data?.price) {
          setForm(f => ({
            ...f,
            name:          data.name   || f.name,
            sector:        data.sector || f.sector,
            current_price: data.price ? String(data.price) : f.current_price,
          }))
          setLookupStatus(data.name ? 'found' : 'not_found')
        } else {
          setLookupStatus('not_found')
        }
      } catch {
        setLookupStatus('not_found')
      }
    }, 700)
    return () => clearTimeout(timer)
  }, [form.symbol, activeType, showModal])

  // ─── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaveError('')

    // Guard: ticker lookup still in flight — wait for it to finish
    if (lookupStatus === 'loading') {
      setSaveError('Ticker lookup is still in progress. Please wait a moment and try again.')
      return
    }

    // Validation
    if ((activeType === 'Stock' || activeType === 'ETF') && !form.symbol.trim()) {
      setSaveError('Ticker symbol is required.')
      return
    }
    if (activeType !== 'Bond' && !form.name.trim()) {
      setSaveError('Name is required.')
      return
    }
    if (activeType === 'Bond' && !form.name.trim()) {
      setSaveError('Bond name is required.')
      return
    }

    setSaving(true)
    let payload = { user_id: user.id, type: activeType }

    if (activeType === 'Stock' || activeType === 'ETF') {
      const shares   = parseFloat(form.shares)   || 0
      const avgCost  = parseFloat(form.avg_cost)  || 0
      const curPrice = parseFloat(form.current_price) || avgCost
      payload = { ...payload,
        symbol: form.symbol.toUpperCase().trim(),
        name:   form.name.trim(),
        sector: form.sector || 'Other',
        shares, avg_cost: avgCost, current_price: curPrice, portfolio_pct: 0,
      }
    } else if (activeType === 'Crypto') {
      const qty   = parseFloat(form.shares)   || 0
      const cost  = parseFloat(form.avg_cost)  || 0
      const price = parseFloat(form.current_price) || cost
      payload = { ...payload,
        symbol: form.symbol.toUpperCase().trim() || '',
        name:   form.name.trim(), sector: 'Crypto',
        shares: qty, avg_cost: cost, current_price: price, portfolio_pct: 0,
      }
    } else if (activeType === 'Bond') {
      const faceVal   = parseFloat(form.face_value)    || 0
      const coupon    = parseFloat(form.coupon_rate)   || 0
      const purchase  = parseFloat(form.purchase_price) || faceVal
      payload = { ...payload,
        symbol: '', name: form.name.trim(), sector: 'Finance',
        shares: 1,
        avg_cost:      purchase,   // what you paid
        current_price: faceVal,    // face / par value
        portfolio_pct: coupon,     // coupon rate % stored here
        maturity_date: form.maturity_date || null,
      }
    } else if (activeType === 'Mutual Fund') {
      const units = parseFloat(form.shares) || 0
      const nav   = parseFloat(form.nav)    || 0
      payload = { ...payload,
        symbol: form.symbol.toUpperCase().trim() || '',
        name:   form.name.trim(), sector: 'Other',
        shares: units, avg_cost: nav, current_price: nav, portfolio_pct: 0,
      }
    }

    try {
      let result
      if (editItem) {
        result = await supabase.from('investments').update(payload).eq('id', editItem.id).eq('user_id', user.id)
      } else {
        result = await supabase.from('investments').insert(payload)
      }
      if (result.error) throw result.error
      setShowModal(false)
      load()
    } catch (err) {
      setSaveError(err.message || 'Failed to save investment. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async id => {
    if (!confirm('Remove this investment?')) return
    await supabase.from('investments').delete().eq('id', id).eq('user_id', user.id)
    load()
  }

  // ─── Auto-refresh stocks + ETFs ───────────────────────────────────────────
  const refreshPrices = async () => {
    setRefreshing(true)
    setRefreshError('')
    const refreshable = investments.filter(i => isAutoRefresh(i.type) && i.symbol)
    let updatedCount = 0

    for (const inv of refreshable) {
      try {
        const res  = await fetch(`/api/stock-price?symbol=${inv.symbol}`)
        const data = await res.json()
        if (data?.price && data.price > 0) {
          await supabase.from('investments')
            .update({ current_price: data.price })
            .eq('id', inv.id).eq('user_id', user.id)
          updatedCount++
        }
      } catch { /* skip */ }
    }

    setRefreshing(false)
    if (refreshable.length === 0) setRefreshError('No stocks or ETFs to refresh.')
    else if (updatedCount === 0)  setRefreshError('Could not fetch prices. Check your ticker symbols.')
    load()
  }

  // ─── Stats ────────────────────────────────────────────────────────────────
  const getValue = i => i.type === 'Bond'
    ? (i.avg_cost || 0)
    : (i.shares * (i.current_price || i.avg_cost))

  const totalValue  = investments.reduce((s, i) => s + getValue(i), 0)
  const totalCost   = investments.reduce((s, i) => s + (i.type === 'Bond' ? (i.avg_cost || 0) : i.shares * i.avg_cost), 0)
  const totalGL     = totalValue - totalCost
  const totalRet    = totalCost > 0 ? (totalGL / totalCost * 100).toFixed(2) : '0.00'

  const refreshableCount = investments.filter(i => isAutoRefresh(i.type) && i.symbol).length
  const manualCount      = investments.length - refreshableCount

  // Chart data
  const sectorMap = {}
  const typeMap   = {}
  investments.forEach(i => {
    const val = getValue(i)
    sectorMap[i.sector || 'Other'] = (sectorMap[i.sector || 'Other'] || 0) + val
    typeMap[i.type]                 = (typeMap[i.type]                || 0) + val
  })
  const sectorData = groupSmallSlices(Object.entries(sectorMap).map(([name, value]) => ({ name, value })))
  const typeData   = groupSmallSlices(Object.entries(typeMap).map(([name, value]) => ({ name, value })))

  // ─── Consolidate duplicate tickers into one holding ───────────────────────
  // Key: "<type>|<symbol|name>" so AAPL Stock + AAPL ETF stay separate,
  // and name-only holdings (Bond, Mutual Fund, Crypto w/o symbol) merge by name.
  const consolidatedInvestments = (() => {
    const map = new Map()
    for (const inv of investments) {
      const key = `${inv.type}|${inv.symbol ? inv.symbol.toUpperCase() : inv.name}`
      if (!map.has(key)) {
        // Clone so we don't mutate state
        map.set(key, { ...inv, _ids: [inv.id] })
      } else {
        const existing = map.get(key)
        const prevShares   = existing.shares   || 0
        const addShares    = inv.shares         || 0
        const totalShares  = prevShares + addShares
        // Weighted-average cost basis
        const newAvgCost   = totalShares > 0
          ? (prevShares * existing.avg_cost + addShares * inv.avg_cost) / totalShares
          : existing.avg_cost
        // Use the most recent current_price (from the newest record)
        existing.shares        = totalShares
        existing.avg_cost      = newAvgCost
        existing.current_price = inv.current_price || existing.current_price
        existing._ids.push(inv.id)
      }
    }
    return Array.from(map.values())
  })()

  // ─── Lookup badge ─────────────────────────────────────────────────────────
  const lookupBadge = {
    loading:   <span className="text-xs font-medium inline-flex items-center gap-1" style={{ color: '#f0a500' }}><RefreshCw size={11} className="animate-spin" /> looking…</span>,
    found:     <span className="text-xs font-medium inline-flex items-center gap-1" style={{ color: '#10b981' }}><Check size={11} /> found</span>,
    not_found: <span className="text-xs font-medium" style={{ color: '#ef4444' }}>? not found — enter manually</span>,
  }[lookupStatus] || null

  // ─── Form fields by type ──────────────────────────────────────────────────
  const renderFormBody = () => {

    /* ── STOCK / ETF ─────────────────────────────────────────── */
    if (activeType === 'Stock' || activeType === 'ETF') return (
      <>
        <div className="mb-4">
          <label className="label">
            Ticker Symbol *
            <span className="ml-2 text-xs font-normal" style={{ color: '#10b981' }}>
              · auto-detect {activeType === 'ETF' ? '(SPY, QQQ, VOO…)' : '(AAPL, TSLA, NVDA…)'}
            </span>
          </label>
          <div className="relative">
            <input
              className="input-field pr-28"
              style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}
              placeholder={activeType === 'ETF' ? 'QQQ' : 'AAPL'}
              value={form.symbol}
              onChange={e => handleSymbolChange(e.target.value)}
            />
            {lookupStatus && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2">{lookupBadge}</span>
            )}
          </div>
        </div>

        <div className="mb-4">
          <label className="label">
            {activeType === 'ETF' ? 'Fund Name' : 'Company Name'} *
            {lookupStatus === 'found' && <span className="ml-2 text-xs font-normal" style={{ color: '#10b981' }}>· auto-filled</span>}
          </label>
          <input className="input-field"
            placeholder="Auto-filled from ticker, or enter manually"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>

        <div className="mb-4">
          <label className="label">
            Sector
            {lookupStatus === 'found' && <span className="ml-2 text-xs font-normal" style={{ color: '#10b981' }}>· auto-filled</span>}
          </label>
          <select className="input-field" value={form.sector} onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}>
            {SECTORS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Shares *</label>
            <input className="input-field" type="number" step="0.0001" min="0" placeholder="10"
              value={form.shares} onChange={e => setForm(f => ({ ...f, shares: e.target.value }))} />
          </div>
          <div>
            <label className="label">Avg Cost / Share *</label>
            <input className="input-field" type="number" step="0.01" min="0" placeholder="150.00"
              value={form.avg_cost} onChange={e => setForm(f => ({ ...f, avg_cost: e.target.value }))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">
              Current Price
              <span className="ml-1 text-xs font-normal" style={{ color: '#10b981' }}>(auto-refreshed)</span>
            </label>
            <input className="input-field" type="number" step="0.01" min="0"
              placeholder="Fetched on refresh"
              value={form.current_price} onChange={e => setForm(f => ({ ...f, current_price: e.target.value }))} />
          </div>
          <div>
            <label className="label">Purchase Date</label>
            <input className="input-field" type="date"
              value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
          </div>
        </div>

        <div className="p-3 rounded-xl text-xs flex items-center gap-1.5" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981' }}>
          <RefreshCw size={13} className="flex-shrink-0" /> {activeType} prices auto-refresh when you click "Refresh Prices".
        </div>
      </>
    )

    /* ── CRYPTO ──────────────────────────────────────────────── */
    if (activeType === 'Crypto') return (
      <>
        <div className="p-3 rounded-xl text-xs mb-4 flex items-center gap-1.5" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}>
          <AlertTriangle size={13} className="flex-shrink-0" /> Crypto prices are <strong>not auto-refreshed</strong>. Update the current price manually.
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Coin Name *</label>
            <input className="input-field" placeholder="Bitcoin"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Symbol <span className="font-normal text-muted">(optional)</span></label>
            <input className="input-field" style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}
              placeholder="BTC"
              value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Quantity Held *</label>
            <input className="input-field" type="number" step="0.00000001" min="0" placeholder="0.5"
              value={form.shares} onChange={e => setForm(f => ({ ...f, shares: e.target.value }))} />
          </div>
          <div>
            <label className="label">Purchase Price / Coin *</label>
            <input className="input-field" type="number" step="0.01" min="0" placeholder="45000.00"
              value={form.avg_cost} onChange={e => setForm(f => ({ ...f, avg_cost: e.target.value }))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Current Price / Coin <span className="font-normal text-muted">(manual)</span></label>
            <input className="input-field" type="number" step="0.01" min="0" placeholder="60000.00"
              value={form.current_price} onChange={e => setForm(f => ({ ...f, current_price: e.target.value }))} />
          </div>
          <div>
            <label className="label">Purchase Date</label>
            <input className="input-field" type="date"
              value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
          </div>
        </div>
      </>
    )

    /* ── BOND ────────────────────────────────────────────────── */
    if (activeType === 'Bond') return (
      <>
        <div className="p-3 rounded-xl text-xs mb-4 flex items-center gap-1.5" style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa' }}>
          <Landmark size={13} className="flex-shrink-0" /> Bonds are tracked at purchase price. Annual income = coupon rate × face value.
        </div>

        <div className="mb-4">
          <label className="label">Issuer / Company *</label>
          <input className="input-field"
            placeholder="e.g. U.S. Treasury, Apple Inc., City of New York"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Face Value (Par) *</label>
            <input className="input-field" type="number" step="100" min="0" placeholder="1000.00"
              value={form.face_value} onChange={e => setForm(f => ({ ...f, face_value: e.target.value }))} />
            <p className="text-xs text-muted mt-1">Value you receive at maturity</p>
          </div>
          <div>
            <label className="label">Annual Coupon Rate (%) *</label>
            <input className="input-field" type="number" step="0.01" min="0" placeholder="4.50"
              value={form.coupon_rate} onChange={e => setForm(f => ({ ...f, coupon_rate: e.target.value }))} />
            {form.coupon_rate && form.face_value && (
              <p className="text-xs mt-1" style={{ color: '#10b981' }}>
                Annual income: {fmt((parseFloat(form.coupon_rate) / 100) * parseFloat(form.face_value))}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Purchase Price *</label>
            <input className="input-field" type="number" step="0.01" min="0" placeholder="980.00"
              value={form.purchase_price} onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))} />
            <p className="text-xs text-muted mt-1">What you actually paid</p>
          </div>
          <div>
            <label className="label">Maturity Date</label>
            <input className="input-field" type="date"
              value={form.maturity_date} onChange={e => setForm(f => ({ ...f, maturity_date: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="label">Purchase Date</label>
          <input className="input-field" style={{ maxWidth: '50%' }} type="date"
            value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
        </div>
      </>
    )

    /* ── MUTUAL FUND ─────────────────────────────────────────── */
    if (activeType === 'Mutual Fund') return (
      <>
        <div className="p-3 rounded-xl text-xs mb-4 flex items-center gap-1.5" style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)', color: '#a78bfa' }}>
          <Landmark size={13} className="flex-shrink-0" /> Mutual fund NAVs update once daily at market close. Update the NAV manually to keep values current.
        </div>

        <div className="mb-4">
          <label className="label">Fund Name *</label>
          <input className="input-field"
            placeholder="e.g. Vanguard Total Stock Market Index Fund"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>

        <div className="mb-4">
          <label className="label">Fund Symbol <span className="font-normal text-muted">(optional)</span></label>
          <input className="input-field" style={{ maxWidth: '50%', textTransform: 'uppercase', letterSpacing: '0.06em' }}
            placeholder="VTSAX"
            value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))} />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="label">Units / Shares *</label>
            <input className="input-field" type="number" step="0.001" min="0" placeholder="50.000"
              value={form.shares} onChange={e => setForm(f => ({ ...f, shares: e.target.value }))} />
          </div>
          <div>
            <label className="label">NAV per Share * <span className="font-normal text-muted">(manual)</span></label>
            <input className="input-field" type="number" step="0.01" min="0" placeholder="120.00"
              value={form.nav} onChange={e => setForm(f => ({ ...f, nav: e.target.value }))} />
            {form.shares && form.nav && (
              <p className="text-xs mt-1" style={{ color: '#10b981' }}>
                Total value: {fmt(parseFloat(form.shares) * parseFloat(form.nav))}
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="label">Purchase Date</label>
          <input className="input-field" style={{ maxWidth: '50%' }} type="date"
            value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} />
        </div>
      </>
    )

    return null
  }

  const handleDeleteConsolidated = async item => {
    const ids = item._ids || [item.id]
    const lotLabel = ids.length > 1 ? `${ids.length} lots of ${item.symbol || item.name}` : `this investment`
    if (!confirm(`Remove ${lotLabel}?`)) return
    for (const id of ids) {
      await supabase.from('investments').delete().eq('id', id).eq('user_id', user.id)
    }
    load()
  }

  // ─── Row renderer ─────────────────────────────────────────────────────────
  const renderRow = item => {
    let val, cost, gl, glPct, subLine

    if (item.type === 'Bond') {
      val     = item.avg_cost || 0
      cost    = item.avg_cost || 0
      gl      = (item.current_price || 0) - cost   // face minus purchase = premium/discount
      glPct   = cost > 0 ? (gl / cost * 100).toFixed(1) : '0.0'
      const annual = ((item.portfolio_pct || 0) / 100) * (item.current_price || 0)
      subLine = `${item.portfolio_pct || 0}% coupon · ${fmt(annual)}/yr · face ${fmt(item.current_price)}`
    } else if (item.type === 'Mutual Fund') {
      val     = item.shares * (item.current_price || item.avg_cost)
      cost    = item.shares * item.avg_cost
      gl      = val - cost
      glPct   = cost > 0 ? (gl / cost * 100).toFixed(1) : '0.0'
      subLine = `${item.shares} units · NAV ${fmt(item.current_price || item.avg_cost)}`
    } else if (item.type === 'Crypto') {
      val     = item.shares * (item.current_price || item.avg_cost)
      cost    = item.shares * item.avg_cost
      gl      = val - cost
      glPct   = cost > 0 ? (gl / cost * 100).toFixed(1) : '0.0'
      subLine = `${item.shares} ${item.symbol || 'coins'} · ${fmt(item.current_price || item.avg_cost)} ea`
    } else {
      val     = item.shares * (item.current_price || item.avg_cost)
      cost    = item.shares * item.avg_cost
      gl      = val - cost
      glPct   = cost > 0 ? (gl / cost * 100).toFixed(1) : '0.0'
      subLine = `${item.shares} shares · ${fmt(item.current_price || item.avg_cost)} now`
    }

    return (
      <tr key={item._ids ? item._ids.join('-') : item.id} className="border-b last:border-0" style={{ borderColor: 'var(--card-border)' }}>
        <td className="py-3 px-2">
          <div className="flex items-center gap-1">
            {item.symbol && <span className="font-bold text-primary text-sm">{item.symbol}</span>}
            {isAutoRefresh(item.type) && (
              <span className="text-xs px-1 rounded" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>auto</span>
            )}
            {item._ids && item._ids.length > 1 && (
              <span className="text-xs px-1 rounded" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>{item._ids.length} lots</span>
            )}
          </div>
          <span className="text-xs text-muted block">{item.name}</span>
          <span className="text-xs text-muted block mt-0.5">{subLine}</span>
        </td>
        <td className="py-3 px-2">
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--input-bg)', color: 'var(--text-muted)' }}>
            {item.type}
          </span>
        </td>
        <td className="py-3 px-2 text-muted text-xs">{item.sector || '—'}</td>
        <td className="py-3 px-2 font-medium text-primary">{fmt(val)}</td>
        <td className="py-3 px-2">
          <span className="font-medium text-sm" style={{ color: gl >= 0 ? '#10b981' : '#ef4444' }}>
            {gl >= 0 ? '+' : ''}{fmt(gl)}
          </span>
          <span className="block text-xs" style={{ color: gl >= 0 ? '#10b981' : '#ef4444' }}>
            {glPct}%
          </span>
        </td>
        <td className="py-3 px-2">
          <div className="flex gap-2">
            <button onClick={() => openEdit(item)} className="text-muted hover:text-primary"><Pencil size={14} /></button>
            <button onClick={() => handleDeleteConsolidated(item)} className="text-muted hover:text-red-500"><Trash2 size={14} /></button>
          </div>
        </td>
      </tr>
    )
  }

  // ─── Loading spinner ──────────────────────────────────────────────────────
  if (proLoading || loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }} />
    </div>
  )

  if (!isPro) return (
    <ProGate
      feature="Investments"
      Icon={TrendingUp}
      description="Track your full portfolio — stocks, ETFs, crypto, bonds, and mutual funds — with live price refresh and performance charts."
      userId={user.id}
    />
  )

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Investments</h1>
        <p className="text-muted text-sm mt-1">Track your portfolio across stocks, ETFs, crypto, bonds & funds</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-1 flex-wrap items-center">
        <button onClick={refreshPrices} disabled={refreshing} className="btn-secondary">
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'Refreshing…' : `Refresh Prices (${refreshableCount} stocks & ETFs)`}
        </button>
        <button onClick={openAdd} className="btn-primary">+ Add Investment</button>
      </div>
      {manualCount > 0 && (
        <p className="text-xs text-muted mb-2 mt-1 flex items-center gap-1">
          <Info size={12} /> {manualCount} holding{manualCount !== 1 ? 's' : ''} (crypto / bonds / mutual funds) require manual price updates.
        </p>
      )}
      {refreshError && <p className="text-red-500 text-xs mb-3">{refreshError}</p>}
      {!refreshError && <div className="mb-4" />}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl p-4 min-w-0" style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)' }}>
          <p className="text-muted text-xs mb-1">Portfolio Value</p>
          <p className="text-xl font-bold text-primary break-words" title={fmt(totalValue)}>{fmtCompact(totalValue)}</p>
          <p className="text-muted text-xs mt-0.5">
            {consolidatedInvestments.length} holding{consolidatedInvestments.length !== 1 ? 's' : ''}
            {investments.length > consolidatedInvestments.length && (
              <span> · {investments.length - consolidatedInvestments.length} lot{investments.length - consolidatedInvestments.length !== 1 ? 's' : ''} merged</span>
            )}
          </p>
        </div>
        <div className="rounded-xl p-4 min-w-0" style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)' }}>
          <p className="text-muted text-xs mb-1">Total Gain / Loss</p>
          <p className="text-xl font-bold break-words" style={{ color: totalGL >= 0 ? '#10b981' : '#ef4444' }} title={fmt(totalGL)}>
            {totalGL >= 0 ? '+' : ''}{fmtCompact(totalGL)}
          </p>
          <p className="text-muted text-xs mt-0.5">vs cost basis</p>
        </div>
        <div className="card p-4 min-w-0">
          <p className="text-muted text-xs mb-1">Total Return</p>
          <p className="text-xl font-bold break-words" style={{ color: totalGL >= 0 ? '#10b981' : '#ef4444' }}>
            {totalRet}%
          </p>
          <p className="text-muted text-xs mt-0.5">all time</p>
        </div>
      </div>

      {/* Holdings table */}
      <div className="card p-5 mb-6">
        <div className="flex items-center gap-2 mb-4 font-semibold text-primary text-sm">
          <PieChartIcon size={16} /><span>Portfolio Holdings</span>
        </div>
        {investments.length === 0 ? (
          <div className="text-center py-12">
            <div className="flex justify-center mb-3 text-muted"><BarChart3 size={36} /></div>
            <p className="font-semibold text-primary">No Investments Yet</p>
            <p className="text-muted text-sm mt-1">Add your first investment to start tracking performance.</p>
            <button onClick={openAdd} className="btn-primary mt-4">+ Add Your First Investment</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted border-b" style={{ borderColor: 'var(--card-border)' }}>
                  {['Holding', 'Type', 'Sector', 'Value', 'G/L', 'Actions'].map(h => (
                    <th key={h} className="text-left py-2 px-2 font-medium text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>{consolidatedInvestments.map(renderRow)}</tbody>
            </table>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className={`grid gap-6 mb-6 ${sectorData.length > 0 && typeData.length > 0 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>

        {sectorData.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4 font-semibold text-primary text-sm"><BarChart3 size={16} /><span>Sector Allocation</span></div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={sectorData} dataKey="value" cx="50%" cy="50%" outerRadius={80} {...PIE_STROKE_PROPS}>
                  {sectorData.map((s, i) => <Cell key={i} fill={categoricalColor(s.name, i)} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} contentStyle={pieTooltipStyle(dark)} itemStyle={pieTooltipItemStyle} labelStyle={pieTooltipLabelStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1">
              {sectorData.map((s, i) => (
                <div key={s.name} className="flex justify-between text-xs">
                  <span className="flex items-center gap-1 min-w-0">
                    <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: categoricalColor(s.name, i) }} />
                    <span className="text-muted truncate">{s.name}</span>
                  </span>
                  <span className="font-medium text-primary flex-shrink-0 ml-2">{fmtCompact(s.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {typeData.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4 font-semibold text-primary text-sm"><PieChartIcon size={16} /><span>By Type</span></div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={typeData} dataKey="value" cx="50%" cy="50%" outerRadius={80} {...PIE_STROKE_PROPS}>
                  {typeData.map((t, i) => <Cell key={i} fill={categoricalColor(t.name, i)} />)}
                </Pie>
                <Tooltip formatter={v => fmt(v)} contentStyle={pieTooltipStyle(dark)} itemStyle={pieTooltipItemStyle} labelStyle={pieTooltipLabelStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1">
              {typeData.map((t, i) => (
                <div key={t.name} className="flex justify-between text-xs">
                  <span className="flex items-center gap-1 min-w-0">
                    <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: categoricalColor(t.name, i) }} />
                    <span className="text-muted truncate">{t.name}</span>
                  </span>
                  <span className="font-medium text-primary flex-shrink-0 ml-2">{fmtCompact(t.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>

            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2 font-semibold text-primary">
                <ArrowUpRight size={16} /><span>{editItem ? 'Edit Investment' : 'Add Investment'}</span>
              </div>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-primary"><X size={20} /></button>
            </div>

            {/* Type tabs */}
            <div className="mb-5">
              <label className="label mb-2">Investment Type</label>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                {TYPES.map(t => (
                  <button key={t} type="button" onClick={() => switchType(t)}
                    className="py-2 rounded-xl text-xs font-semibold transition-colors"
                    style={{
                      border:     activeType === t ? '1px solid rgba(16,185,129,0.6)' : '1px solid var(--card-border)',
                      background: activeType === t ? 'rgba(16,185,129,0.15)'          : 'transparent',
                      color:      activeType === t ? '#10b981'                         : 'var(--text-muted)',
                    }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Type-specific fields */}
            {renderFormBody()}

            {/* Save error */}
            {saveError && (
              <div className="mt-4 p-3 rounded-xl text-xs font-medium flex items-center gap-1.5" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
                <AlertTriangle size={13} className="flex-shrink-0" /> {saveError}
              </div>
            )}

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-3 mt-5">
              <button type="button" onClick={() => setShowModal(false)} className="btn-secondary justify-center">Cancel</button>
              <button type="button" onClick={handleSave} disabled={saving} className="btn-primary justify-center">
                {saving ? 'Saving…' : editItem ? 'Save Changes' : 'Add Investment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
