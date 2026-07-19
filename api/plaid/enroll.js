// api/plaid/enroll.js
// Handles both halves of the Plaid Link flow:
//   1. { mode: 'create_link_token', userId } — called before opening Plaid
//      Link. Returns a link_token for the frontend to hand to Plaid.create().
//   2. { mode: 'exchange', userId, publicToken, institutionId?, institutionName? }
//      — called after Plaid Link's onSuccess. Exchanges the public_token for
//      an access_token, stores the item, and runs the initial sync.
//
// Unlike Teller (where Connect's onSuccess handed over a ready-to-use access
// token directly), Plaid never gives the frontend anything long-lived — the
// server-side exchange is mandatory.
//
// In mock mode the Plaid fields are optional for both modes — sample values
// are substituted so the flow can be exercised with no credentials at all.
import { getServiceClient, verifyCaller } from './_supabase.js'
import { syncItem } from './_sync-core.js'
import { createLinkToken, exchangePublicToken, isMockMode } from './_plaid-client.js'
import { mockItem } from './_mock-data.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { mode, userId } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId required' })
  if (!(await verifyCaller(req, userId))) {
    return res.status(401).json({ error: 'Not authenticated as this user' })
  }

  if (mode === 'create_link_token') {
    try {
      const { link_token } = await createLinkToken({
        userId,
        webhookUrl: process.env.PLAID_WEBHOOK_URL || undefined,
      })
      return res.status(200).json({ linkToken: link_token, mock: isMockMode() })
    } catch (err) {
      console.error('plaid/enroll (create_link_token) error:', err.message)
      return res.status(500).json({ error: err.message })
    }
  }

  if (mode === 'exchange') {
    let { publicToken, institutionId, institutionName } = req.body || {}

    if (isMockMode()) {
      const mock = mockItem()
      publicToken     = publicToken     || mock.publicToken
      institutionName = institutionName || mock.institution.name
      institutionId   = institutionId   || mock.institution.institution_id
    }
    if (!publicToken) return res.status(400).json({ error: 'publicToken required' })

    try {
      const supabase = getServiceClient()
      const { access_token, item_id } = await exchangePublicToken(publicToken)

      const { data: item, error: itemErr } = await supabase
        .from('plaid_items')
        .upsert({
          user_id:          userId,
          item_id,
          access_token,
          institution_id:   institutionId || null,
          institution_name: institutionName || null,
          status:           'connected',
        }, { onConflict: 'user_id,item_id' })
        .select()
        .single()
      if (itemErr) throw itemErr

      // Initial import: accounts + transactions + balances in one go
      let result
      try {
        result = await syncItem(supabase, item)
      } catch (err) {
        if (err.rateLimited) {
          // The item itself is saved above, so the user isn't stuck — only
          // the first data pull is delayed. Ack with 429 so the frontend
          // extends its own cooldown instead of retrying immediately.
          console.error('plaid/enroll: rate limited by Plaid during initial sync:', err.message)
          return res.status(429).json({
            error: 'Bank connected, but Plaid rate-limited the initial sync — try Sync in a minute.',
            rateLimited: true,
            retryAfterMs: 60_000,
            itemId: item.id,
          })
        }
        throw err
      }

      res.status(200).json({
        success: true,
        itemId: item.id,
        accountCount: result.accounts,
        synced: result.synced,
        skipped: result.skipped,
        mock: isMockMode(),
      })
    } catch (err) {
      console.error('plaid/enroll (exchange) error:', err.message)
      res.status(500).json({ error: err.message })
    }
    return
  }

  res.status(400).json({ error: "mode must be 'create_link_token' or 'exchange'" })
}
