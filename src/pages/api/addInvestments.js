import { createClient } from '@supabase/supabase-js'

// Make sure these environment variables are set in Vercel or .env.local
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { symbol, name, price } = req.body

    // Check for missing data
    if (!symbol || !name || price == null) {
      return res.status(400).json({ error: 'Missing data' })
    }

    // Insert into Supabase
    const { data, error } = await supabase
      .from('investments')
      .insert([{ symbol, name, price }])
      .select()

    if (error) throw error

    // Return success
    res.status(200).json({ success: true, investment: data[0] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
