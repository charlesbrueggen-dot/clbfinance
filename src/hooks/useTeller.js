// src/hooks/useTeller.js
// Handles all Teller frontend logic:
//   - Opening Teller Connect (bank connection flow)
//   - Syncing transactions
//   - Loading connected enrollments (banks)
//   - Disconnecting banks
//
// MOCK MODE: while VITE_TELLER_APPLICATION_ID is unset, connectBank() skips
// the Teller Connect popup and enrolls a realistic sample bank through the
// backend's mock mode, so the whole flow is testable with no credentials.
//
// TODO ── once your Teller account is approved, add to .env (and Vercel):
//   VITE_TELLER_APPLICATION_ID=app_xxxxxxxx   ← Teller dashboard → Application
//   VITE_TELLER_ENVIRONMENT=sandbox           ← 'sandbox' | 'development' | 'production'
// (plus the backend vars listed in api/teller/_teller-client.js)

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// TODO: these resolve to real values once the env vars above are set
const TELLER_APPLICATION_ID = import.meta.env.VITE_TELLER_APPLICATION_ID || null
const TELLER_ENVIRONMENT    = import.meta.env.VITE_TELLER_ENVIRONMENT || 'sandbox'
const MOCK_MODE             = !TELLER_APPLICATION_ID

export function useTeller(userId) {
  const [connectedItems, setConnectedItems] = useState([])
  const [syncing,        setSyncing]        = useState(false)
  const [connecting,     setConnecting]     = useState(false)
  const [syncResult,     setSyncResult]     = useState(null)  // { synced } | null
  const [error,          setError]          = useState('')
  const [tellerLoaded,   setTellerLoaded]   = useState(MOCK_MODE) // no script needed in mock mode

  // Load the Teller Connect script once (real mode only)
  useEffect(() => {
    if (MOCK_MODE) return
    if (window.TellerConnect) { setTellerLoaded(true); return }
    const script = document.createElement('script')
    script.src = 'https://cdn.teller.io/connect/connect.js'
    script.onload = () => setTellerLoaded(true)
    document.head.appendChild(script)
  }, [])

  // Load connected banks (teller_enrollments) for display
  const loadItems = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('teller_enrollments')
      .select('id, institution_name, institution_id, status, last_synced_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setConnectedItems(data || [])
  }, [userId])

  useEffect(() => { loadItems() }, [loadItems])

  // Send a successful Teller Connect enrollment to the backend, which stores
  // it and runs the initial account + transaction import
  const enrollWithBackend = async (payload) => {
    const res = await fetch('/api/teller/enroll', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId, ...payload }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to connect bank')
    return data
  }

  // ── Connect a new bank ────────────────────────────────────────────────────
  const connectBank = async () => {
    if (!userId || !tellerLoaded) return
    setConnecting(true)
    setError('')

    try {
      if (MOCK_MODE) {
        // No Teller credentials yet → backend substitutes sample enrollment data
        await enrollWithBackend({})
      } else {
        // Real Teller Connect flow. onSuccess hands over the access token
        // directly — no separate token-exchange step like Plaid.
        await new Promise((resolve, reject) => {
          const connect = window.TellerConnect.setup({
            applicationId: TELLER_APPLICATION_ID,
            environment:   TELLER_ENVIRONMENT,
            products:      ['transactions'],
            onSuccess: async (enrollment) => {
              try {
                resolve(await enrollWithBackend({
                  accessToken:     enrollment.accessToken,
                  enrollmentId:    enrollment.enrollment?.id,
                  institutionName: enrollment.enrollment?.institution?.name,
                }))
              } catch (err) { reject(err) }
            },
            onExit:    () => resolve(null),
            onFailure: (failure) => reject(new Error(failure?.message || 'Teller Connect failed')),
          })
          connect.open()
        })
      }
      await loadItems()
    } catch (err) {
      setError(err.message || 'Failed to connect bank')
    } finally {
      setConnecting(false)
    }
  }

  // ── Sync transactions for all connected banks ─────────────────────────────
  const syncTransactions = async () => {
    if (!userId) return
    setSyncing(true)
    setSyncResult(null)
    setError('')

    try {
      const res = await fetch('/api/teller/sync-transactions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      setSyncResult(data)
      await loadItems()
    } catch (err) {
      setError(err.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  // ── Disconnect a bank ─────────────────────────────────────────────────────
  const disconnectBank = async (enrollmentId) => {
    if (!confirm('Disconnect this bank? Your transaction history will be kept.')) return
    setError('')
    try {
      const res = await fetch('/api/teller/disconnect', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId, enrollmentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect')
      await loadItems()
    } catch (err) {
      setError(err.message || 'Failed to disconnect bank')
    }
  }

  return {
    connectedItems,
    syncing,
    connecting,
    syncResult,
    error,
    tellerLoaded,
    mockMode: MOCK_MODE,
    connectBank,
    syncTransactions,
    disconnectBank,
    loadItems,
  }
}
