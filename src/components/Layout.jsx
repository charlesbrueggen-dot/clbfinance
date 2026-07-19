import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import {
  LayoutDashboard, Sparkle, ArrowUpRight, ArrowDownRight, DollarSign,
  Landmark, PieChart, BarChart3, Target, HandCoins, Repeat, Moon, Sun, X,
  LogOut, MoreHorizontal,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

// Grouped navigation — every route keeps working, they're just organized by intent.
const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { path: '/', label: 'Dashboard', Icon: LayoutDashboard },
      { path: '/networth', label: 'Net Worth', Icon: DollarSign },
      { path: '/analytics', label: 'Analytics', Icon: BarChart3 },
    ],
  },
  {
    title: 'Money',
    items: [
      { path: '/accounts', label: 'Accounts & Cards', Icon: Landmark },
      { path: '/income', label: 'Income', Icon: ArrowUpRight },
      { path: '/expenses', label: 'Expenses', Icon: ArrowDownRight },
      { path: '/subscriptions', label: 'Subscriptions', Icon: Repeat },
    ],
  },
  {
    title: 'Planning',
    items: [
      { path: '/goals', label: 'Goals & Budgets', Icon: Target },
      { path: '/investments', label: 'Investments', Icon: PieChart },
      { path: '/loans', label: 'Loans & Debts', Icon: HandCoins },
    ],
  },
]

// Mobile bottom bar: the four most-used destinations + a "More" sheet with the rest.
const BOTTOM_ITEMS = [
  { path: '/', label: 'Home', Icon: LayoutDashboard },
  { path: '/accounts', label: 'Accounts', Icon: Landmark },
  { path: '/coach', label: 'Coach', Icon: Sparkle },
  { path: '/analytics', label: 'Analytics', Icon: BarChart3 },
]

const MORE_ITEMS = [
  { path: '/income', label: 'Income', Icon: ArrowUpRight },
  { path: '/expenses', label: 'Expenses', Icon: ArrowDownRight },
  { path: '/networth', label: 'Net Worth', Icon: DollarSign },
  { path: '/goals', label: 'Goals & Budgets', Icon: Target },
  { path: '/investments', label: 'Investments', Icon: PieChart },
  { path: '/subscriptions', label: 'Subscriptions', Icon: Repeat },
  { path: '/loans', label: 'Loans & Debts', Icon: HandCoins },
]

function Logo({ dark, size = 36 }) {
  return <img src={dark ? '/logo-dark.png' : '/logo.png'} alt="Stride" style={{ width: size, height: size }} className="object-contain" />
}

export default function Layout({ dark, setDark }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Close the "More" sheet whenever the route changes
  useEffect(() => { setMoreOpen(false) }, [location.pathname])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  const isActive = path => location.pathname === path
  const onCoach = location.pathname === '/coach'
  // Highlight "More" when the current page lives inside the sheet
  const moreActive = MORE_ITEMS.some(i => isActive(i.path))

  return (
    <div className="min-h-screen page-bg">

      {/* ══════════ DESKTOP SIDEBAR (lg and up) ══════════ */}
      <aside
        className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-64 z-40 nav-bg"
        style={{ borderRight: '1px solid var(--card-border)' }}
      >
        <Link to="/" className="flex items-center gap-2.5 no-underline px-5 pt-5 pb-4">
          <Logo dark={dark} size={40} />
          <span className="font-black text-xl text-primary tracking-tight">Stride</span>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {NAV_SECTIONS.map(section => (
            <div key={section.title}>
              <p className="nav-section-title">{section.title}</p>
              {section.items.map(item => (
                <Link key={item.path} to={item.path}
                  className={`nav-item mb-0.5 ${isActive(item.path) ? 'nav-item-active' : ''}`}>
                  <item.Icon size={17} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          ))}

          {/* AI Coach — pinned callout */}
          <Link to="/coach" className="no-underline block mt-5">
            <div
              className="rounded-2xl p-3.5 transition-transform hover:-translate-y-0.5"
              style={{
                background: dark
                  ? 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)'
                  : 'linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.1) 100%)',
                border: onCoach
                  ? (dark ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.7)')
                  : (dark ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.35)'),
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: dark ? '#10b981' : 'rgba(255,255,255,0.9)', color: dark ? '#000' : '#1a5a94' }}>
                  <Sparkle size={16} />
                </div>
                <div className="min-w-0">
                  <p className="font-black text-xs" style={{ color: dark ? '#10b981' : '#fff' }}>Stride Coach</p>
                  <p className="text-xs truncate" style={{ color: dark ? '#34d399' : 'rgba(255,255,255,0.7)' }}>
                    Ask your AI coach
                  </p>
                </div>
              </div>
            </div>
          </Link>
        </nav>

        {/* Sidebar footer: theme, account, sign out */}
        <div className="px-4 py-4" style={{ borderTop: '1px solid var(--card-border)' }}>
          <button onClick={() => setDark(!dark)}
            className="nav-item w-full mb-1" style={{ background: 'var(--nav-soft)' }}>
            {dark ? <Sun size={16} /> : <Moon size={16} />}
            <span>{dark ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <div className="flex items-center justify-between gap-2 mt-2 px-1">
            <p className="text-xs text-muted truncate">{user?.email}</p>
            <button onClick={handleSignOut} title="Sign out"
              className="text-muted hover:text-primary transition-colors flex-shrink-0 p-1.5 rounded-lg">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ══════════ MOBILE TOP BAR (below lg) ══════════ */}
      <nav className="lg:hidden nav-bg sticky top-0 z-40" style={{ borderBottom: '1px solid var(--card-border)' }}>
        <div className="flex items-center justify-between px-4 h-14">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <Logo dark={dark} size={36} />
            <span className="font-black text-lg text-primary tracking-tight">Stride</span>
          </Link>
          <div className="flex items-center gap-2">
            <button onClick={() => setDark(!dark)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-primary"
              style={{ background: 'var(--nav-soft)' }}>
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button onClick={() => setMoreOpen(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-primary"
              style={{ background: 'var(--nav-soft)' }}>
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>
      </nav>

      {/* ══════════ MOBILE "MORE" SHEET ══════════ */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm"></div>
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-3xl max-h-[85vh] overflow-y-auto"
            style={{ background: 'var(--modal-bg)', borderTop: '1px solid var(--card-border)', animation: 'modal-pop 0.25s ease' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <div className="flex items-center gap-2.5">
                <Logo dark={dark} size={32} />
                <span className="font-black text-primary text-lg tracking-tight">Stride</span>
              </div>
              <button onClick={() => setMoreOpen(false)} className="text-muted hover:text-primary"><X size={22} /></button>
            </div>
            <div className="px-4 pb-3 grid grid-cols-2 gap-2">
              {MORE_ITEMS.map(item => (
                <Link key={item.path} to={item.path}
                  className={`nav-item ${isActive(item.path) ? 'nav-item-active' : ''}`}
                  style={{ border: '1px solid var(--card-border)' }}>
                  <item.Icon size={17} />
                  <span className="text-sm">{item.label}</span>
                </Link>
              ))}
            </div>
            <div className="px-6 py-4 flex items-center justify-between gap-3" style={{ borderTop: '1px solid var(--card-border)' }}>
              <p className="text-xs text-muted truncate">{user?.email}</p>
              <button onClick={handleSignOut}
                className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl flex-shrink-0"
                style={{ color: 'var(--negative)', background: 'var(--negative-bg)' }}>
                <LogOut size={14} /> Sign Out
              </button>
            </div>
            <div style={{ height: 'env(safe-area-inset-bottom)' }} />
          </div>
        </div>
      )}

      {/* ══════════ MOBILE BOTTOM NAV ══════════ */}
      <div className="bottomnav lg:hidden">
        {BOTTOM_ITEMS.map(item => {
          const active = isActive(item.path)
          const coach = item.path === '/coach'
          return (
            <Link key={item.path} to={item.path}
              className={`bottomnav-item ${active ? 'bottomnav-item-active' : ''}`}>
              <span className={coach ? 'flex items-center justify-center rounded-full' : ''}
                style={coach ? {
                  width: 34, height: 34, marginTop: -14,
                  background: dark ? '#10b981' : 'rgba(255,255,255,0.92)',
                  color: dark ? '#000' : '#1a5a94',
                  border: dark ? '2px solid #064e3b' : '2px solid rgba(255,255,255,0.5)',
                  boxShadow: '0 4px 14px var(--shadow-color)',
                } : undefined}>
                <item.Icon size={coach ? 17 : 19} />
              </span>
              <span>{item.label}</span>
            </Link>
          )
        })}
        <button onClick={() => setMoreOpen(true)}
          className={`bottomnav-item ${moreActive ? 'bottomnav-item-active' : ''}`}>
          <MoreHorizontal size={19} />
          <span>More</span>
        </button>
      </div>

      {/* ══════════ PAGE CONTENT ══════════ */}
      <main className="lg:pl-64">
        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto pb-24 lg:pb-8">
          <div className="page-enter" key={location.pathname}>
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  )
}
