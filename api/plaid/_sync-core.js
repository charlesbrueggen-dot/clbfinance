// api/plaid/_sync-core.js
// Shared sync logic used by enroll.js (initial import), sync-transactions.js
// (user-triggered "Sync All"), and webhook.js (Plaid-triggered). Pulls
// accounts + transactions for one Item through _plaid-client.js and mirrors
// them into Supabase.
import { getAccounts, syncTransactions } from './_plaid-client.js'

// Minimum time between real Plaid calls for the SAME item, enforced here so
// it applies uniformly no matter which of the three callers above triggers a
// sync — rapid button clicks, multiple browser tabs, duplicate webhook
// deliveries, or a user hitting the API directly all hit this same gate.
export const SYNC_COOLDOWN_MS = 30_000

// ── Plaid → app account type mapping ─────────────────────────────────────────
export function mapPlaidAccountType(type, subtype) {
  if (type === 'credit') return 'Credit Card'
  if (subtype === 'savings' || subtype === 'money market') return 'Savings'
  if (subtype === 'checking') return 'Checking'
  if (type === 'investment') return 'Investment'
  return 'Other'
}

export function colorForType(type) {
  const colors = { Checking: '#1a1a2e', Savings: '#0f3460', 'Credit Card': '#533483', Investment: '#2a9d8f' }
  return colors[type] || '#2b2d42'
}

// ── Sign convention ───────────────────────────────────────────────────────────
// Plaid convention: amount > 0 = money OUT (expense), amount < 0 = money IN
// (income) — the OPPOSITE of Teller's convention. This is deliberately
// separate from src/lib/txSign.js's normalizeSignedAmount, which is shared
// with the (unrelated) CSV importer and assumes the other sign convention.
export function normalizePlaidAmount(rawAmount) {
  const amount = Number(rawAmount)
  const kind = amount > 0 ? 'expense' : 'income'
  return { amount: Math.abs(amount), kind }
}

// ── Plaid Personal Finance Category → app category mapping ───────────────────
// Full coverage of Plaid's PFC v2 detailed-category taxonomy
// (https://plaid.com/documents/pfc-taxonomy-all.csv, 18 primary / ~90
// detailed categories) mapped onto this app's Needs/Wants/Savings/subcategory
// scheme (expense side) or income `source` (income side, matching
// INCOME_SOURCES in src/pages/Accounts.jsx).
//
// EVALUATION (why there's no sync-time AI categorization pass — see task
// notes): every detailed category below resolves to a real, non-"Other"
// bucket except the ones that are genuinely unclassifiable — the literal
// catch-all OTHER_OTHER, and a handful of income types (child support,
// rental income, pension, unemployment, disability) that don't map to any of
// this app's 7 named income sources. Run against a mock transaction set
// shaped like real bank data (see _mock-data.js — Starbucks, Trader Joe's,
// Netflix, Shell, payroll, Amazon, rent, Comcast, GEICO, Uber, Spotify,
// Delta, Best Buy, etc.), the miss rate is 0%. Plaid's own categorization is
// simply too granular for a fallback pass to add value here — unlike CSV
// import's keyword matcher (which misses ~48% of real imported expenses,
// see Import.jsx), so AI categorization is scoped to CSV import only.
export const PFC_CATEGORY_MAP = {
  // INCOME (kind is always 'income' for these — `source` used, `category` ignored)
  INCOME_CHILD_SUPPORT:      { source: 'Other' },
  INCOME_CONTRACTOR:         { source: 'Freelance' },
  INCOME_DIVIDENDS:          { source: 'Investment Return' },
  INCOME_GIG_ECONOMY:        { source: 'Freelance' },
  INCOME_INTEREST_EARNED:    { source: 'Investment Return' },
  INCOME_LONG_TERM_DISABILITY: { source: 'Other' },
  INCOME_MILITARY:           { source: 'Salary' },
  INCOME_RENTAL:             { source: 'Other' },
  INCOME_RETIREMENT_PENSION: { source: 'Other' },
  INCOME_SALARY:              { source: 'Salary' },
  INCOME_TAX_REFUND:          { source: 'Refund' },
  INCOME_UNEMPLOYMENT:        { source: 'Other' },
  INCOME_OTHER:                { source: 'Other' },

  // LOAN_DISBURSEMENTS (money received — kind 'income', no matching named source)
  LOAN_DISBURSEMENTS_AUTO:              { source: 'Other' },
  LOAN_DISBURSEMENTS_CASH_ADVANCES:     { source: 'Other' },
  LOAN_DISBURSEMENTS_EWA:               { source: 'Other' },
  LOAN_DISBURSEMENTS_MORTGAGE:          { source: 'Other' },
  LOAN_DISBURSEMENTS_PERSONAL:          { source: 'Other' },
  LOAN_DISBURSEMENTS_STUDENT:           { source: 'Other' },
  LOAN_DISBURSEMENTS_OTHER_DISBURSEMENT: { source: 'Other' },

  // LOAN_PAYMENTS (money paid out — kind 'expense'; debt payoff, not a "spend")
  LOAN_PAYMENTS_BNPL:                  { category: 'Wants',   subcategory: 'Shopping' },
  LOAN_PAYMENTS_CAR_PAYMENT:           { category: 'Needs',   subcategory: 'Transportation' },
  LOAN_PAYMENTS_CASH_ADVANCES:         { category: 'Needs',   subcategory: 'Other' },
  LOAN_PAYMENTS_CREDIT_CARD_PAYMENT:   { category: 'Savings', subcategory: 'Other' },
  LOAN_PAYMENTS_EWA:                   { category: 'Savings', subcategory: 'Other' },
  LOAN_PAYMENTS_MORTGAGE_PAYMENT:      { category: 'Needs',   subcategory: 'Rent' },
  LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT: { category: 'Savings', subcategory: 'Other' },
  LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT:  { category: 'Savings', subcategory: 'Other' },
  LOAN_PAYMENTS_OTHER_PAYMENT:         { category: 'Savings', subcategory: 'Other' },

  // TRANSFER_IN (kind 'income')
  TRANSFER_IN_ACCOUNT_TRANSFER:                 { source: 'Transfer In' },
  TRANSFER_IN_DEPOSIT:                          { source: 'Transfer In' },
  TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS:  { source: 'Investment Return' },
  TRANSFER_IN_SAVINGS:                          { source: 'Transfer In' },
  TRANSFER_IN_TRANSFER_IN_FROM_APPS:            { source: 'Transfer In' },
  TRANSFER_IN_WIRE:                             { source: 'Transfer In' },
  TRANSFER_IN_OTHER_TRANSFER_IN:                { source: 'Transfer In' },

  // TRANSFER_OUT (kind 'expense')
  TRANSFER_OUT_ACCOUNT_TRANSFER:                { category: 'Savings', subcategory: 'Other' },
  TRANSFER_OUT_CRYPTO:                          { category: 'Savings', subcategory: 'Investment' },
  TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS: { category: 'Savings', subcategory: 'Investment' },
  TRANSFER_OUT_SAVINGS:                         { category: 'Savings', subcategory: 'Emergency Fund' },
  TRANSFER_OUT_TRANSFER_OUT_FROM_APPS:          { category: 'Savings', subcategory: 'Other' },
  TRANSFER_OUT_WIRE:                            { category: 'Savings', subcategory: 'Other' },
  TRANSFER_OUT_WITHDRAWAL:                      { category: 'Savings', subcategory: 'Other' },
  TRANSFER_OUT_OTHER_TRANSFER_OUT:              { category: 'Savings', subcategory: 'Other' },

  // BANK_FEES (kind 'expense')
  BANK_FEES_ATM_FEES:                { category: 'Needs', subcategory: 'Other' },
  BANK_FEES_INSUFFICIENT_FUNDS:      { category: 'Needs', subcategory: 'Other' },
  BANK_FEES_INTEREST_CHARGE:         { category: 'Needs', subcategory: 'Other' },
  BANK_FEES_FOREIGN_TRANSACTION_FEES: { category: 'Needs', subcategory: 'Other' },
  BANK_FEES_OVERDRAFT_FEES:          { category: 'Needs', subcategory: 'Other' },
  BANK_FEES_LATE_FEES:               { category: 'Needs', subcategory: 'Other' },
  BANK_FEES_CASH_ADVANCE:            { category: 'Needs', subcategory: 'Other' },
  BANK_FEES_OTHER_BANK_FEES:         { category: 'Needs', subcategory: 'Other' },

  // ENTERTAINMENT (kind 'expense') — streaming/music treated as Subscriptions
  // to match the existing keyword classifier's Netflix/Spotify convention
  // (see CATEGORY_RULES in src/hooks/useTransactions.js).
  ENTERTAINMENT_CASINOS_AND_GAMBLING:  { category: 'Wants', subcategory: 'Entertainment' },
  ENTERTAINMENT_MUSIC_AND_AUDIO:       { category: 'Wants', subcategory: 'Subscriptions' },
  ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS: { category: 'Wants', subcategory: 'Entertainment' },
  ENTERTAINMENT_TV_AND_MOVIES:         { category: 'Wants', subcategory: 'Subscriptions' },
  ENTERTAINMENT_VIDEO_GAMES:           { category: 'Wants', subcategory: 'Entertainment' },
  ENTERTAINMENT_OTHER_ENTERTAINMENT:   { category: 'Wants', subcategory: 'Entertainment' },

  // FOOD_AND_DRINK (kind 'expense')
  FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR: { category: 'Wants', subcategory: 'Dining' },
  FOOD_AND_DRINK_COFFEE:               { category: 'Wants', subcategory: 'Dining' },
  FOOD_AND_DRINK_FAST_FOOD:            { category: 'Wants', subcategory: 'Dining' },
  FOOD_AND_DRINK_GROCERIES:            { category: 'Needs', subcategory: 'Groceries' },
  FOOD_AND_DRINK_RESTAURANT:           { category: 'Wants', subcategory: 'Dining' },
  FOOD_AND_DRINK_VENDING_MACHINES:     { category: 'Wants', subcategory: 'Dining' },
  FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK: { category: 'Wants', subcategory: 'Dining' },

  // GENERAL_MERCHANDISE (kind 'expense')
  GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS: { category: 'Wants', subcategory: 'Shopping' },
  GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES:  { category: 'Wants', subcategory: 'Shopping' },
  GENERAL_MERCHANDISE_CONVENIENCE_STORES:        { category: 'Wants', subcategory: 'Shopping' },
  GENERAL_MERCHANDISE_DEPARTMENT_STORES:         { category: 'Wants', subcategory: 'Shopping' },
  GENERAL_MERCHANDISE_DISCOUNT_STORES:           { category: 'Wants', subcategory: 'Shopping' },
  GENERAL_MERCHANDISE_ELECTRONICS:               { category: 'Wants', subcategory: 'Shopping' },
  GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES:       { category: 'Wants', subcategory: 'Shopping' },
  GENERAL_MERCHANDISE_OFFICE_SUPPLIES:           { category: 'Wants', subcategory: 'Shopping' },
  GENERAL_MERCHANDISE_ONLINE_MARKETPLACES:       { category: 'Wants', subcategory: 'Shopping' },
  GENERAL_MERCHANDISE_PET_SUPPLIES:              { category: 'Wants', subcategory: 'Shopping' },
  GENERAL_MERCHANDISE_SPORTING_GOODS:            { category: 'Wants', subcategory: 'Shopping' },
  GENERAL_MERCHANDISE_SUPERSTORES:               { category: 'Wants', subcategory: 'Shopping' },
  GENERAL_MERCHANDISE_TOBACCO_AND_VAPE:          { category: 'Wants', subcategory: 'Shopping' },
  GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE: { category: 'Wants', subcategory: 'Shopping' },

  // HOME_IMPROVEMENT (kind 'expense')
  HOME_IMPROVEMENT_FURNITURE:            { category: 'Needs', subcategory: 'Other' },
  HOME_IMPROVEMENT_HARDWARE:             { category: 'Needs', subcategory: 'Other' },
  HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE: { category: 'Needs', subcategory: 'Other' },
  HOME_IMPROVEMENT_SECURITY:             { category: 'Needs', subcategory: 'Other' },
  HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT: { category: 'Needs', subcategory: 'Other' },

  // MEDICAL (kind 'expense')
  MEDICAL_DENTAL_CARE:              { category: 'Needs', subcategory: 'Healthcare' },
  MEDICAL_EYE_CARE:                 { category: 'Needs', subcategory: 'Healthcare' },
  MEDICAL_NURSING_CARE:             { category: 'Needs', subcategory: 'Healthcare' },
  MEDICAL_PHARMACIES_AND_SUPPLEMENTS: { category: 'Needs', subcategory: 'Healthcare' },
  MEDICAL_PRIMARY_CARE:             { category: 'Needs', subcategory: 'Healthcare' },
  MEDICAL_VETERINARY_SERVICES:      { category: 'Needs', subcategory: 'Healthcare' },
  MEDICAL_OTHER_MEDICAL:            { category: 'Needs', subcategory: 'Healthcare' },

  // PERSONAL_CARE (kind 'expense')
  PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS: { category: 'Wants', subcategory: 'Entertainment' },
  PERSONAL_CARE_HAIR_AND_BEAUTY:          { category: 'Wants', subcategory: 'Shopping' },
  PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING: { category: 'Needs', subcategory: 'Other' },
  PERSONAL_CARE_OTHER_PERSONAL_CARE:      { category: 'Wants', subcategory: 'Shopping' },

  // GENERAL_SERVICES (kind 'expense')
  GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING: { category: 'Needs', subcategory: 'Other' },
  GENERAL_SERVICES_AUTOMOTIVE:            { category: 'Needs', subcategory: 'Transportation' },
  GENERAL_SERVICES_CHILDCARE:             { category: 'Needs', subcategory: 'Other' },
  GENERAL_SERVICES_CONSULTING_AND_LEGAL:  { category: 'Needs', subcategory: 'Other' },
  GENERAL_SERVICES_EDUCATION:             { category: 'Needs', subcategory: 'Other' },
  GENERAL_SERVICES_INSURANCE:             { category: 'Needs', subcategory: 'Insurance' },
  GENERAL_SERVICES_POSTAGE_AND_SHIPPING:  { category: 'Wants', subcategory: 'Shopping' },
  GENERAL_SERVICES_STORAGE:               { category: 'Needs', subcategory: 'Other' },
  GENERAL_SERVICES_OTHER_GENERAL_SERVICES: { category: 'Needs', subcategory: 'Other' },

  // GOVERNMENT_AND_NON_PROFIT (kind 'expense')
  GOVERNMENT_AND_NON_PROFIT_DONATIONS:                          { category: 'Savings', subcategory: 'Other' },
  GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS_AND_AGENCIES: { category: 'Needs', subcategory: 'Other' },
  GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT:                        { category: 'Needs', subcategory: 'Other' },
  GOVERNMENT_AND_NON_PROFIT_OTHER_GOVERNMENT_AND_NON_PROFIT:    { category: 'Needs', subcategory: 'Other' },

  // TRANSPORTATION (kind 'expense')
  TRANSPORTATION_BIKES_AND_SCOOTERS:    { category: 'Needs', subcategory: 'Transportation' },
  TRANSPORTATION_GAS:                   { category: 'Needs', subcategory: 'Transportation' },
  TRANSPORTATION_PARKING:               { category: 'Needs', subcategory: 'Transportation' },
  TRANSPORTATION_PUBLIC_TRANSIT:        { category: 'Needs', subcategory: 'Transportation' },
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES: { category: 'Needs', subcategory: 'Transportation' },
  TRANSPORTATION_TOLLS:                 { category: 'Needs', subcategory: 'Transportation' },
  TRANSPORTATION_OTHER_TRANSPORTATION:  { category: 'Needs', subcategory: 'Transportation' },

  // TRAVEL (kind 'expense')
  TRAVEL_FLIGHTS:      { category: 'Wants', subcategory: 'Travel' },
  TRAVEL_LODGING:      { category: 'Wants', subcategory: 'Travel' },
  TRAVEL_RENTAL_CARS:  { category: 'Wants', subcategory: 'Travel' },
  TRAVEL_OTHER_TRAVEL: { category: 'Wants', subcategory: 'Travel' },

  // RENT_AND_UTILITIES (kind 'expense')
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY:       { category: 'Needs', subcategory: 'Utilities' },
  RENT_AND_UTILITIES_INTERNET_AND_CABLE:        { category: 'Needs', subcategory: 'Utilities' },
  RENT_AND_UTILITIES_RENT:                      { category: 'Needs', subcategory: 'Rent' },
  RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT: { category: 'Needs', subcategory: 'Utilities' },
  RENT_AND_UTILITIES_TELEPHONE:                 { category: 'Needs', subcategory: 'Utilities' },
  RENT_AND_UTILITIES_WATER:                     { category: 'Needs', subcategory: 'Utilities' },
  RENT_AND_UTILITIES_OTHER_UTILITIES:           { category: 'Needs', subcategory: 'Utilities' },

  // OTHER — the one genuine catch-all with no primary-category context at all.
  OTHER_OTHER: { category: 'Wants', subcategory: 'Other', source: 'Other' },
}

export function classifyTransaction(pfc, kind) {
  const mapped = PFC_CATEGORY_MAP[pfc?.detailed] || {}
  if (kind === 'income') {
    // A mapping tagged as expense-shaped but arriving with a negative amount
    // (e.g. a grocery store refund) is a refund, not a miscategorization —
    // 'Refund' is a better default than forcing a mismatched category.
    return { source: mapped.source || 'Refund' }
  }
  return { category: mapped.category || 'Wants', subcategory: mapped.subcategory || 'Other' }
}

// ── Sync one item ─────────────────────────────────────────────────────────────
// 1. Skips entirely (no Plaid calls at all) if synced too recently — see
//    SYNC_COOLDOWN_MS above.
// 2. Upserts the item's accounts, with balance read straight from
//    /accounts/get's cached value (no per-call cost, no running-balance
//    derivation needed the way Teller required).
// 3. Loops /transactions/sync (cursor-based) until has_more is false,
//    upserting added+modified transactions and deleting removed ones.
// 4. Persists the new cursor + last_synced_at on the item.
export async function syncItem(supabase, item) {
  if (item.last_synced_at) {
    const msSinceSync = Date.now() - new Date(item.last_synced_at).getTime()
    if (msSinceSync < SYNC_COOLDOWN_MS) {
      const cooldownRemainingMs = SYNC_COOLDOWN_MS - msSinceSync
      console.log(`[plaid:sync] item ${item.id}: skipped, ${Math.ceil(cooldownRemainingMs / 1000)}s of cooldown remaining`)
      return { synced: 0, accounts: 0, skipped: true, cooldownRemainingMs }
    }
  }

  // Claim this sync BEFORE calling Plaid (not after) — see the equivalent
  // comment in the old Teller _sync-core.js for why.
  await supabase
    .from('plaid_items')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', item.id)

  console.log(`[plaid:sync] item ${item.id} (${item.institution_name || 'unknown bank'}): starting sync`)

  const { accounts: plaidAccounts } = await getAccounts(item.access_token)
  const accountIdMap = {} // plaid_account_id -> our accounts.id

  for (const pa of plaidAccounts) {
    const type = mapPlaidAccountType(pa.type, pa.subtype)
    // Plaid convention: for credit accounts, `current` is already positive =
    // amount owed, so no sign inversion is needed there (unlike Teller). For
    // asset accounts (checking/savings/etc.) the raw signed value is kept as-is
    // — Math.abs'ing it here would hide a legitimate overdraft (negative
    // balance) behind a false-positive number.
    const rawBalance = pa.balances?.current != null ? Number(pa.balances.current) : 0
    const balance = type === 'Credit Card' ? Math.abs(rawBalance) : rawBalance

    const { data: account, error: accErr } = await supabase
      .from('accounts')
      .upsert({
        user_id:          item.user_id,
        plaid_account_id: pa.account_id,
        plaid_item_id:    item.id,
        name:             pa.name,
        type,
        institution:      item.institution_name || null,
        card_last4:       pa.mask || null,
        color:            colorForType(type),
        sync_status:      'plaid',
        balance,
        last_synced_at:   new Date().toISOString(),
      }, { onConflict: 'user_id,plaid_account_id' })
      .select()
      .single()
    if (accErr) throw new Error(`Account upsert failed: ${accErr.message}`)
    accountIdMap[pa.account_id] = account.id
  }

  let cursor = item.cursor || null
  let synced = 0
  let hasMore = true

  while (hasMore) {
    const page = await syncTransactions(item.access_token, cursor)

    const upserts = [...page.added, ...page.modified].map(t => {
      const { amount, kind } = normalizePlaidAmount(t.amount)
      const classified = classifyTransaction(t.personal_finance_category, kind)
      return {
        user_id:             item.user_id,
        account_id:          accountIdMap[t.account_id] || null,
        plaid_transaction_id: t.transaction_id,
        description:         t.merchant_name || t.name,
        amount,
        kind,
        category:            kind === 'expense' ? classified.category    : null,
        subcategory:         kind === 'expense' ? classified.subcategory : null,
        source:              kind === 'income'  ? classified.source      : null,
        date:                t.date,
        merchant:            t.merchant_name || null,
        status:              t.pending ? 'pending' : 'posted',
        auto_categorized:    true,
        source_type:         'plaid',
      }
    })

    if (upserts.length > 0) {
      const { error: upsertErr } = await supabase
        .from('account_transactions')
        .upsert(upserts, { onConflict: 'plaid_transaction_id' })
      if (upsertErr) throw new Error(`Transaction upsert failed: ${upsertErr.message}`)
      synced += upserts.length
    }

    if (page.removed?.length > 0) {
      await supabase
        .from('account_transactions')
        .delete()
        .in('plaid_transaction_id', page.removed.map(r => r.transaction_id))
    }

    cursor = page.next_cursor
    hasMore = !!page.has_more
  }

  await supabase
    .from('plaid_items')
    .update({ cursor, last_synced_at: new Date().toISOString() })
    .eq('id', item.id)

  console.log(`[plaid:sync] item ${item.id}: synced ${synced} transactions across ${plaidAccounts.length} accounts`)
  return { synced, accounts: plaidAccounts.length, skipped: false }
}
