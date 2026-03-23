import { useState } from 'react'
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '⊞' },
  { path: '/income', label: 'Income', icon: '↗' },
  { path: '/expenses', label: 'Expenses', icon: '↘' },
  { path: '/networth', label: 'Net Worth', icon: '$' },
  { path: '/accounts', label: 'Accounts', icon: '🏛' },
  { path: '/investments', label: 'Investments', icon: '◔' },
  { path: '/import', label: 'Import', icon: '↓' },
  { path: '/analytics', label: 'Analytics', icon: '◑' },
  { path: '/goals', label: 'Goals', icon: '◎' },
  { path: '/loans', label: 'Loans & Debts', icon: '⊕' },
]

export default function Layout({ dark, setDark }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  return (
    <div className="min-h-screen page-bg">
      {/* TOP NAV */}
      <nav className="nav-bg border-b sticky top-0 z-40" style={{ borderColor: 'var(--card-border)' }}>
        <div className="flex items-center justify-between px-4 h-14">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-bold text-lg">$</div>
            <span className="font-bold text-lg text-primary hidden sm:block">CLB Finance</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs font-semibold text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              Synced
            </div>
            <button
              onClick={() => setDark(!dark)}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              {dark ? '☀' : '☾'}
            </button>
            <button
              onClick={() => setMenuOpen(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              style={{ color: 'var(--text-primary)' }}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h14M3 12h14M3 18h14" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* SLIDE-OUT NAV MENU */}
      {menuOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
          <div
            className="absolute inset-y-0 left-0 w-72 shadow-2xl flex flex-col"
            style={{ background: '#0f172a' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-bold">$</div>
                <span className="font-bold text-white text-lg">CLB Finance</span>
              </div>
              <button onClick={() => setMenuOpen(false)} className="text-white/60 hover:text-white text-xl">✕</button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 px-3">
              {NAV_ITEMS.map(item => {
                const active = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl mb-1 no-underline transition-colors"
                    style={{
                      background: active ? 'rgba(16,185,129,0.2)' : 'transparent',
                      color: active ? '#10b981' : 'rgba(255,255,255,0.7)',
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    <span className="text-lg w-6 text-center">{item.icon}</span>
                    <span className="text-sm">{item.label}</span>
                  </Link>
                )
              })}
            </nav>
            <div className="px-6 py-4 border-t border-white/10">
              <div className="text-xs text-white/40 mb-3 truncate">{user?.email}</div>
              <button
                onClick={handleSignOut}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-red-400 border border-red-400/30 hover:bg-red-400/10 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAGE CONTENT */}
      <main className="p-4 sm:p-6 max-w-5xl mx-auto">
        <Outlet />
      </main>
    </div>
  )
}
