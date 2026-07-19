// api/categorize.js
// Batch AI categorization for transactions that fall through
// autoCategorize()'s keyword matcher (src/hooks/useTransactions.js) — used
// by the CSV import preview step (src/pages/Import.jsx). Uses Claude Haiku
// 4.5 with a cached system prompt (the taxonomy repeats on every batch) and
// forces a tool call for structured, parseable output instead of free-text
// parsing.
//
// Unlike api/chat.js (a raw proxy — the caller builds the full Anthropic
// request body), this endpoint builds the request itself so the taxonomy
// definition lives in one place instead of being duplicated into every
// caller.
//
// Requires an active Pro subscription (checked server-side via
// isUserPro() in _requirePro.js — the client-side ProGate on the Import page
// isn't enough on its own since this endpoint could otherwise be called
// directly).
//
// POST body: { userId, transactions: [{ id, description, merchant?, kind }] }
// Response:  { assignments: [{ id, category?, subcategory?, source? }] }

import { isUserPro } from './_requirePro.js'
import { verifyCaller } from './_supabase.js'

const MODEL = 'claude-haiku-4-5-20251001'

// Mirrors CATEGORIES/INCOME_SOURCES in src/pages/Accounts.jsx exactly — keep
// these in sync if that taxonomy ever changes.
const EXPENSE_CATEGORIES = {
  Needs:   ['Rent', 'Groceries', 'Utilities', 'Transportation', 'Healthcare', 'Insurance', 'Other'],
  Wants:   ['Dining', 'Entertainment', 'Shopping', 'Travel', 'Subscriptions', 'Other'],
  Savings: ['Emergency Fund', 'Retirement', 'Investment', 'Vacation', 'Other'],
}
const INCOME_SOURCES = ['Salary', 'Freelance', 'Investment Return', 'Refund', 'Cashback', 'Transfer In', 'Other']

const SYSTEM_PROMPT = `You are a transaction categorizer for a personal finance app. You are given a batch of bank transactions that a keyword-based classifier could not confidently categorize, and must assign each one the best-fitting category from this app's exact taxonomy.

For EXPENSE transactions, assign one of:
${Object.entries(EXPENSE_CATEGORIES).map(([cat, subs]) => `- ${cat}: ${subs.join(', ')}`).join('\n')}

For INCOME transactions, assign one of these sources:
${INCOME_SOURCES.join(', ')}

Guidelines:
- Infer the real-world merchant/purpose from the description and merchant fields (e.g. "SQ *BLUE BOTTLE COFFEE" is a coffee shop -> Wants/Dining).
- Only use "Other" (or income source "Other") when the transaction is genuinely ambiguous — prefer a specific, confident category whenever the description gives a reasonable signal.
- Use the transaction's given \`kind\` to decide whether to assign a category+subcategory (expense) or a source (income) — never both, never neither.
- Call the categorize_transactions tool exactly once with one assignment per transaction, using the same \`id\` values given, in any order.`

const TOOL = {
  name: 'categorize_transactions',
  description: 'Return a category (expense) or source (income) assignment for each given transaction.',
  input_schema: {
    type: 'object',
    properties: {
      assignments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id:          { type: 'string', description: 'The transaction id from the input, unchanged' },
            category:    { type: 'string', enum: Object.keys(EXPENSE_CATEGORIES), description: 'Expense transactions only' },
            subcategory: { type: 'string', description: 'Expense transactions only — must match one of the subcategories listed for the chosen category' },
            source:      { type: 'string', enum: INCOME_SOURCES, description: 'Income transactions only' },
          },
          required: ['id'],
        },
      },
    },
    required: ['assignments'],
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: { message: 'ANTHROPIC_API_KEY is not set in environment variables' } })
  }

  const { userId, transactions } = req.body || {}
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return res.status(400).json({ error: { message: 'transactions (non-empty array) required' } })
  }
  if (!(await verifyCaller(req, userId))) {
    return res.status(401).json({ error: { message: 'Not authenticated as this user' } })
  }
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
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: [TOOL],
        tool_choice: { type: 'tool', name: 'categorize_transactions' },
        messages: [{
          role: 'user',
          content: JSON.stringify(transactions.map(t => ({
            id: String(t.id), description: t.description || '', merchant: t.merchant || '', kind: t.kind,
          }))),
        }],
      }),
    })

    const text = await response.text()
    let data
    try {
      data = JSON.parse(text)
    } catch {
      return res.status(500).json({ error: { message: `Anthropic returned non-JSON: ${text.slice(0, 200)}` } })
    }
    if (!response.ok) {
      return res.status(response.status).json(data)
    }

    const toolUse = data.content?.find(block => block.type === 'tool_use' && block.name === 'categorize_transactions')
    const assignments = toolUse?.input?.assignments || []
    res.status(200).json({ assignments })
  } catch (err) {
    res.status(500).json({ error: { message: err.message } })
  }
}
