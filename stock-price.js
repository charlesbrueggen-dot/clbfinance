export default async function handler(req, res) {
  const { symbol } = req.query
  if (!symbol) return res.status(400).json({ error: 'Symbol required' })
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    const data = await response.json()
    res.status(200).json(data)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch price' })
  }
}
