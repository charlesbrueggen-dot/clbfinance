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

    let totalSynced = 0
    for (const enrollment of enrollments) {
      const result = await syncEnrollment(supabase, enrollment)
      totalSynced += result.synced
    }

    res.status(200).json({ synced: totalSynced, mock: isMockMode() })
  } catch (err) {
    console.error('teller/sync error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
