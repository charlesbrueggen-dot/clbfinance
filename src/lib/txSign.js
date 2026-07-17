// src/lib/txSign.js
// Shared sign convention for account_transactions: `amount` is always stored
// as a positive number, and direction is carried separately in `kind`
// ('income' | 'expense'). Originally lived inline in api/teller/_sync-core.js
// (Teller convention: negative amount = money out, positive = money in) —
// pulled out here so the CSV importer can normalize to the exact same
// convention instead of re-deriving it.
export function normalizeSignedAmount(rawAmount) {
  const amount = Number(rawAmount)
  const kind = amount > 0 ? 'income' : 'expense'
  return { amount: Math.abs(amount), kind }
}
