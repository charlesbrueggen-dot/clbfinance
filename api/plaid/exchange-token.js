// api/plaid/exchange-token.js
// Called after user completes Plaid Link
// POST { publicToken, userId, institutionId, institutionName }  →  { success }

const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid')
const { createClient } = require('@supabase/supabase-js')

const plaidClient = new PlaidApi(
  new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET':    process.env.PLAID_SECRET,
      },
    },
  })
)

// Use the SERVICE ROLE key here — this runs server-side only
const supabase = createClient(
  process.env.SUPABASE_URL        || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // NEVER the anon key — needs to bypass RLS to store access tokens
)

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { publicToken, userId, institutionId, institutionName } = req.body
  if (!publicToken || !userId) return res.status(400).json({ error: 'publicToken and userId required' })

  try {
    // 1. Exchange public token → access token (access token never goes to client)
    const exchangeRes = await plaidClient.itemPublicTokenExchange({ public_token: publicToken })
    const { access_token, item_id } = exchangeRes.data

    // 2. Store the item in Supabase
    const { data: plaidItem, error: itemErr } = await supabase
      .from('plaid_items')
      .upsert({
        user_id:          userId,
        plaid_item_id:    item_id,
        access_token,
        institution_id:   institutionId   || null,
        institution_name: institutionName || null,
      }, { onConflict: 'user_id,plaid_item_id' })
      .select()
      .single()

    if (itemErr) throw itemErr

    // 3. Fetch accounts from Plaid and create rows in the accounts table
    const acctRes = await plaidClient.accountsGet({ access_token })
    const plaidAccounts = acctRes.data.accounts

    for (const pa of plaidAccounts) {
      const type = mapPlaidType(pa.type, pa.subtype)
      const { error: acctErr } = await supabase
        .from('accounts')
        .upsert({
          user_id:          userId,
          plaid_account_id: pa.account_id,
          plaid_item_id:    plaidItem.id,
          name:             pa.name || pa.official_name,
          type,
          institution:      institutionName || null,
          balance:          pa.balances.current ?? 0,
          card_last4:       pa.mask || null,
          color:            colorForType(type),
        }, { onConflict: 'user_id,plaid_account_id' })

      if (acctErr) console.error('Account upsert error:', acctErr)
    }

    res.status(200).json({ success: true, itemId: plaidItem.id, accountCount: plaidAccounts.length })
  } catch (err) {
    console.error('Plaid exchange-token error:', err.response?.data || err.message)
    res.status(500).json({ error: err.response?.data?.error_message || err.message })
  }
}

function mapPlaidType(type, subtype) {
  if (type === 'credit')    return 'Credit Card'
  if (subtype === 'savings') return 'Savings'
  if (subtype === 'checking') return 'Checking'
  if (type === 'investment') return 'Investment'
  return 'Other'
}

function colorForType(type) {
  const colors = { Checking: '#1a1a2e', Savings: '#0f3460', 'Credit Card': '#533483', Investment: '#2a9d8f' }
  return colors[type] || '#2b2d42'
}
