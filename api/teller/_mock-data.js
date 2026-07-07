// api/teller/_mock-data.js
// Realistic sample data shaped exactly like Teller API responses
// (https://teller.io/docs/api/accounts, /docs/api/transactions).
// Used by _teller-client.js while TELLER_USE_MOCKS is on, so the entire
// enroll → sync → UI flow can be built and tested without Teller credentials.
//
// Dates are generated relative to "today" so the mock data always looks fresh.

const MOCK_ENROLLMENT_ID = 'enr_mock_o3q7k2xrpq'
const MOCK_INSTITUTION   = { id: 'chase', name: 'Chase' }

export function mockEnrollment() {
  return {
    accessToken: 'token_mock_do_not_use_in_production',
    enrollment: { id: MOCK_ENROLLMENT_ID, institution: MOCK_INSTITUTION },
    user: { id: 'usr_mock_nq9lk3xr' },
  }
}

export function mockAccounts() {
  return [
    {
      id: 'acc_mock_checking01',
      currency: 'USD',
      enrollment_id: MOCK_ENROLLMENT_ID,
      institution: MOCK_INSTITUTION,
      last_four: '4821',
      name: 'Chase Total Checking',
      subtype: 'checking',
      type: 'depository',
      status: 'open',
    },
    {
      id: 'acc_mock_savings01',
      currency: 'USD',
      enrollment_id: MOCK_ENROLLMENT_ID,
      institution: MOCK_INSTITUTION,
      last_four: '9377',
      name: 'Chase Premier Savings',
      subtype: 'savings',
      type: 'depository',
      status: 'open',
    },
    {
      id: 'acc_mock_credit01',
      currency: 'USD',
      enrollment_id: MOCK_ENROLLMENT_ID,
      institution: MOCK_INSTITUTION,
      last_four: '5512',
      name: 'Chase Freedom Unlimited',
      subtype: 'credit_card',
      type: 'credit',
      status: 'open',
    },
  ]
}

// Transaction templates, newest first. daysAgo is relative to today.
// amount: Teller convention — negative = money out, positive = money in.
const TXN_TEMPLATES = {
  acc_mock_checking01: {
    // Balance the newest POSTED transaction should land on
    currentBalance: 2418.63,
    txns: [
      { daysAgo: 0,  amount: -6.4,     description: 'STARBUCKS #10233',        category: 'dining',        counterparty: 'Starbucks',        type: 'card_payment', status: 'pending' },
      { daysAgo: 1,  amount: -42.51,   description: "TRADER JOE'S #552",       category: 'groceries',     counterparty: "Trader Joe's",     type: 'card_payment' },
      { daysAgo: 2,  amount: -15.49,   description: 'NETFLIX.COM',             category: 'entertainment', counterparty: 'Netflix',          type: 'card_payment' },
      { daysAgo: 3,  amount: -84.2,    description: 'SHELL OIL 5744221',       category: 'fuel',          counterparty: 'Shell',            type: 'card_payment' },
      { daysAgo: 5,  amount: 2450.0,   description: 'ACME CORP PAYROLL',       category: 'income',        counterparty: 'Acme Corp',        type: 'ach' },
      { daysAgo: 6,  amount: -28.94,   description: 'CHIPOTLE 2211',           category: 'dining',        counterparty: 'Chipotle',         type: 'card_payment' },
      { daysAgo: 8,  amount: -119.99,  description: 'AMAZON.COM*RT4Y88',       category: 'shopping',      counterparty: 'Amazon',           type: 'card_payment' },
      { daysAgo: 10, amount: -500.0,   description: 'TRANSFER TO SAVINGS',     category: 'general',       counterparty: 'Chase',            type: 'transfer' },
      { daysAgo: 12, amount: -65.3,    description: 'COMCAST XFINITY',         category: 'utilities',     counterparty: 'Comcast',          type: 'bill_payment' },
      { daysAgo: 14, amount: -1250.0,  description: 'OAKWOOD PROPERTY RENT',   category: 'home',          counterparty: 'Oakwood Property', type: 'ach' },
      { daysAgo: 16, amount: -54.75,   description: 'KROGER #423',             category: 'groceries',     counterparty: 'Kroger',           type: 'card_payment' },
      { daysAgo: 19, amount: 2450.0,   description: 'ACME CORP PAYROLL',       category: 'income',        counterparty: 'Acme Corp',        type: 'ach' },
      { daysAgo: 21, amount: -32.0,    description: 'PLANET FITNESS',          category: 'sport',         counterparty: 'Planet Fitness',   type: 'card_payment' },
      { daysAgo: 24, amount: -92.13,   description: 'GEICO AUTO INSURANCE',    category: 'insurance',     counterparty: 'GEICO',            type: 'bill_payment' },
      { daysAgo: 27, amount: -18.6,    description: 'UBER TRIP HELP.UBER.COM', category: 'transport',     counterparty: 'Uber',             type: 'card_payment' },
    ],
  },
  acc_mock_savings01: {
    currentBalance: 8752.4,
    txns: [
      { daysAgo: 3,  amount: 4.12,   description: 'INTEREST PAYMENT',      category: 'income',  counterparty: 'Chase', type: 'interest' },
      { daysAgo: 10, amount: 500.0,  description: 'TRANSFER FROM CHECKING', category: 'general', counterparty: 'Chase', type: 'transfer' },
      { daysAgo: 33, amount: 3.98,   description: 'INTEREST PAYMENT',      category: 'income',  counterparty: 'Chase', type: 'interest' },
      { daysAgo: 40, amount: 500.0,  description: 'TRANSFER FROM CHECKING', category: 'general', counterparty: 'Chase', type: 'transfer' },
    ],
  },
  acc_mock_credit01: {
    // TODO: verify sign conventions for credit accounts against real Teller
    // data once credentials arrive. Mocked here as: purchases negative,
    // running_balance negative = amount owed.
    currentBalance: -486.29,
    txns: [
      { daysAgo: 1,  amount: -34.99,  description: 'SPOTIFY USA',          category: 'entertainment', counterparty: 'Spotify',    type: 'card_payment', status: 'pending' },
      { daysAgo: 2,  amount: -76.42,  description: 'TARGET 00028312',      category: 'shopping',      counterparty: 'Target',     type: 'card_payment' },
      { daysAgo: 4,  amount: -145.6,  description: 'DELTA AIR 0062341',    category: 'travel',        counterparty: 'Delta',      type: 'card_payment' },
      { daysAgo: 7,  amount: -52.18,  description: 'OLIVE GARDEN 1544',    category: 'dining',        counterparty: 'Olive Garden', type: 'card_payment' },
      { daysAgo: 9,  amount: 350.0,   description: 'PAYMENT THANK YOU',    category: 'general',       counterparty: 'Chase',      type: 'payment' },
      { daysAgo: 13, amount: -89.99,  description: 'BEST BUY #1023',       category: 'electronics',   counterparty: 'Best Buy',   type: 'card_payment' },
      { daysAgo: 17, amount: -122.1,  description: 'WHOLE FOODS MKT',      category: 'groceries',     counterparty: 'Whole Foods', type: 'card_payment' },
    ],
  },
}

function isoDaysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

// Build Teller-shaped transactions with internally consistent running
// balances: the newest posted txn lands on currentBalance and each older
// txn's running_balance is derived by undoing the newer transactions.
export function mockTransactions(accountId, count = 200) {
  const spec = TXN_TEMPLATES[accountId]
  if (!spec) return []

  let balanceAfter = spec.currentBalance
  const out = spec.txns.map((t, i) => {
    const status = t.status || 'posted'
    // Pending txns have no running_balance and don't affect the ledger chain;
    // the newest posted txn lands exactly on currentBalance.
    let running_balance = null
    if (status === 'posted') {
      running_balance = balanceAfter.toFixed(2)
      balanceAfter -= t.amount
    }
    return {
      id: `txn_mock_${accountId.slice(-10)}_${String(i).padStart(4, '0')}`,
      account_id: accountId,
      amount: t.amount.toFixed(2),
      date: isoDaysAgo(t.daysAgo),
      description: t.description,
      details: {
        category: t.category,
        counterparty: { name: t.counterparty, type: 'organization' },
        processing_status: status === 'pending' ? 'pending' : 'complete',
      },
      running_balance,
      status,
      type: t.type,
    }
  })
  return out.slice(0, count)
}
