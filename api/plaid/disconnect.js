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
  const { userId, itemId } = req.body
  if (!userId || !itemId) return res.status(400).json({ error: 'userId and itemId required' })
  try {
    const { data: item, error: fetchErr } = await supabase.from('plaid_items').select('access_token').eq('id', itemId).eq('user_id', userId).single()
    if (fetchErr || !item) return res.status(404).json({ error: 'Item not found' })
    await plaidClient.itemRemove({ access_token: item.access_token })
    await supabase.from('plaid_items').delete().eq('id', itemId).eq('user_id', userId)
    res.status(200).json({ success: true })
  } catch (err) {
    console.error('disconnect error:', err.response?.data || err.message)
    res.status(500).json({ error: err.response?.data?.error_message || err.message })
  }
}
