// api/plaid/_mock-data.js
// Realistic sample data shaped exactly like Plaid API responses
// (https://plaid.com/docs/api/products/transactions/, /docs/api/accounts/).
// Used by _plaid-client.js while PLAID_USE_MOCKS is on, so the entire
// enroll -> sync -> UI flow can be built and tested without Plaid credentials.
//
// Sign convention (opposite of the old Teller mocks!): Plaid's `amount` is
// positive when money leaves the account (a purchase/debit) and negative
// when money comes in (a deposit/credit) — see normalizePlaidAmount in
// _sync-core.js.
//
// Categories use real Plaid Personal Finance Category `detailed` codes
// (https://plaid.com/documents/pfc-taxonomy-all.csv) so the PFC_CATEGORY_MAP
// in _sync-core.js is exercised the same way it will be against real data.
//
// Dates are generated relative to "today" so the mock data always looks fresh.

const MOCK_ITEM_ID     = 'item_mock_o3q7k2xrpq'
const MOCK_INSTITUTION = { institution_id: 'ins_3', name: 'Chase' }

export function mockItem() {
  return {
    publicToken: 'public-sandbox-mock-do-not-use-in-production',
    accessToken: 'access-sandbox-mock-do-not-use-in-production',
    itemId: MOCK_ITEM_ID,
    institution: MOCK_INSTITUTION,
  }
}

export function mockAccounts() {
  return [
    {
      account_id: 'plaid_mock_checking01',
      mask: '4821',
      name: 'Chase Total Checking',
      official_name: 'Chase Total Checking(SM)',
      subtype: 'checking',
      type: 'depository',
      balances: { available: 2350.0, current: 2418.63, iso_currency_code: 'USD' },
    },
    {
      account_id: 'plaid_mock_savings01',
      mask: '9377',
      name: 'Chase Premier Savings',
      official_name: 'Chase Premier Savings',
      subtype: 'savings',
      type: 'depository',
      balances: { available: 8752.4, current: 8752.4, iso_currency_code: 'USD' },
    },
    {
      account_id: 'plaid_mock_credit01',
      mask: '5512',
      name: 'Chase Freedom Unlimited',
      official_name: 'Chase Freedom Unlimited',
      subtype: 'credit card',
      type: 'credit',
      // Plaid convention: for credit accounts, `current` is positive = amount owed.
      balances: { available: 4513.71, current: 486.29, iso_currency_code: 'USD' },
    },
  ]
}

// Transaction templates, newest first. daysAgo is relative to today.
// amount: Plaid convention — positive = money out (debit), negative = money in (credit).
const TXN_TEMPLATES = {
  plaid_mock_checking01: [
    { daysAgo: 0,  amount: 6.4,     name: 'STARBUCKS #10233',        merchant: 'Starbucks',        detailed: 'FOOD_AND_DRINK_COFFEE', pending: true },
    { daysAgo: 1,  amount: 42.51,   name: "TRADER JOE'S #552",       merchant: "Trader Joe's",     detailed: 'FOOD_AND_DRINK_GROCERIES' },
    { daysAgo: 2,  amount: 15.49,   name: 'NETFLIX.COM',             merchant: 'Netflix',          detailed: 'ENTERTAINMENT_TV_AND_MOVIES' },
    { daysAgo: 3,  amount: 84.2,    name: 'SHELL OIL 5744221',       merchant: 'Shell',             detailed: 'TRANSPORTATION_GAS' },
    { daysAgo: 5,  amount: -2450.0, name: 'ACME CORP PAYROLL',       merchant: 'Acme Corp',         detailed: 'INCOME_SALARY' },
    { daysAgo: 6,  amount: 28.94,   name: 'CHIPOTLE 2211',           merchant: 'Chipotle',          detailed: 'FOOD_AND_DRINK_RESTAURANT' },
    { daysAgo: 8,  amount: 119.99,  name: 'AMAZON.COM*RT4Y88',       merchant: 'Amazon',            detailed: 'GENERAL_MERCHANDISE_ONLINE_MARKETPLACES' },
    { daysAgo: 10, amount: 500.0,   name: 'TRANSFER TO SAVINGS',     merchant: 'Chase',              detailed: 'TRANSFER_OUT_SAVINGS' },
    { daysAgo: 12, amount: 65.3,    name: 'COMCAST XFINITY',         merchant: 'Comcast',            detailed: 'RENT_AND_UTILITIES_INTERNET_AND_CABLE' },
    { daysAgo: 14, amount: 1250.0,  name: 'OAKWOOD PROPERTY RENT',   merchant: 'Oakwood Property',   detailed: 'RENT_AND_UTILITIES_RENT' },
    { daysAgo: 16, amount: 54.75,   name: 'KROGER #423',             merchant: 'Kroger',             detailed: 'FOOD_AND_DRINK_GROCERIES' },
    { daysAgo: 19, amount: -2450.0, name: 'ACME CORP PAYROLL',       merchant: 'Acme Corp',          detailed: 'INCOME_SALARY' },
    { daysAgo: 21, amount: 32.0,    name: 'PLANET FITNESS',          merchant: 'Planet Fitness',     detailed: 'PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS' },
    { daysAgo: 24, amount: 92.13,   name: 'GEICO AUTO INSURANCE',    merchant: 'GEICO',              detailed: 'GENERAL_SERVICES_INSURANCE' },
    { daysAgo: 27, amount: 18.6,    name: 'UBER TRIP HELP.UBER.COM', merchant: 'Uber',               detailed: 'TRANSPORTATION_TAXIS_AND_RIDE_SHARES' },
  ],
  plaid_mock_savings01: [
    { daysAgo: 3,  amount: -4.12,  name: 'INTEREST PAYMENT',       merchant: 'Chase', detailed: 'INCOME_INTEREST_EARNED' },
    { daysAgo: 10, amount: -500.0, name: 'TRANSFER FROM CHECKING', merchant: 'Chase', detailed: 'TRANSFER_IN_ACCOUNT_TRANSFER' },
    { daysAgo: 33, amount: -3.98,  name: 'INTEREST PAYMENT',       merchant: 'Chase', detailed: 'INCOME_INTEREST_EARNED' },
    { daysAgo: 40, amount: -500.0, name: 'TRANSFER FROM CHECKING', merchant: 'Chase', detailed: 'TRANSFER_IN_ACCOUNT_TRANSFER' },
  ],
  // TODO: verify sign convention for credit accounts against real Plaid data
  // once credentials arrive. Mocked here per Plaid's documented convention:
  // purchases positive, payments (money received on this account) negative.
  plaid_mock_credit01: [
    { daysAgo: 1,  amount: 34.99,  name: 'SPOTIFY USA',       merchant: 'Spotify',      detailed: 'ENTERTAINMENT_MUSIC_AND_AUDIO', pending: true },
    { daysAgo: 2,  amount: 76.42,  name: 'TARGET 00028312',   merchant: 'Target',       detailed: 'GENERAL_MERCHANDISE_SUPERSTORES' },
    { daysAgo: 4,  amount: 145.6,  name: 'DELTA AIR 0062341', merchant: 'Delta',        detailed: 'TRAVEL_FLIGHTS' },
    { daysAgo: 7,  amount: 52.18,  name: 'OLIVE GARDEN 1544', merchant: 'Olive Garden', detailed: 'FOOD_AND_DRINK_RESTAURANT' },
    { daysAgo: 9,  amount: -350.0, name: 'PAYMENT THANK YOU', merchant: 'Chase',        detailed: 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT' },
    { daysAgo: 13, amount: 89.99,  name: 'BEST BUY #1023',    merchant: 'Best Buy',     detailed: 'GENERAL_MERCHANDISE_ELECTRONICS' },
    { daysAgo: 17, amount: 122.1,  name: 'WHOLE FOODS MKT',   merchant: 'Whole Foods',  detailed: 'FOOD_AND_DRINK_GROCERIES' },
  ],
}

function isoDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function buildTransactions() {
  const out = []
  for (const [accountId, txns] of Object.entries(TXN_TEMPLATES)) {
    txns.forEach((t, i) => {
      out.push({
        transaction_id: `txn_mock_${accountId.slice(-10)}_${String(i).padStart(4, '0')}`,
        account_id: accountId,
        amount: t.amount,
        iso_currency_code: 'USD',
        date: isoDaysAgo(t.daysAgo),
        name: t.name,
        merchant_name: t.merchant,
        pending: !!t.pending,
        personal_finance_category: { primary: t.detailed.split('_')[0], detailed: t.detailed, confidence_level: 'VERY_HIGH' },
      })
    })
  }
  return out
}

// Mimics /transactions/sync's cursor-based pagination. Since this is fixed
// mock data (not a live ledger), the first call (no cursor) returns
// everything as `added`; any later call with that cursor returns nothing new
// — there's nothing further to page through, and no server-side state
// changes for mock data to notice between calls.
const MOCK_CURSOR = 'mock-cursor-initial-sync-complete'

export function mockSync(cursor) {
  if (cursor === MOCK_CURSOR) {
    return { added: [], modified: [], removed: [], next_cursor: MOCK_CURSOR, has_more: false }
  }
  return { added: buildTransactions(), modified: [], removed: [], next_cursor: MOCK_CURSOR, has_more: false }
}
