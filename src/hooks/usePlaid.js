// src/hooks/usePlaid.js
// Handles all Plaid frontend logic:
//   - Opening Plaid Link (bank connection flow)
//   - Syncing transactions
//   - Loading connected institutions
//   - Disconnecting banks

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function usePlaid(userId) {
  const [connectedItems, setConnectedItems] = useState([])
  const [syncing,        setSyncing]        = useState(false)
  const [connecting,     setConnecting]     = useState(false)
  const [syncResult,     setSyncResult]     = useState(null)  // { synced, removed } | null
  const [error,          setError]          = useState('')
  const [plaidLoaded,    setPlaidLoaded]    = useState(false)

  // Load Plaid Link script once
  useEffect(() => {
    if (window.Plaid) { setPlaidLoaded(true); return }
    const script = document.createElement('script')
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'
    script.onload = () => setPlaidLoaded(true)
    document.head.appendChild(script)
  }, [])

  // Load connected institutions (plaid_items) for display
  const loadItems = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('plaid_items')
      .select('id, institution_name, institution_id, last_synced_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setConnectedItems(data || [])
  }, [userId])

  useEffect(() => { loadItems() }, [loadItems])

  // ── Connect a new bank ────────────────────────────────────────────────────
  const connectBank = async () => {
    if (!userId || !plaidLoaded) return
    setConnecting(true)
    setError('')

    try {
      // 1. Get a link token from our backend
      const ltRes = await fetch('/api/plaid/create-link-token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId }),
      })
      const ltData = await ltRes.json()
      if (!ltRes.ok) throw new Error(ltData.error || 'Failed to create link token')

      // 2. Open Plaid Link
      await new Promise((resolve, reject) => {
        const handler = window.Plaid.create({
          token:     ltData.link_token,
          onSuccess: async (publicToken, metadata) => {
            try {
              const exRes = await fetch('/api/plaid/exchange-token', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({
                  publicToken,
                  userId,
                  institutionId:   metadata.institution?.institution_id,
                  institutionName: metadata.institution?.name,
                }),
              })
              const exData = await exRes.json()
              if (!exRes.ok) throw new Error(exData.error || 'Failed to connect bank')
              resolve(exData)
            } catch (err) { reject(err) }
          },
          onExit: (err) => {
            if (err) reject(new Error(err.error_message || 'Plaid Link exited'))
            else     resolve(null)
          },
        })
        handler.open()
      })

      // 3. Auto-sync after connecting
      await syncTransactions()
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
      const res = await fetch('/api/plaid/sync-transactions', {
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
  const disconnectBank = async (itemId) => {
    if (!confirm('Disconnect this bank? Your transaction history will be kept.')) return
    setError('')
    try {
      const res = await fetch('/api/plaid/disconnect', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
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
    connectBank,
    syncTransactions,
    disconnectBank,
    loadItems,
  }
}
