// api/teller/enroll.js
// Called by the frontend after Teller Connect succeeds.
//
// Unlike Plaid there is no server-side token exchange: Teller Connect's
// onSuccess callback hands the frontend a ready-to-use access token +
// enrollment id, which we store here and immediately use for the first sync.
//
// POST body: { userId, accessToken, enrollmentId, institutionId?, institutionName? }
// In mock mode the Teller fields are optional — sample values are substituted
// so the flow can be exercised with no credentials at all.
import { getServiceClient } from './_supabase.js'
import { syncEnrollment } from './_sync-core.js'
import { isMockMode } from './_teller-client.js'
import { mockEnrollment } from './_mock-data.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let { userId, accessToken, enrollmentId, institutionId, institutionName } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId required' })

  if (isMockMode()) {
    const mock = mockEnrollment()
    accessToken     = accessToken     || mock.accessToken
    enrollmentId    = enrollmentId    || mock.enrollment.id
    institutionName = institutionName || mock.enrollment.institution.name
    institutionId   = institutionId   || mock.enrollment.institution.id
  }
  if (!accessToken || !enrollmentId) {
    return res.status(400).json({ error: 'accessToken and enrollmentId required' })
  }

  try {
    const supabase = getServiceClient()

    const { data: enrollment, error: enrollErr } = await supabase
      .from('teller_enrollments')
      .upsert({
        user_id:          userId,
        enrollment_id:    enrollmentId,
        access_token:     accessToken,
        institution_id:   institutionId || null,
        institution_name: institutionName || null,
        status:           'connected',
      }, { onConflict: 'user_id,enrollment_id' })
      .select()
      .single()
    if (enrollErr) throw enrollErr

    // Initial import: accounts + transactions + balances in one go
    let result
    try {
      result = await syncEnrollment(supabase, enrollment)
    } catch (err) {
      if (err.rateLimited) {
        // The enrollment itself is saved above, so the user isn't stuck —
        // only the first data pull is delayed. Ack with 429 so the frontend
        // extends its own cooldown instead of retrying immediately.
        console.error('teller/enroll: rate limited by Teller during initial sync:', err.message)
        return res.status(429).json({
          error: 'Bank connected, but Teller rate-limited the initial sync — try Sync in a minute.',
          rateLimited: true,
          retryAfterMs: (err.retryAfterSeconds || 60) * 1000,
          enrollmentId: enrollment.id,
        })
      }
      throw err
    }

    res.status(200).json({
      success: true,
      enrollmentId: enrollment.id,
      accountCount: result.accounts,
      synced: result.synced,
      skipped: result.skipped,
      mock: isMockMode(),
    })
  } catch (err) {
    console.error('teller/enroll error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
