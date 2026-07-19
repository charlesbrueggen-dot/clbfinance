// src/hooks/usePlaid.js
// Handles all Plaid frontend logic:
//   - Opening Plaid Link (bank connection flow)
//   - Syncing transactions
//   - Loading connected banks (plaid_items)
//   - Disconnecting banks
//
// MOCK MODE: unlike Teller (which used a client-side env var), mock mode is
// determined by the backend — the first thing this hook does is ask
// /api/plaid/enroll for a link token, and the response's `mock` flag says
// whether PLAID_CLIENT_ID/PLAID_SECRET are configured server-side. This
// keeps mock-mode detection in one place (the server) instead of needing a
// client env var kept in sync with the backend one.
//
// TODO ── once your Plaid account is approved (sandbox is instant/self-serve
// — no approval wait like Teller), set the backend vars listed in
// api/plaid/_plaid-client.js. No client-side env var is needed for Plaid
// Link itself — it only ever uses the server-issued link token.

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase, authHeader } from '../lib/supabase'

const PLAID_LINK_SCRIPT_SRC = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'

// Must match (or exceed) SYNC_COOLDOWN_MS in api/plaid/_sync-core.js. The
// backend is the real enforcement (this can't be bypassed by calling the API
// directly) — this constant just keeps the button's disabled/countdown state
// in sync with what the backend will actually allow, so users aren't shown a
// misleading "ready" button that then fails.
const SYNC_COOLDOWN_MS = 30_000

export function usePlaid(userId) {
  const [connectedItems, setConnectedItems] = useState([])
  const [syncing,        setSyncing]        = useState(false)
  const [connecting,     setConnecting]     = useState(false)
  const [syncResult,     setSyncResult]     = useState(null)  // { synced } | null
  const [error,          setError]          = useState('')
  const [mockMode,       setMockMode]       = useState(true)  // corrected once the server responds
  const [linkToken,      setLinkToken]      = useState(null)
  const [plaidLoaded,    setPlaidLoaded]    = useState(false) // Plaid Link script (real mode only)
  const [cooldownUntil,  setCooldownUntil]  = useState(0)     // epoch ms, 0 = no cooldown
  const [nowTick,        setNowTick]        = useState(Date.now())
  const linkHandleRef = useRef(null)

  // Ticks once/sec only while a cooldown is active, purely to refresh the
  // countdown display shown on the sync button — never touches the network.
  useEffect(() => {
    if (cooldownUntil <= Date.now()) return
    const id = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [cooldownUntil])

  // Ask the backend for a link token (also tells us whether we're in mock
  // mode) as soon as we have a user. Harmless/free to call even if the user
  // never opens Connect Bank — see the /link/token/create cost manifest note
  // in api/plaid/_plaid-client.js.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/plaid/enroll', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
          body:    JSON.stringify({ mode: 'create_link_token', userId }),
        })
        const data = await res.json()
        if (cancelled) return
        setMockMode(!!data.mock)
        setLinkToken(data.linkToken || null)
        if (!data.mock && !window.Plaid) {
          const script = document.createElement('script')
          script.src = PLAID_LINK_SCRIPT_SRC
          script.onload = () => { if (!cancelled) setPlaidLoaded(true) }
          document.head.appendChild(script)
        } else if (!data.mock) {
          setPlaidLoaded(true)
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to reach Plaid')
      }
    })()
    return () => { cancelled = true }
  }, [userId])

  // Load connected banks (plaid_items) for display
  const loadItems = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('plaid_items')
      .select('id, institution_name, institution_id, status, last_synced_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setConnectedItems(data || [])

    // Re-derive the cooldown from the DB's last_synced_at (not just local
    // component state) so it survives page refreshes and multiple tabs — a
    // purely in-memory timer would reset the moment the page reloads.
    const latestSync = (data || []).reduce((max, item) => {
      const t = item.last_synced_at ? new Date(item.last_synced_at).getTime() : 0
      return Math.max(max, t)
    }, 0)
    if (latestSync) setCooldownUntil(prev => Math.max(prev, latestSync + SYNC_COOLDOWN_MS))
  }, [userId])

  useEffect(() => { loadItems() }, [loadItems])

  const cooldownSecondsLeft = Math.max(0, Math.ceil((cooldownUntil - nowTick) / 1000))
  const canSync = cooldownSecondsLeft === 0

  // If the backend reports it's rate-limited by Plaid, or that it skipped a
  // sync because of its own cooldown, extend our cooldown to match so the
  // button doesn't invite another request that would just get rejected again.
  const applyServerCooldown = (data) => {
    if (data?.rateLimited) {
      setCooldownUntil(Date.now() + (data.retryAfterMs || 60_000))
    } else if (data?.skipped) {
      setCooldownUntil(Date.now() + SYNC_COOLDOWN_MS)
    }
  }

  // Send a successful Plaid Link exchange (or, in mock mode, an empty
  // payload) to the backend, which exchanges/stores it and runs the initial
  // account + transaction import.
  const exchangeWithBackend = async (payload) => {
    const res = await fetch('/api/plaid/enroll', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body:    JSON.stringify({ mode: 'exchange', userId, ...payload }),
    })
    const data = await res.json()
    applyServerCooldown(data)
    if (!res.ok) throw new Error(data.error || 'Failed to connect bank')
    return data
  }

  // ── Connect a new bank ────────────────────────────────────────────────────
  const connectBank = async () => {
    if (!userId) return
    setConnecting(true)
    setError('')

    try {
      if (mockMode) {
        // No Plaid credentials yet → backend substitutes sample item data
        await exchangeWithBackend({})
      } else {
        if (!plaidLoaded || !linkToken) throw new Error('Plaid Link is not ready yet — try again in a moment.')
        await new Promise((resolve, reject) => {
          linkHandleRef.current = window.Plaid.create({
            token: linkToken,
            onSuccess: async (publicToken, metadata) => {
              try {
                resolve(await exchangeWithBackend({
                  publicToken,
                  institutionId:   metadata?.institution?.institution_id,
                  institutionName: metadata?.institution?.name,
                }))
              } catch (err) { reject(err) }
            },
            onExit:  (err) => (err ? reject(new Error(err.error_message || 'Plaid Link failed')) : resolve(null)),
          })
          linkHandleRef.current.open()
        })
      }
      await loadItems()
      setCooldownUntil(Date.now() + SYNC_COOLDOWN_MS)
    } catch (err) {
      setError(err.message || 'Failed to connect bank')
    } finally {
      setConnecting(false)
    }
  }

  // ── Sync transactions for all connected banks ─────────────────────────────
  // Guarded by canSync (cooldown) in addition to the syncing in-flight flag,
  // so rapid re-clicks can't queue up back-to-back Plaid calls even if a
  // click sneaks in right as the previous request resolves.
  const syncTransactions = async () => {
    if (!userId || syncing || !canSync) return
    setSyncing(true)
    setSyncResult(null)
    setError('')

    try {
      const res = await fetch('/api/plaid/sync-transactions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body:    JSON.stringify({ userId }),
      })
      const data = await res.json()
      applyServerCooldown(data)
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      setSyncResult(data)
      setCooldownUntil(Date.now() + SYNC_COOLDOWN_MS)
      await loadItems()
    } catch (err) {
      setError(err.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  // ── Disconnect a bank ─────────────────────────────────────────────────────
  const disconnectBank = async (itemId) => {
    if (!confirm('Disconnect this bank? Your transaction history will be kept.')) return
    setError('')
    try {
      const res = await fetch('/api/plaid/disconnect', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body:    JSON.stringify({ userId, itemId }),
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
    plaidLoaded,
    mockMode,
    canSync,
    cooldownSecondsLeft,
    connectBank,
    syncTransactions,
    disconnectBank,
    loadItems,
  }
}
