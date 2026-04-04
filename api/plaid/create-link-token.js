// api/plaid/create-link-token.js
// Called by the frontend to start Plaid Link flow
// POST { userId }  →  { link_token }

const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid')

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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'userId required' })

  try {
    const response = await plaidClient.linkTokenCreate({
      user:          { client_user_id: userId },
      client_name:   'Stride Finance',
      products:      ['transactions'],
      country_codes: ['US'],
      language:      'en',
    })
    res.status(200).json({ link_token: response.data.link_token })
  } catch (err) {
    console.error('Plaid create-link-token error:', err.response?.data || err.message)
    res.status(500).json({ error: err.response?.data?.error_message || err.message })
  }
}
