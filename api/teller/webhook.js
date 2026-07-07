// api/teller/webhook.js
// Receives webhooks from Teller (configure the URL in the Teller dashboard:
// https://<your-domain>/api/teller/webhook).
//
// Handled events:
//   webhook.test              → acknowledge (sent by Teller when you add the URL)
//   transactions.processed    → new transaction data ready → re-sync enrollment
//   enrollment.disconnected   → bank login broke → mark enrollment disconnected
//
// TODO: set TELLER_SIGNING_SECRET (Teller dashboard → Application → Webhooks)
// so signatures are actually verified — see verifyWebhookSignature() in
// _teller-client.js. Until then, requests are only accepted in mock mode.
import { getServiceClient } from './_supabase.js'
import { syncEnrollment } from './_sync-core.js'
import { verifyWebhookSignature } from './_teller-client.js'

// Body parsing is disabled so the raw payload is available for HMAC
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

    if (!verifyWebhookSignature(rawBody, req.headers['teller-signature'])) {
      return res.status(401).json({ error: 'Invalid webhook signature' })
    }

    const event = JSON.parse(rawBody)
    const type = event.type
    const tellerEnrollmentId = event.payload?.enrollment_id

    if (type === 'webhook.test') {
      return res.status(200).json({ received: true })
    }

    const supabase = getServiceClient()
    const { data: enrollment } = tellerEnrollmentId
      ? await supabase
          .from('teller_enrollments')
          .select('*')
          .eq('enrollment_id', tellerEnrollmentId)
          .maybeSingle()
      : { data: null }

    if (!enrollment) {
      // Unknown enrollment — ack anyway so Teller doesn't retry forever
      console.warn(`teller/webhook: no enrollment found for ${tellerEnrollmentId} (event ${type})`)
      return res.status(200).json({ received: true })
    }

    if (type === 'transactions.processed') {
      try {
        const result = await syncEnrollment(supabase, enrollment)
        return res.status(200).json({ received: true, synced: result.synced, skipped: result.skipped })
      } catch (err) {
        // Ack with 200 anyway — a 5xx/429 here would make Teller retry the
        // webhook delivery, which would just re-trigger the same (possibly
        // still rate-limited) sync again. The next legitimate webhook or
        // manual sync will pick up whatever this attempt missed.
        console.error(`teller/webhook: sync failed for enrollment ${enrollment.id}:`, err.message)
        return res.status(200).json({ received: true, synced: 0, error: err.message })
      }
    }

    if (type === 'enrollment.disconnected') {
      // User needs to reconnect via Teller Connect; keep data, flag the state
      await supabase
        .from('teller_enrollments')
        .update({ status: 'disconnected' })
        .eq('id', enrollment.id)
      return res.status(200).json({ received: true })
    }

    // Unhandled event type — acknowledge without action
    res.status(200).json({ received: true })
  } catch (err) {
    console.error('teller/webhook error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
