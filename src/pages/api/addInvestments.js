// pages/api/addInvestment.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // use service role for server-side
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { user_id, symbol, name, price } = req.body

    if (!user_id || !symbol || !name || !price) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const { data, error } = await supabase
      .from('investments') // make sure this is your table
      .insert([{ user_id, symbol, name, price }])
      .select() // return inserted row

    if (error) throw error

    res.status(200).json({ success: true, investment: data[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
