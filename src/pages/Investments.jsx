import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Legend,
} from 'recharts'
import {
  PieChart as PieChartIcon, BarChart3, TrendingUp, RefreshCw, Check,
  AlertTriangle, Landmark, Info, Pencil, Trash2, X, ArrowUpRight,
} from 'lucide-react'
import { fmtCompact, fmtCurrency as fmt } from '../lib/format'
import {
  pieColors, pieStrokeProps, pieTooltipStyle, pieTooltipItemStyle, pieTooltipLabelStyle,
  renderActivePieSector, pieCellOpacity, sortByValueDesc, renderLegend,
} from '../lib/chartTheme'
import { useDarkMode } from '../hooks/useDarkMode'

// Stocks AND ETFs get auto-refresh (both trade on exchanges with real-time tickers)
const isAutoRefresh = type => type === 'Stock' || type === 'ETF'
// Stocks AND ETFs support ticker auto-detect
const isTickerBased = type => type === 'Stock' || type === 'ETF'

const TYPES = ['Stock', 'ETF', 'Crypto', 'Bond', 'Mutual Fund']
const SECTORS = ['Technology','Healthcare','Finance','Energy','Consumer','Real Estate','Utilities','Materials','Communication','Industrials','Other']


import ProGate from '../components/ProGate'
import { PageHeader, StatCard, EmptyState, PageSkeleton, SegTabs } from '../components/ui'
import { useIsPro } from '../hooks/useIsPro'

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

  const { isPro, proLoading } = useIsPro(user.id)
  const dark = useDarkMode()
  const [sectorActiveIndex, setSectorActiveIndex] = useState(null)
  const [typeActiveIndex, setTypeActiveIndex] = useState(null)
  const [growthRange, setGrowthRange] = useState('all') // '1w' | '1m' | '1y' | 'all'

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

  // Deep link from the Dashboard's "+ Add" menu: /investments?add=1 opens the form (Pro only)
  useEffect(() => {
    if (!proLoading && !loading && isPro && new URLSearchParams(window.location.search).get('add') === '1') openAdd()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proLoading, loading, isPro])

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
  const sectorData = sortByValueDesc(Object.entries(sectorMap).map(([name, value]) => ({ name, value })))
  const typeData   = sortByValueDesc(Object.entries(typeMap).map(([name, value]) => ({ name, value })))

  // Portfolio growth over time. There's no stored daily price history, so this can't show
  // day-to-day market movement — instead it tracks cumulative cost basis vs. cumulative current
  // value as of each holding's purchase date, i.e. growth via contributions.
  const growthSeriesFull = investments
    .filter(i => i.purchase_date)
    .slice()
    .sort((a, b) => new Date(a.purchase_date) - new Date(b.purchase_date))
    .reduce((acc, i) => {
      const prev = acc[acc.length - 1]
      const cost  = (prev?.cost  || 0) + (i.type === 'Bond' ? (i.avg_cost || 0) : i.shares * i.avg_cost)
      const value = (prev?.value || 0) + getValue(i)
      acc.push({ date: i.purchase_date, cost, value })
      return acc
    }, [])

  // Windows the full cumulative series to the selected range. The Y-values stay true cumulative
  // totals (a purchase from 3 years ago still counts) — only which points are drawn changes. If
  // nothing was purchased inside the window, the last totals from before it are extended flat to
  // today rather than leaving the chart empty, since the portfolio didn't stop existing.
  const growthData = (() => {
    if (growthRange === 'all') {
      if (growthSeriesFull.length !== 1) return growthSeriesFull
      const todayStr = new Date().toISOString().split('T')[0]
      return growthSeriesFull[0].date === todayStr ? growthSeriesFull : [growthSeriesFull[0], { ...growthSeriesFull[0], date: todayStr }]
    }
    if (growthSeriesFull.length === 0) return []
    const cutoff = new Date()
    if (growthRange === '1w') cutoff.setDate(cutoff.getDate() - 7)
    else if (growthRange === '1m') cutoff.setMonth(cutoff.getMonth() - 1)
    else if (growthRange === '1y') cutoff.setFullYear(cutoff.getFullYear() - 1)
    const cutoffStr = cutoff.toISOString().split('T')[0]

    const before = growthSeriesFull.filter(p => p.date < cutoffStr)
    const within = growthSeriesFull.filter(p => p.date >= cutoffStr)
    if (before.length === 0) return within

    const anchor = { ...before[before.length - 1], date: cutoffStr }
    if (within.length > 0) return [anchor, ...within]
    const todayStr = new Date().toISOString().split('T')[0]
    return anchor.date === todayStr ? [anchor] : [anchor, { ...anchor, date: todayStr }]
  })()

  const lineColorCost  = dark ? '#60a5fa' : '#1a3a6b'
  const lineColorValue = dark ? '#10b981' : '#047857'

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
    loading:   <span className="text-xs font-medium inline-flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}><RefreshCw size={11} className="animate-spin" /> looking…</span>,
    found:     <span className="text-xs font-medium inline-flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: 'var(--positive-bg)', color: 'var(--positive)' }}><Check size={11} /> found</span>,
    not_found: <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--negative-bg)', color: 'var(--negative)' }}>? not found — enter manually</span>,
  }[lookupStatus] || null

  // ─── Form fields by type ──────────────────────────────────────────────────
  const renderFormBody = () => {

    /* ── STOCK / ETF ─────────────────────────────────────────── */
    if (activeType === 'Stock' || activeType === 'ETF') return (
      <>
        <div className="mb-4">
          <label className="label">
            Ticker Symbol *
            <span className="ml-2 text-xs font-normal px-1.5 py-0.5 rounded" style={{ background: 'var(--positive-bg)', color: 'var(--positive)' }}>
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
            {lookupStatus === 'found' && <span className="ml-2 text-xs font-normal px-1.5 py-0.5 rounded" style={{ background: 'var(--positive-bg)', color: 'var(--positive)' }}>· auto-filled</span>}
          </label>
          <input className="input-field"
            placeholder="Auto-filled from ticker, or enter manually"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>

        <div className="mb-4">
          <label className="label">
            Sector
            {lookupStatus === 'found' && <span className="ml-2 text-xs font-normal px-1.5 py-0.5 rounded" style={{ background: 'var(--positive-bg)', color: 'var(--positive)' }}>· auto-filled</span>}
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
              Current Price <span className="font-normal text-muted">(auto-refreshed)</span>
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

        <div className="p-3 rounded-xl text-xs flex items-center gap-1.5" style={{ background: 'var(--positive-bg)', border: '1px solid var(--positive)', color: 'var(--positive)' }}>
          <RefreshCw size={13} className="flex-shrink-0" /> {activeType} prices auto-refresh when you click "Refresh Prices".
        </div>
      </>
    )

    /* ── CRYPTO ──────────────────────────────────────────────── */
    if (activeType === 'Crypto') return (
      <>
        <div className="p-3 rounded-xl text-xs mb-4 flex items-center gap-1.5" style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)', color: 'var(--warning)' }}>
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
              <p className="text-xs mt-1 inline-block px-1.5 py-0.5 rounded" style={{ background: 'var(--positive-bg)', color: 'var(--positive)' }}>
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
        <div className="p-3 rounded-xl text-xs mb-4 flex items-center gap-1.5" style={{ background: dark ? 'rgba(139,92,246,0.08)' : '#ede9fe', border: dark ? '1px solid rgba(139,92,246,0.25)' : '1px solid #6d28d9', color: dark ? '#a78bfa' : '#6d28d9' }}>
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
              <p className="text-xs mt-1 inline-block px-1.5 py-0.5 rounded" style={{ background: 'var(--positive-bg)', color: 'var(--positive)' }}>
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

    // Stacked row instead of a wide table row — the table forced sideways
    // scrolling on phones; this keeps every holding fully visible at any width.
    return (
      <div key={item._ids ? item._ids.join('-') : item.id} className="list-row">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {item.symbol
              ? <span className="font-bold text-primary text-sm">{item.symbol}</span>
              : <span className="font-bold text-primary text-sm truncate">{item.name}</span>}
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'var(--input-bg)', color: 'var(--text-muted)' }}>
              {item.type}
            </span>
            {isAutoRefresh(item.type) && (
              <span className="text-xs px-1.5 rounded" style={{ background: 'var(--positive-bg)', color: 'var(--positive)' }}>auto</span>
            )}
            {item._ids && item._ids.length > 1 && (
              <span className="text-xs px-1.5 rounded" style={{ background: dark ? 'rgba(139,92,246,0.15)' : '#ede9fe', color: dark ? '#a78bfa' : '#6d28d9' }}>{item._ids.length} lots</span>
            )}
          </div>
          <p className="text-xs text-muted truncate mt-0.5">
            {item.symbol ? `${item.name}${item.sector ? ` · ${item.sector}` : ''}` : (item.sector || '')}
          </p>
          <p className="text-xs text-muted truncate">{subLine}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-primary text-sm tnum">{fmt(val)}</p>
          <p className="text-xs tnum font-medium" style={{ color: gl >= 0 ? 'var(--positive-strong)' : 'var(--negative-strong)' }}>
            {gl >= 0 ? '+' : ''}{fmt(gl)} · {glPct}%
          </p>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button onClick={() => openEdit(item)} className="text-muted hover:text-primary p-0.5"><Pencil size={14} /></button>
          <button onClick={() => handleDeleteConsolidated(item)} className="text-muted hover:text-red-500 p-0.5"><Trash2 size={14} /></button>
        </div>
      </div>
    )
  }

  // ─── Loading skeleton ─────────────────────────────────────────────────────
  if (proLoading || loading) return <PageSkeleton stats={3} hero={false} />

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
      <PageHeader title="Investments" subtitle="Track your portfolio across stocks, ETFs, crypto, bonds & funds">
        <button onClick={refreshPrices} disabled={refreshing} className="btn-secondary text-sm">
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'Refreshing…' : `Refresh Prices (${refreshableCount})`}
        </button>
        <button onClick={openAdd} className="btn-primary text-sm">+ Add Investment</button>
      </PageHeader>
      {manualCount > 0 && (
        <p className="text-xs text-muted mb-2 mt-1 flex items-center gap-1">
          <Info size={12} /> {manualCount} holding{manualCount !== 1 ? 's' : ''} (crypto / bonds / mutual funds) require manual price updates.
        </p>
      )}
      {refreshError && <p className="text-xs mb-3" style={{ color: 'var(--negative-strong)' }}>{refreshError}</p>}
      {!refreshError && <div className="mb-4" />}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="card p-4 min-w-0">
          <p className="text-muted text-xs mb-1">Portfolio Value</p>
          <p className="text-xl font-bold text-primary break-words" title={fmt(totalValue)}>{fmtCompact(totalValue)}</p>
          <p className="text-muted text-xs mt-0.5">
            {consolidatedInvestments.length} holding{consolidatedInvestments.length !== 1 ? 's' : ''}
            {investments.length > consolidatedInvestments.length && (
              <span> · {investments.length - consolidatedInvestments.length} lot{investments.length - consolidatedInvestments.length !== 1 ? 's' : ''} merged</span>
            )}
          </p>
        </div>
        <div className="card p-4 min-w-0">
          <p className="text-muted text-xs mb-1">Total Gain / Loss</p>
          <p className="text-xl font-bold break-words" style={{ color: totalGL >= 0 ? 'var(--positive-strong)' : 'var(--negative-strong)' }} title={fmt(totalGL)}>
            {totalGL >= 0 ? '+' : ''}{fmtCompact(totalGL)}
          </p>
          <p className="text-muted text-xs mt-0.5">vs cost basis</p>
        </div>
        <div className="card p-4 min-w-0">
          <p className="text-muted text-xs mb-1">Total Return</p>
          <p className="text-xl font-bold break-words" style={{ color: totalGL >= 0 ? 'var(--positive-strong)' : 'var(--negative-strong)' }}>
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
          <EmptyState Icon={BarChart3} title="No Investments Yet" sub="Add your first investment to start tracking performance.">
            <button onClick={openAdd} className="btn-primary">+ Add Your First Investment</button>
          </EmptyState>
        ) : (
          <div>{consolidatedInvestments.map(renderRow)}</div>
        )}
      </div>

      {/* Portfolio Growth */}
      {growthSeriesFull.length > 0 && (
        <div className="card p-5 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-2 font-semibold text-primary text-sm"><TrendingUp size={16} /><span>Portfolio Growth</span></div>
            <SegTabs small active={growthRange} onChange={setGrowthRange}
              tabs={[{ value: '1w', label: '1W' }, { value: '1m', label: '1M' }, { value: '1y', label: '1Y' }, { value: 'all', label: 'All' }]} />
          </div>
          {growthData.length < 2 ? (
            <div className="text-center py-10 text-muted text-sm">No purchases in this range</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={growthData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                  <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtCompact} />
                  <Tooltip formatter={v => fmt(v)} contentStyle={{ background: dark ? '#111' : '#fff', border: '1px solid var(--card-border)', borderRadius: 10, fontSize: 13 }} />
                  <Legend content={renderLegend} />
                  <Line type="monotone" dataKey="cost"  name="Invested"       stroke={lineColorCost}  strokeWidth={2}   dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="value" name="Current Value" stroke={lineColorValue} strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-muted text-xs mt-2">Cumulative cost basis vs. current value as holdings were added — not day-to-day market movement.</p>
            </>
          )}
        </div>
      )}

      {/* Charts */}
      <div className={`grid gap-6 mb-6 ${sectorData.length > 0 && typeData.length > 0 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>

        {sectorData.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4 font-semibold text-primary text-sm"><BarChart3 size={16} /><span>Sector Allocation</span></div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={sectorData} dataKey="value" cx="50%" cy="50%" outerRadius={80} {...pieStrokeProps(dark)}
                  activeIndex={sectorActiveIndex} activeShape={renderActivePieSector(dark)}
                  onMouseEnter={(_, i) => setSectorActiveIndex(i)}
                  onMouseLeave={() => setSectorActiveIndex(null)}
                  onClick={(_, i) => setSectorActiveIndex(prev => (prev === i ? null : i))}
                  style={{ cursor: 'pointer' }}>
                  {sectorData.map((s, i) => (
                    <Cell key={i} fill={pieColors(dark)[i % pieColors(dark).length]} fillOpacity={pieCellOpacity(sectorActiveIndex, i)} />
                  ))}
                </Pie>
                <Tooltip formatter={v => fmt(v)} contentStyle={pieTooltipStyle(dark)} itemStyle={pieTooltipItemStyle} labelStyle={pieTooltipLabelStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1">
              {sectorData.map((s, i) => (
                <div key={s.name} className="flex justify-between text-xs cursor-pointer"
                  style={{ opacity: pieCellOpacity(sectorActiveIndex, i) }}
                  onMouseEnter={() => setSectorActiveIndex(i)}
                  onMouseLeave={() => setSectorActiveIndex(null)}
                  onClick={() => setSectorActiveIndex(prev => (prev === i ? null : i))}>
                  <span className="flex items-center gap-1 min-w-0">
                    <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: pieColors(dark)[i % pieColors(dark).length] }} />
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
                <Pie data={typeData} dataKey="value" cx="50%" cy="50%" outerRadius={80} {...pieStrokeProps(dark)}
                  activeIndex={typeActiveIndex} activeShape={renderActivePieSector(dark)}
                  onMouseEnter={(_, i) => setTypeActiveIndex(i)}
                  onMouseLeave={() => setTypeActiveIndex(null)}
                  onClick={(_, i) => setTypeActiveIndex(prev => (prev === i ? null : i))}
                  style={{ cursor: 'pointer' }}>
                  {typeData.map((t, i) => (
                    <Cell key={i} fill={pieColors(dark)[(i + 4) % pieColors(dark).length]} fillOpacity={pieCellOpacity(typeActiveIndex, i)} />
                  ))}
                </Pie>
                <Tooltip formatter={v => fmt(v)} contentStyle={pieTooltipStyle(dark)} itemStyle={pieTooltipItemStyle} labelStyle={pieTooltipLabelStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1">
              {typeData.map((t, i) => (
                <div key={t.name} className="flex justify-between text-xs cursor-pointer"
                  style={{ opacity: pieCellOpacity(typeActiveIndex, i) }}
                  onMouseEnter={() => setTypeActiveIndex(i)}
                  onMouseLeave={() => setTypeActiveIndex(null)}
                  onClick={() => setTypeActiveIndex(prev => (prev === i ? null : i))}>
                  <span className="flex items-center gap-1 min-w-0">
                    <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: pieColors(dark)[(i + 4) % pieColors(dark).length] }} />
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
                      border:     activeType === t ? '1px solid var(--positive)' : '1px solid var(--card-border)',
                      background: activeType === t ? 'var(--positive-bg)'        : 'transparent',
                      color:      activeType === t ? 'var(--positive)'           : 'var(--text-muted)',
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
              <div className="mt-4 p-3 rounded-xl text-xs font-medium flex items-center gap-1.5" style={{ background: 'var(--negative-bg)', border: '1px solid var(--negative)', color: 'var(--negative)' }}>
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
