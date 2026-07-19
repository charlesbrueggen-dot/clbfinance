// api/plaid/disconnect.js
// Disconnects a Plaid item: revokes API access on Plaid's side, unlinks the
// local accounts, and removes the stored access token. Transaction history
// is kept.
//
// Simpler than Teller's disconnect: Plaid's access_token is per Item (one
// bank login covering every account under it), so a single /item/remove
// call revokes everything at once — no per-account loop, no partial-failure
// bookkeeping needed.
//
// POST body: { userId, itemId }  (itemId = plaid_items.id)
import { getServiceClient, verifyCaller } from './_supabase.js'
import { removeItem } from './_plaid-client.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { userId, itemId } = req.body || {}
  if (!userId || !itemId) return res.status(400).json({ error: 'userId and itemId required' })
  if (!(await verifyCaller(req, userId))) {
    return res.status(401).json({ error: 'Not authenticated as this user' })
  }

  try {
    const supabase = getServiceClient()

    const { data: item, error: findErr } = await supabase
      .from('plaid_items')
      .select('*')
      .eq('id', itemId)
      .eq('user_id', userId)
      .single()
    if (findErr || !item) return res.status(404).json({ error: 'Item not found' })

    try {
      await removeItem(item.access_token)
    } catch (err) {
      // 400 ITEM_NOT_FOUND = Plaid already has no record of this item —
      // nothing left to revoke, safe to proceed with local cleanup.
      if (err.errorCode !== 'ITEM_NOT_FOUND') {
        console.error(`plaid/disconnect: failed to revoke item ${item.item_id}:`, err.message)
        return res.status(502).json({ error: `Could not disconnect on Plaid's side: ${err.message}. Try again.` })
      }
    }

    await supabase
      .from('accounts')
      .update({ plaid_account_id: null, plaid_item_id: null, sync_status: 'manual' })
      .eq('plaid_item_id', itemId)
      .eq('user_id', userId)

    const { error: delErr } = await supabase
      .from('plaid_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', userId)
    if (delErr) throw delErr

    res.status(200).json({ success: true })
  } catch (err) {
    console.error('plaid/disconnect error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
