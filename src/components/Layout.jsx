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
      <nav className="nav-bg sticky top-0 z-40" style={{ borderBottom: '1px solid var(--card-border)' }}>
        <div className="flex items-center justify-between px-4 h-14">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <img src="/logo.png" alt="Stride" className="w-10 h-10 object-contain" />
            <span className="font-black text-lg text-primary hidden sm:block tracking-tight">Stride</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.85)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"></span>
              Synced
            </div>
            <button onClick={() => setDark(!dark)}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors text-primary"
              style={{ background: 'rgba(255,255,255,0.1)' }}>
              {dark ? '☀' : '☾'}
            </button>
            <button onClick={() => setMenuOpen(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors text-primary"
              style={{ background: 'rgba(255,255,255,0.1)' }}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M2 5h14M2 10h14M2 15h14" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </nav>

      {/* SLIDE-OUT NAV MENU */}
      {menuOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm"></div>
          <div
            className="absolute inset-y-0 left-0 w-72 shadow-2xl flex flex-col"
            style={{ background: dark ? '#050505' : '#0f4a82' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
              <div className="flex items-center gap-2.5">
                <img src="/logo.png" alt="Stride" className="w-10 h-10 object-contain" />
                <span className="font-black text-white text-xl tracking-tight">Stride</span>
              </div>
              <button onClick={() => setMenuOpen(false)} className="text-white/50 hover:text-white text-xl">✕</button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 px-3">
              {NAV_ITEMS.map(item => {
                const active = location.pathname === item.path
                return (
                  <Link key={item.path} to={item.path} onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl mb-1 no-underline transition-colors"
                    style={{
                      background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
                      color: active ? 'white' : 'rgba(255,255,255,0.62)',
                      fontWeight: active ? 700 : 500,
                    }}>
                    <span className="text-lg w-6 text-center">{item.icon}</span>
                    <span className="text-sm">{item.label}</span>
                  </Link>
                )
              })}
            </nav>
            <div className="px-6 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
              <div className="text-xs text-white/35 mb-3 truncate">{user?.email}</div>
              <button onClick={handleSignOut}
                className="w-full py-2.5 rounded-xl text-sm font-bold transition-colors"
                style={{ color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
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
