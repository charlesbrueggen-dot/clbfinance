import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, createContext, useContext, lazy, Suspense } from 'react'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Auth from './pages/Auth'
import { TransactionProvider } from './hooks/useTransactions'

// Route-level code-splitting: each page ships as its own chunk, loaded on first visit
// instead of all bundling into one ~1.4MB file every visitor downloads up front.
const Dashboard         = lazy(() => import('./pages/Dashboard'))
const Income            = lazy(() => import('./pages/Income'))
const Expenses           = lazy(() => import('./pages/Expenses'))
const NetWorth           = lazy(() => import('./pages/NetWorth'))
const Accounts           = lazy(() => import('./pages/Accounts'))
const UnderConstruction  = lazy(() => import('./pages/UnderConstruction'))
const Investments        = lazy(() => import('./pages/Investments'))
const Import             = lazy(() => import('./pages/Import'))
const Analytics          = lazy(() => import('./pages/Analytics'))
const Goals              = lazy(() => import('./pages/Goals'))
const Budgets            = lazy(() => import('./pages/Budgets'))
const Loans              = lazy(() => import('./pages/Loans'))
const Subscriptions      = lazy(() => import('./pages/Subscriptions'))
const AICoach            = lazy(() => import('./pages/AICoach'))
const Success            = lazy(() => import('./pages/success'))
const Cancel             = lazy(() => import('./pages/cancel'))

export const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen page-bg">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }}></div>
        <p className="text-muted text-sm">Loading...</p>
      </div>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/auth" replace />
  return children
}

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dark, setDark] = useState(() => localStorage.getItem('stride-dark') === 'true')

  useEffect(() => {
    if (dark) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
    localStorage.setItem('stride-dark', dark)
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
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/auth" element={user && !loading ? <Navigate to="/" replace /> : <Auth />} />

            {/* Payment result pages — outside Layout so no nav/sidebar */}
            <Route path="/success" element={<ProtectedRoute><Success /></ProtectedRoute>} />
            <Route path="/cancel" element={<ProtectedRoute><Cancel /></ProtectedRoute>} />

            <Route path="/" element={
              <ProtectedRoute>
                <TransactionProvider userId={user?.id}>
                  <Layout dark={dark} setDark={setDark} />
                </TransactionProvider>
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="income" element={<Income />} />
              <Route path="expenses" element={<Expenses />} />
              <Route path="networth" element={<NetWorth />} />
              {/* Gated behind UnderConstruction — see src/pages/UnderConstruction.jsx
                  for how to remove this gate later. Accounts itself is untouched. */}
              <Route path="accounts" element={<UnderConstruction><Accounts /></UnderConstruction>} />
              <Route path="investments" element={<Investments />} />
              <Route path="import" element={<Import />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="goals" element={<Goals />} />
              <Route path="budgets" element={<Budgets />} />
              <Route path="loans" element={<Loans />} />
              <Route path="subscriptions" element={<Subscriptions />} />
              <Route path="coach" element={<AICoach />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthContext.Provider>
  )
}
