// api/plaid/sync-transactions.js
// Syncs accounts, transactions, and balances for every connected Plaid item
// belonging to a user. Triggered from the UI ("Sync All" / after connect);
// webhook.js runs the same _sync-core.js logic when Plaid pushes.
//
// POST body: { userId }
import { getServiceClient, verifyCaller } from './_supabase.js'
import { syncItem } from './_sync-core.js'
import { isMockMode } from './_plaid-client.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { userId } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId required' })
  if (!(await verifyCaller(req, userId))) {
    return res.status(401).json({ error: 'Not authenticated as this user' })
  }

  try {
    const supabase = getServiceClient()

    const { data: items, error: listErr } = await supabase
      .from('plaid_items')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'connected')
    if (listErr) throw listErr
    if (!items?.length) {
      return res.status(200).json({ synced: 0, message: 'No connected banks' })
    }

    // Each item is synced independently — one rate-limited or broken item
    // shouldn't block the others from syncing.
    let totalSynced = 0
    let anySkipped = false
    let rateLimitedMs = 0
    for (const item of items) {
      try {
        const result = await syncItem(supabase, item)
        totalSynced += result.synced
        if (result.skipped) anySkipped = true
      } catch (err) {
        if (err.rateLimited) {
          rateLimitedMs = Math.max(rateLimitedMs, 60_000)
          console.error(`plaid/sync: rate limited by Plaid on item ${item.id}`)
        } else {
          console.error(`plaid/sync: item ${item.id} failed:`, err.message)
        }
      }
    }

    if (rateLimitedMs > 0) {
      return res.status(429).json({
        error: 'Plaid rate limit reached — please wait before syncing again.',
        rateLimited: true,
        retryAfterMs: rateLimitedMs,
        synced: totalSynced,
      })
    }

    res.status(200).json({ synced: totalSynced, skipped: anySkipped, mock: isMockMode() })
  } catch (err) {
    console.error('plaid/sync error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
