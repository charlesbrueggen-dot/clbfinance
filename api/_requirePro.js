// api/_requirePro.js
// Server-side Pro-status check for the AI endpoints (api/chat.js,
// api/categorize.js). The client-side ProGate in AICoach.jsx/Import.jsx
// keeps the UI honest, but without this check anyone could call those
// endpoints directly (no Pro subscription, no auth at all) and run up the
// Anthropic bill for free.
//
// NOTE: this trusts the `userId` the caller supplies — it checks "is this
// user id Pro", not "is the caller actually this user". Closing that second
// gap (verifying the caller's Supabase session matches the given userId) is
// being handled separately across the Plaid/Stripe endpoints; once that
// lands, wire these two endpoints into it the same way.
import { getServiceClient } from './_supabase.js'

export async function isUserPro(userId) {
  if (!userId) return false
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  return !!data
}
