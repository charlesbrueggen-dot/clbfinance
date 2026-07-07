// api/teller/disconnect.js
// Disconnects a Teller enrollment: revokes API access to its accounts on
// Teller's side (best effort), unlinks the local accounts, and removes the
// stored access token. Transaction history is kept.
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

    // Revoke Teller's access to each linked account (best effort — the local
    // cleanup below proceeds even if revocation fails)
    const { data: linkedAccounts } = await supabase
      .from('accounts')
      .select('id, teller_account_id')
      .eq('teller_enrollment_id', enrollmentId)
      .eq('user_id', userId)
    for (const acc of (linkedAccounts || [])) {
      if (!acc.teller_account_id) continue
      try {
        await deleteAccount(enrollment.access_token, acc.teller_account_id)
      } catch (err) {
        console.warn(`teller/disconnect: could not revoke account ${acc.teller_account_id}:`, err.message)
      }
    }

    // Keep the accounts and their history, but mark them manual/unlinked
    await supabase
      .from('accounts')
      .update({ teller_account_id: null, teller_enrollment_id: null, sync_status: 'manual' })
      .eq('teller_enrollment_id', enrollmentId)
      .eq('user_id', userId)

    // Drop the enrollment (and its access token) entirely
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
