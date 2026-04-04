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
  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })
  try {
    const { data: items, error: itemsErr } = await supabase.from('plaid_items').select('*').eq('user_id', userId)
    if (itemsErr) throw itemsErr
    if (!items?.length) return res.status(200).json({ synced: 0, removed: 0, message: 'No connected banks' })
 
    let totalSynced = 0, totalRemoved = 0
 
    for (const item of items) {
      let cursor = item.cursor || null, hasMore = true
      while (hasMore) {
        const syncRes = await plaidClient.transactionsSync({ access_token: item.access_token, cursor: cursor || undefined, count: 500 })
        const { added, modified, removed, next_cursor, has_more } = syncRes.data
        hasMore = has_more; cursor = next_cursor
 
        const { data: accts } = await supabase.from('accounts').select('id, plaid_account_id, balance').eq('user_id', userId)
        const acctMap = {}
        for (const a of (accts || [])) acctMap[a.plaid_account_id] = a
 
        const toUpsert = [...added, ...modified].map(t => {
          const acct = acctMap[t.account_id]
          const amount = Math.abs(t.amount)
          const kind = t.amount < 0 ? 'income' : 'expense'
          const { category, subcategory } = classifyCategory(t, kind)
          return {
            user_id: userId, account_id: acct?.id || null, plaid_txn_id: t.transaction_id,
            description: t.name, amount, kind,
            category: kind === 'expense' ? category : null,
            subcategory: kind === 'expense' ? subcategory : null,
            source: kind === 'income' ? category : null,
            date: t.date, merchant: t.merchant_name || null,
            auto_categorized: true, source_type: 'plaid',
          }
        })
 
        if (toUpsert.length > 0) {
          const { error: upsertErr } = await supabase.from('account_transactions').upsert(toUpsert, { onConflict: 'plaid_txn_id', ignoreDuplicates: false })
          if (upsertErr) console.error('Upsert error:', upsertErr)
          totalSynced += toUpsert.length
        }
 
        for (const r of removed) {
          await supabase.from('account_transactions').delete().eq('plaid_txn_id', r.transaction_id)
          totalRemoved++
        }
 
        const balRes = await plaidClient.accountsGet({ access_token: item.access_token })
        for (const pa of balRes.data.accounts) {
          const acct = acctMap[pa.account_id]
          if (acct) await supabase.from('accounts').update({ balance: pa.balances.current ?? acct.balance }).eq('id', acct.id).eq('user_id', userId)
        }
      }
      await supabase.from('plaid_items').update({ cursor, last_synced_at: new Date().toISOString() }).eq('id', item.id)
    }
    res.status(200).json({ synced: totalSynced, removed: totalRemoved })
  } catch (err) {
    console.error('Plaid sync error:', err.response?.data || err.message)
    res.status(500).json({ error: err.response?.data?.error_message || err.message })
  }
}
 
function classifyCategory(t, kind) {
  if (kind === 'income') return { category: 'Salary', subcategory: null }
  const plaidCat = (t.personal_finance_category?.primary || t.category?.[0] || '').toUpperCase()
  const name = (t.merchant_name || t.name || '').toLowerCase()
  if (['RENT_AND_UTILITIES','HOME_IMPROVEMENT'].includes(plaidCat) || name.includes('rent') || name.includes('electric') || name.includes('water') || name.includes('gas')) return { category: 'Needs', subcategory: 'Utilities' }
  if (plaidCat === 'FOOD_AND_DRINK' && (name.includes('grocery') || name.includes('kroger') || name.includes('whole foods') || name.includes('aldi') || name.includes('trader joe'))) return { category: 'Needs', subcategory: 'Groceries' }
  if (['TRANSPORTATION'].includes(plaidCat) || name.includes('gas station') || name.includes('uber') || name.includes('lyft') || name.includes('transit')) return { category: 'Needs', subcategory: 'Transportation' }
  if (['MEDICAL'].includes(plaidCat) || name.includes('pharmacy') || name.includes('doctor') || name.includes('hospital')) return { category: 'Needs', subcategory: 'Healthcare' }
  if (name.includes('insurance')) return { category: 'Needs', subcategory: 'Insurance' }
  if (plaidCat === 'FOOD_AND_DRINK') return { category: 'Wants', subcategory: 'Dining' }
  if (['ENTERTAINMENT','RECREATION'].includes(plaidCat)) return { category: 'Wants', subcategory: 'Entertainment' }
  if (['GENERAL_MERCHANDISE','APPAREL_AND_ACCESSORIES'].includes(plaidCat)) return { category: 'Wants', subcategory: 'Shopping' }
  if (['TRAVEL'].includes(plaidCat)) return { category: 'Wants', subcategory: 'Travel' }
  if (name.includes('netflix') || name.includes('spotify') || name.includes('hulu') || name.includes('disney') || name.includes('amazon prime')) return { category: 'Wants', subcategory: 'Subscriptions' }
  if (['LOAN_PAYMENTS'].includes(plaidCat)) return { category: 'Needs', subcategory: 'Other' }
  if (['SAVINGS'].includes(plaidCat)) return { category: 'Savings', subcategory: 'Emergency Fund' }
  return { category: 'Wants', subcategory: 'Other' }
}
 
