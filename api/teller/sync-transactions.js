// api/teller/sync-transactions.js
// Syncs accounts, transactions, and balances for every connected Teller
// enrollment belonging to a user. Triggered from the UI ("Sync All" / after
// connect); webhook.js runs the same _sync-core.js logic when Teller pushes.
//
// POST body: { userId }
import { getServiceClient } from './_supabase.js'
import { syncEnrollment } from './_sync-core.js'
import { isMockMode } from './_teller-client.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { userId } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId required' })

  try {
    const supabase = getServiceClient()

    const { data: enrollments, error: listErr } = await supabase
      .from('teller_enrollments')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'connected')
    if (listErr) throw listErr
    if (!enrollments?.length) {
      return res.status(200).json({ synced: 0, message: 'No connected banks' })
    }

    // Each enrollment is synced independently — one rate-limited or broken
    // enrollment shouldn't block the others from syncing.
    let totalSynced = 0
    let anySkipped = false
    let rateLimitedMs = 0
    for (const enrollment of enrollments) {
      try {
        const result = await syncEnrollment(supabase, enrollment)
        totalSynced += result.synced
        if (result.skipped) anySkipped = true
      } catch (err) {
        if (err.rateLimited) {
          rateLimitedMs = Math.max(rateLimitedMs, (err.retryAfterSeconds || 60) * 1000)
          console.error(`teller/sync: rate limited by Teller on enrollment ${enrollment.id}`)
        } else {
          console.error(`teller/sync: enrollment ${enrollment.id} failed:`, err.message)
        }
      }
    }

    if (rateLimitedMs > 0) {
      return res.status(429).json({
        error: 'Teller rate limit reached — please wait before syncing again.',
        rateLimited: true,
        retryAfterMs: rateLimitedMs,
        synced: totalSynced,
      })
    }

    res.status(200).json({ synced: totalSynced, skipped: anySkipped, mock: isMockMode() })
  } catch (err) {
    console.error('teller/sync error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
