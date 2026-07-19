// api/plaid/webhook.js
// Receives webhooks from Plaid (configure the URL in the Plaid dashboard, or
// set PLAID_WEBHOOK_URL so enroll.js registers it at link-token creation:
// https://<your-domain>/api/plaid/webhook).
//
// Handled events:
//   TRANSACTIONS / SYNC_UPDATES_AVAILABLE  → new transaction data ready → re-sync item
//   ITEM / ERROR                            → item broke (e.g. login invalidated) →
//                                              mark item disconnected
//
// TODO: once PLAID_CLIENT_ID/PLAID_SECRET are set, real webhooks will start
// arriving and get verified via verifyWebhookSignature() in
// _plaid-client.js (JWT/ES256, per Plaid's webhook verification docs). Until
// then, requests are only accepted in mock mode.
import { getServiceClient } from './_supabase.js'
import { syncItem } from './_sync-core.js'
import { verifyWebhookSignature } from './_plaid-client.js'

// Body parsing is disabled so the raw payload is available for JWT
// signature verification (parsing + re-stringifying would corrupt it).
export const config = { api: { bodyParser: false } }

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const rawBody = await readRawBody(req)

    if (!(await verifyWebhookSignature(rawBody, req.headers['plaid-verification']))) {
      return res.status(401).json({ error: 'Invalid webhook signature' })
    }

    const event = JSON.parse(rawBody)
    const webhookType = event.webhook_type
    const webhookCode = event.webhook_code
    const plaidItemId = event.item_id

    const supabase = getServiceClient()
    const { data: item } = plaidItemId
      ? await supabase
          .from('plaid_items')
          .select('*')
          .eq('item_id', plaidItemId)
          .maybeSingle()
      : { data: null }

    if (!item) {
      // Unknown item — ack anyway so Plaid doesn't retry forever
      console.warn(`plaid/webhook: no item found for ${plaidItemId} (${webhookType}/${webhookCode})`)
      return res.status(200).json({ received: true })
    }

    if (webhookType === 'TRANSACTIONS' && webhookCode === 'SYNC_UPDATES_AVAILABLE') {
      try {
        const result = await syncItem(supabase, item)
        return res.status(200).json({ received: true, synced: result.synced, skipped: result.skipped })
      } catch (err) {
        // Ack with 200 anyway — a 5xx/429 here would make Plaid retry the
        // webhook delivery, which would just re-trigger the same (possibly
        // still rate-limited) sync again. The next legitimate webhook or
        // manual sync will pick up whatever this attempt missed.
        console.error(`plaid/webhook: sync failed for item ${item.id}:`, err.message)
        return res.status(200).json({ received: true, synced: 0, error: err.message })
      }
    }

    if (webhookType === 'ITEM' && webhookCode === 'ERROR') {
      // User needs to reconnect via Plaid Link; keep data, flag the state
      await supabase
        .from('plaid_items')
        .update({ status: 'disconnected' })
        .eq('id', item.id)
      return res.status(200).json({ received: true })
    }

    // Unhandled event type — acknowledge without action
    res.status(200).json({ received: true })
  } catch (err) {
    console.error('plaid/webhook error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
