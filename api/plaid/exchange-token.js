import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid'
import { createClient } from '@supabase/supabase-js'

const plaidClient = new PlaidApi(new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: { headers: {
    'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
    'PLAID-SECRET':    process.env.PLAID_SECRET,
  }},
}))

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { publicToken, userId, institutionId, institutionName } = req.body
  if (!publicToken || !userId) return res.status(400).json({ error: 'publicToken and userId required' })
  try {
    const exchangeRes = await plaidClient.itemPublicTokenExchange({ public_token: publicToken })
    const { access_token, item_id } = exchangeRes.data

    const { data: plaidItem, error: itemErr } = await supabase
      .from('plaid_items')
      .upsert({ user_id: userId, plaid_item_id: item_id, access_token, institution_id: institutionId || null, institution_name: institutionName || null }, { onConflict: 'user_id,plaid_item_id' })
      .select().single()
    if (itemErr) throw itemErr

    const acctRes = await plaidClient.accountsGet({ access_token })
    for (const pa of acctRes.data.accounts) {
      const type = mapPlaidType(pa.type, pa.subtype)
      await supabase.from('accounts').upsert({
        user_id: userId, plaid_account_id: pa.account_id, plaid_item_id: plaidItem.id,
        name: pa.name || pa.official_name, type, institution: institutionName || null,
        balance: pa.balances.current ?? 0, card_last4: pa.mask || null, color: colorForType(type),
      }, { onConflict: 'user_id,plaid_account_id' })
    }
    res.status(200).json({ success: true, itemId: plaidItem.id, accountCount: acctRes.data.accounts.length })
  } catch (err) {
    console.error('exchange-token error:', err.response?.data || err.message)
    res.status(500).json({ error: err.response?.data?.error_message || err.message })
  }
}

function mapPlaidType(type, subtype) {
  if (type === 'credit') return 'Credit Card'
  if (subtype === 'savings') return 'Savings'
  if (subtype === 'checking') return 'Checking'
  if (type === 'investment') return 'Investment'
  return 'Other'
}
function colorForType(type) {
  const colors = { Checking: '#1a1a2e', Savings: '#0f3460', 'Credit Card': '#533483', Investment: '#2a9d8f' }
  return colors[type] || '#2b2d42'
}
