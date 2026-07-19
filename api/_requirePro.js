// api/_requirePro.js
// Server-side Pro-status check for the AI endpoints (api/chat.js,
// api/categorize.js). The client-side ProGate in AICoach.jsx/Import.jsx
// keeps the UI honest, but without this check anyone could call those
// endpoints directly (no Pro subscription, no auth at all) and run up the
// Anthropic bill for free.
//
// This only checks "is this user id Pro" — callers must also pass the
// request through verifyCaller() (see _supabase.js) first, to confirm the
// caller's session actually belongs to that user id.
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
