// api/teller/_sync-core.js
// Shared sync logic used by enroll.js (initial import), sync-transactions.js
// (user-triggered "Sync All"), and webhook.js (Teller-triggered). Pulls
// accounts + transactions for one enrollment through _teller-client.js and
// mirrors them into Supabase.
import { listAccounts, listTransactions } from './_teller-client.js'
import { normalizeSignedAmount } from '../../src/lib/txSign.js'

// Minimum time between real Teller calls for the SAME enrollment, enforced
// here so it applies uniformly no matter which of the three callers above
// triggers a sync — rapid button clicks, multiple browser tabs, duplicate
// webhook deliveries, or a user hitting the API directly all hit this same
// gate. This is a rate-limit safeguard only; Teller's Transactions product is
// a flat $0.30/enrollment/month regardless of call volume, so this doesn't
// change cost — it exists purely to avoid HTTP 429s.
export const SYNC_COOLDOWN_MS = 30_000

// ── Teller → app account type mapping ────────────────────────────────────────
export function mapTellerAccountType(type, subtype) {
  if (type === 'credit') return 'Credit Card'
  if (subtype === 'savings' || subtype === 'money_market') return 'Savings'
  if (subtype === 'checking') return 'Checking'
  if (type === 'investment' || subtype === 'brokerage') return 'Investment'
  return 'Other'
}

export function colorForType(type) {
  const colors = { Checking: '#1a1a2e', Savings: '#0f3460', 'Credit Card': '#533483', Investment: '#2a9d8f' }
  return colors[type] || '#2b2d42'
}

// ── Teller category → app category mapping ───────────────────────────────────
// Teller categories: https://teller.io/docs/api/transactions (details.category)
const TELLER_CATEGORY_MAP = {
  home:           { category: 'Needs', subcategory: 'Rent' },
  utilities:      { category: 'Needs', subcategory: 'Utilities' },
  phone:          { category: 'Needs', subcategory: 'Utilities' },
  groceries:      { category: 'Needs', subcategory: 'Groceries' },
  health:         { category: 'Needs', subcategory: 'Healthcare' },
  insurance:      { category: 'Needs', subcategory: 'Insurance' },
  fuel:           { category: 'Needs', subcategory: 'Transportation' },
  transport:      { category: 'Needs', subcategory: 'Transportation' },
  transportation: { category: 'Needs', subcategory: 'Transportation' },
  loan:           { category: 'Needs', subcategory: 'Other' },
  tax:            { category: 'Needs', subcategory: 'Other' },
  dining:         { category: 'Wants', subcategory: 'Dining' },
  bar:            { category: 'Wants', subcategory: 'Dining' },
  entertainment:  { category: 'Wants', subcategory: 'Entertainment' },
  sport:          { category: 'Wants', subcategory: 'Entertainment' },
  shopping:       { category: 'Wants', subcategory: 'Shopping' },
  clothing:       { category: 'Wants', subcategory: 'Shopping' },
  electronics:    { category: 'Wants', subcategory: 'Shopping' },
  software:       { category: 'Wants', subcategory: 'Subscriptions' },
  travel:         { category: 'Wants', subcategory: 'Travel' },
  accommodation:  { category: 'Wants', subcategory: 'Travel' },
  education:      { category: 'Wants', subcategory: 'Other' },
  investment:     { category: 'Savings', subcategory: 'Investment' },
}

function classifyTransaction(txn, kind) {
  if (kind === 'income') {
    const cat = txn.details?.category
    return { source: cat === 'income' ? 'Salary' : 'Other' }
  }
  const mapped = TELLER_CATEGORY_MAP[txn.details?.category]
  return mapped || { category: 'Wants', subcategory: 'Other' }
}

// ── Sync one enrollment ───────────────────────────────────────────────────────
// 1. Skips entirely (no Teller calls at all) if synced too recently — see
//    SYNC_COOLDOWN_MS above.
// 2. Upserts the enrollment's accounts
// 3. Upserts transactions (keyed on teller_txn_id)
// 4. Prunes local pending txns that Teller no longer returns (pending txns
//    get a NEW id when they post, so the stale pending copy must be removed)
// 5. Sets each account's balance from the newest POSTED transaction's
//    running_balance — deliberately NOT Teller's /balances endpoint, which
//    costs $0.10/call. Guaranteed-live balance isn't needed here.
export async function syncEnrollment(supabase, enrollment) {
  if (enrollment.last_synced_at) {
    const msSinceSync = Date.now() - new Date(enrollment.last_synced_at).getTime()
    if (msSinceSync < SYNC_COOLDOWN_MS) {
      const cooldownRemainingMs = SYNC_COOLDOWN_MS - msSinceSync
      console.log(`[teller:sync] enrollment ${enrollment.id}: skipped, ${Math.ceil(cooldownRemainingMs / 1000)}s of cooldown remaining`)
      return { synced: 0, accounts: 0, skipped: true, cooldownRemainingMs }
    }
  }

  // Claim this sync BEFORE calling Teller (not after) so a second request
  // arriving moments later — a double-click, a second tab, an overlapping
  // webhook delivery — sees a fresh last_synced_at and skips instead of
  // racing us into a duplicate round of Teller calls. This narrows the race
  // window to the gap between two near-simultaneous requests' cooldown
  // checks; it isn't a true distributed lock, but that's an acceptable
  // trade-off at this app's scale.
  await supabase
    .from('teller_enrollments')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', enrollment.id)

  console.log(`[teller:sync] enrollment ${enrollment.id} (${enrollment.institution_name || 'unknown bank'}): starting sync`)

  const tellerAccounts = await listAccounts(enrollment.access_token)
  let synced = 0

  for (const ta of tellerAccounts) {
    const type = mapTellerAccountType(ta.type, ta.subtype)
    const { data: account, error: accErr } = await supabase
      .from('accounts')
      .upsert({
        user_id:              enrollment.user_id,
        teller_account_id:    ta.id,
        teller_enrollment_id: enrollment.id,
        name:                 ta.name,
        type,
        institution:          ta.institution?.name || enrollment.institution_name || null,
        card_last4:           ta.last_four || null,
        color:                colorForType(type),
        sync_status:          'teller',
      }, { onConflict: 'user_id,teller_account_id' })
      .select()
      .single()
    if (accErr) throw new Error(`Account upsert failed: ${accErr.message}`)

    const txns = await listTransactions(enrollment.access_token, ta.id)

    const toUpsert = txns.map(t => {
      // Teller convention: negative amount = money out, positive = money in
      const { amount, kind } = normalizeSignedAmount(t.amount)
      const classified = classifyTransaction(t, kind)
      return {
        user_id:          enrollment.user_id,
        account_id:       account.id,
        teller_txn_id:    t.id,
        description:      t.details?.counterparty?.name || t.description,
        amount,
        kind,
        category:         kind === 'expense' ? classified.category    : null,
        subcategory:      kind === 'expense' ? classified.subcategory : null,
        source:           kind === 'income'  ? classified.source      : null,
        date:             t.date,
        merchant:         t.details?.counterparty?.name || null,
        status:           t.status,
        running_balance:  t.running_balance != null ? Number(t.running_balance) : null,
        auto_categorized: true,
        source_type:      'teller',
      }
    })

    if (toUpsert.length > 0) {
      const { error: upsertErr } = await supabase
        .from('account_transactions')
        .upsert(toUpsert, { onConflict: 'teller_txn_id' })
      if (upsertErr) throw new Error(`Transaction upsert failed: ${upsertErr.message}`)
      synced += toUpsert.length
    }

    // Prune stale pending transactions (they re-appear as posted under a new id)
    const fetchedIds = txns.map(t => t.id)
    if (fetchedIds.length > 0) {
      await supabase
        .from('account_transactions')
        .delete()
        .eq('account_id', account.id)
        .eq('status', 'pending')
        .eq('source_type', 'teller')
        .not('teller_txn_id', 'in', `(${fetchedIds.map(id => `"${id}"`).join(',')})`)
    }

    // Balance = running_balance of the newest posted transaction (txns arrive
    // newest-first from Teller). Credit accounts: Teller reports the ledger as
    // negative when money is owed; the app displays owed as a positive number.
    // TODO: verify credit-account sign convention against real Teller data.
    const newestPosted = txns.find(t => t.status === 'posted' && t.running_balance != null)
    if (newestPosted) {
      const rb = Number(newestPosted.running_balance)
      const balance = type === 'Credit Card' ? Math.abs(rb) : rb
      await supabase
        .from('accounts')
        .update({ balance, last_synced_at: new Date().toISOString() })
        .eq('id', account.id)
    }
  }

  console.log(`[teller:sync] enrollment ${enrollment.id}: synced ${synced} transactions across ${tellerAccounts.length} accounts`)
  return { synced, accounts: tellerAccounts.length, skipped: false }
}
