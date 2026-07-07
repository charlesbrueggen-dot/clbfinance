// api/teller/disconnect.js
// Disconnects a Teller enrollment: revokes API access to its accounts on
// Teller's side, unlinks the local accounts, and removes the stored access
// token. Transaction history is kept.
//
// IMPORTANT cost-safety invariant: we only delete the local teller_enrollments
// row (and with it, the access_token) once EVERY linked account has been
// confirmed revoked on Teller's side. That access_token is the only way to
// ever call DELETE /accounts/:id again — if we dropped it after a failed
// revocation, the account would keep costing money on Teller's side with no
// way for us to clean it up. On partial failure we keep the enrollment row
// (with its token) and unlink only the accounts that actually succeeded, so a
// retry naturally picks up where it left off.
//
// POST body: { userId, enrollmentId }  (enrollmentId = teller_enrollments.id)
import { getServiceClient } from './_supabase.js'
import { deleteAccount } from './_teller-client.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { userId, enrollmentId } = req.body || {}
  if (!userId || !enrollmentId) return res.status(400).json({ error: 'userId and enrollmentId required' })

  try {
    const supabase = getServiceClient()

    const { data: enrollment, error: findErr } = await supabase
      .from('teller_enrollments')
      .select('*')
      .eq('id', enrollmentId)
      .eq('user_id', userId)
      .single()
    if (findErr || !enrollment) return res.status(404).json({ error: 'Enrollment not found' })

    const { data: linkedAccounts } = await supabase
      .from('accounts')
      .select('id, teller_account_id')
      .eq('teller_enrollment_id', enrollmentId)
      .eq('user_id', userId)

    const revokedIds = []
    const failedIds = []
    for (const acc of (linkedAccounts || [])) {
      if (!acc.teller_account_id) continue
      try {
        await deleteAccount(enrollment.access_token, acc.teller_account_id)
        revokedIds.push(acc.id)
      } catch (err) {
        // 404/410 = Teller already has no record of this account — nothing
        // left to revoke, so treat it as successfully gone.
        if (err.statusCode === 404 || err.statusCode === 410) {
          revokedIds.push(acc.id)
        } else {
          console.error(`teller/disconnect: failed to revoke account ${acc.teller_account_id}:`, err.message)
          failedIds.push(acc.id)
        }
      }
    }

    // Only unlink the accounts we actually confirmed are revoked
    if (revokedIds.length > 0) {
      await supabase
        .from('accounts')
        .update({ teller_account_id: null, teller_enrollment_id: null, sync_status: 'manual' })
        .in('id', revokedIds)
        .eq('user_id', userId)
    }

    if (failedIds.length > 0) {
      return res.status(502).json({
        error: `Disconnected ${revokedIds.length} of ${revokedIds.length + failedIds.length} accounts — ` +
               `${failedIds.length} could not be revoked on Teller's side. Try disconnecting again.`,
        partial: true,
      })
    }

    // Every account confirmed revoked (or already gone) — safe to drop the
    // enrollment and its access token entirely.
    const { error: delErr } = await supabase
      .from('teller_enrollments')
      .delete()
      .eq('id', enrollmentId)
      .eq('user_id', userId)
    if (delErr) throw delErr

    res.status(200).json({ success: true })
  } catch (err) {
    console.error('teller/disconnect error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
