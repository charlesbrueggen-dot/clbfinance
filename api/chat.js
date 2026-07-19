import { isUserPro } from './_requirePro.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: { message: 'ANTHROPIC_API_KEY is not set in environment variables' } })
  }

  const { userId, ...anthropicBody } = req.body || {}
  if (!(await isUserPro(userId))) {
    return res.status(403).json({ error: { message: 'Pro subscription required' } })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    })

    const text = await response.text()

    let data
    try {
      data = JSON.parse(text)
    } catch {
      return res.status(500).json({ error: { message: `Anthropic returned non-JSON: ${text.slice(0, 200)}` } })
    }

    return res.status(response.status).json(data)

  } catch (err) {
    return res.status(500).json({ error: { message: err.message } })
  }
}
