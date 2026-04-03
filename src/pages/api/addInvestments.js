import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' })
  }

  const { symbol, name, price } = req.body

  if (!symbol || !price) {
    return res.status(400).json({ error: 'Symbol and price required' })
  }

  const { data, error } = await supabase
    .from('investments')
    .insert([{ symbol, name, price }])

  if (error) return res.status(500).json({ error: error.message })

  res.status(200).json({ message: 'Investment added!', data })
}
