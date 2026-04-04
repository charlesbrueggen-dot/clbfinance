import Balance from './pages/Balance'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Income from './pages/Income'
import Expenses from './pages/Expenses'
import NetWorth from './pages/NetWorth'
import Accounts from './pages/Accounts'
import Investments from './pages/Investments'
import Import from './pages/Import'
import Analytics from './pages/Analytics'
import Goals from './pages/Goals'
import Loans from './pages/Loans'
import AICoach from './pages/AICoach'

export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen page-bg">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }}></div>
        <p className="text-muted text-sm">Loading...</p>
      </div>
    </div>
  )
  if (!user) return <Navigate to="/auth" replace />
  return children
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dark, setDark] = useState(() => localStorage.getItem('clb-dark') === 'true')

  useEffect(() => {
    if (dark) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    localStorage.setItem('clb-dark', dark)
  }, [dark])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={user && !loading ? <Navigate to="/" replace /> : <Auth />} />
          <Route path="/" element={
            <ProtectedRoute>
              <Layout dark={dark} setDark={setDark} />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="income" element={<Income />} />
            <Route path="expenses" element={<Expenses />} />
            <Route path="networth" element={<NetWorth />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="investments" element={<Investments />} />
            <Route path="import" element={<Import />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="goals" element={<Goals />} />
            <Route path="loans" element={<Loans />} />
            <Route path="balance" element={<Balance />} />
            <Route path="coach" element={<AICoach />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}
