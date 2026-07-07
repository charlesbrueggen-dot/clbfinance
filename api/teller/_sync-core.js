// api/teller/_sync-core.js
// Shared sync logic used by both sync-transactions.js (user-triggered) and
// webhook.js (Teller-triggered). Pulls accounts + transactions for one
// enrollment through _teller-client.js and mirrors them into Supabase.
import { listAccounts, listTransactions } from './_teller-client.js'

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
// 1. Upserts the enrollment's accounts
// 2. Upserts transactions (keyed on teller_txn_id)
// 3. Prunes local pending txns that Teller no longer returns (pending txns
//    get a NEW id when they post, so the stale pending copy must be removed)
// 4. Sets each account's balance from the newest POSTED transaction's
//    running_balance — deliberately NOT Teller's /balances endpoint, which
//    costs $0.10/call. Guaranteed-live balance isn't needed here.
export async function syncEnrollment(supabase, enrollment) {
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
      const amount = Number(t.amount)
      // Teller convention: negative amount = money out, positive = money in
      const kind = amount > 0 ? 'income' : 'expense'
      const classified = classifyTransaction(t, kind)
      return {
        user_id:          enrollment.user_id,
        account_id:       account.id,
        teller_txn_id:    t.id,
        description:      t.details?.counterparty?.name || t.description,
        amount:           Math.abs(amount),
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

  await supabase
    .from('teller_enrollments')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', enrollment.id)

  return { synced, accounts: tellerAccounts.length }
}
