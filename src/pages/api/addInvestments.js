// pages/api/addInvestment.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  // ALLOW CORS
  res.setHeader('Access-Control-Allow-Origin', '*') // allows any site
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { user_id, symbol, name, price } = req.body

    if (!user_id || !symbol || !name || price == null) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const { data, error } = await supabase
      .from('investments')
      .insert([{ user_id, symbol, name, price }])

    if (error) throw error

    res.status(200).json({ success: true, data })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
