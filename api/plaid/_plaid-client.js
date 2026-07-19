// api/plaid/_plaid-client.js
// ═════════════════════════════════════════════════════════════════════════════
// ⚠ THIS IS THE ONLY FILE THAT TALKS TO THE REAL PLAID API. ⚠
//
// Every other Plaid file (enroll.js, sync-transactions.js, disconnect.js,
// webhook.js) goes through the functions exported here, so when Plaid
// credentials arrive there is exactly one place to wire them up.
//
// ── COST / CALL MANIFEST (keep this updated when adding new Plaid calls) ────
//   POST /link/token/create           createLinkToken()      free
//   POST /item/public_token/exchange  exchangePublicToken()  free
//   POST /accounts/get                getAccounts()          free — included with
//                                                             the Transactions product;
//                                                             returns each account's
//                                                             CACHED balance (as of the
//                                                             last successful Item
//                                                             update), which is what we
//                                                             use instead of paying for
//                                                             a live refresh (below).
//   POST /transactions/sync           syncTransactions()     Transactions product,
//                                                             billed per active Item
//                                                             (not per call) under most
//                                                             Plaid plans — TODO: confirm
//                                                             the exact rate on your
//                                                             plan once an account
//                                                             exists.
//   POST /item/remove                 removeItem()           free; revokes access and
//                                                             stops future billing for
//                                                             that item.
//   POST /accounts/balance/get        NOT IMPLEMENTED        Balance product, billed
//                                                             $0.05–$0.15/call for a
//                                                             forced real-time refresh
//                                                             — see the
//                                                             getAccountBalances()
//                                                             tripwire below. Balance is
//                                                             read from /accounts/get's
//                                                             cached value instead.
// Callers: getAccounts/syncTransactions are only ever invoked from syncItem() in
// _sync-core.js. syncItem is called by enroll.js (initial import),
// sync-transactions.js (manual "Sync All"), and webhook.js (Plaid-pushed
// SYNC_UPDATES_AVAILABLE events). Every real network call is logged at runtime
// with a `[plaid:api]` prefix — check Vercel function logs to see actual usage.
//
// MOCK MODE (current default):
//   Until PLAID_USE_MOCKS=false is set AND PLAID_CLIENT_ID/PLAID_SECRET are
//   both present, every function returns realistic sample data from
//   ./_mock-data.js and never makes a network call. This lets the whole
//   enroll -> sync -> display flow run end-to-end with no credentials.
//
// TODO ── Plaid sandbox is instant/self-serve (no approval wait, unlike
// Teller) — https://dashboard.plaid.com/signup. Test the full flow against
// PLAID_ENV=sandbox (with Plaid's `user_good` / `pass_good` test credentials)
// before ever touching development/production. Set these env vars in Vercel
// (Project → Settings → Environment Variables) and locally for `vercel dev`:
//
//   PLAID_USE_MOCKS=false             ← flips this module to real API calls
//   PLAID_CLIENT_ID=...                ← Plaid dashboard → Keys
//   PLAID_SECRET=...                   ← Plaid dashboard → Keys (per-environment)
//   PLAID_ENV=sandbox                  ← 'sandbox' | 'development' | 'production'
//   PLAID_WEBHOOK_URL=...              ← optional: https://<your-domain>/api/plaid/webhook
//
// Notes on the real API (https://plaid.com/docs/api/):
//   - Base URL varies by PLAID_ENV: sandbox.plaid.com / development.plaid.com /
//     production.plaid.com
//   - Auth is `PLAID-CLIENT-ID` / `PLAID-SECRET` headers on every request (no
//     mTLS certificate needed, unlike Teller)
// ═════════════════════════════════════════════════════════════════════════════
import crypto from 'crypto'
import { mockAccounts, mockSync, mockItem } from './_mock-data.js'

const PLAID_HOSTS = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com',
}

export function isMockMode() {
  // Explicit opt-out via PLAID_USE_MOCKS=false is required, AND credentials
  // must actually be present — so nothing accidentally starts hitting the
  // real API just because someone flips the flag before keys exist.
  if (process.env.PLAID_USE_MOCKS !== 'false') return true
  return !process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET
}

function baseUrl() {
  const env = process.env.PLAID_ENV || 'sandbox'
  return PLAID_HOSTS[env] || PLAID_HOSTS.sandbox
}

function logRealCall(path, note) {
  // Visible in Vercel function logs — an audit trail of actual Plaid usage,
  // separate from the static cost comments above.
  console.log(`[plaid:api] POST ${path}${note ? ` — ${note}` : ''}`)
}

// ── Low-level request helper (real mode only) ────────────────────────────────
async function plaidRequest(path, body) {
  const res = await fetch(`${baseUrl()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch { /* non-JSON body */ }

  if (!res.ok) {
    const message = json?.error_message || `Plaid API ${path} failed (${res.status})`
    const err = new Error(message)
    err.statusCode = res.status
    err.errorCode = json?.error_code
    if (json?.error_code === 'RATE_LIMIT_EXCEEDED' || res.status === 429) {
      err.rateLimited = true
    }
    throw err
  }
  return json
}

// ── Public API ────────────────────────────────────────────────────────────────

// Create a Link token for the frontend to open Plaid Link with. POST /link/token/create
export async function createLinkToken({ userId, webhookUrl } = {}) {
  if (isMockMode()) return { link_token: 'link-sandbox-mock-do-not-use-in-production' }
  logRealCall('/link/token/create')
  return plaidRequest('/link/token/create', {
    client_name: 'Stride Finance',
    products: ['transactions'],
    country_codes: ['US'],
    language: 'en',
    user: { client_user_id: userId },
    ...(webhookUrl ? { webhook: webhookUrl } : {}),
  })
}

// Exchange a Link `public_token` for a long-lived access_token + item_id.
// POST /item/public_token/exchange
export async function exchangePublicToken(publicToken) {
  if (isMockMode()) {
    const mock = mockItem()
    return { access_token: mock.accessToken, item_id: mock.itemId }
  }
  logRealCall('/item/public_token/exchange')
  return plaidRequest('/item/public_token/exchange', { public_token: publicToken })
}

// List accounts (+ cached balances) for an item. POST /accounts/get
export async function getAccounts(accessToken) {
  if (isMockMode()) return { accounts: mockAccounts() }
  logRealCall('/accounts/get', 'free — included with Transactions, returns cached balance')
  return plaidRequest('/accounts/get', { access_token: accessToken })
}

// Cursor-based transaction sync. POST /transactions/sync
export async function syncTransactions(accessToken, cursor) {
  if (isMockMode()) return mockSync(cursor)
  logRealCall('/transactions/sync')
  return plaidRequest('/transactions/sync', {
    access_token: accessToken,
    ...(cursor ? { cursor } : {}),
    count: 250,
  })
}

// Revoke API access to an item (covers every account under it). POST /item/remove
export async function removeItem(accessToken) {
  if (isMockMode()) return { success: true }
  logRealCall('/item/remove', 'revokes access, stops future billing for this item')
  return plaidRequest('/item/remove', { access_token: accessToken })
}

// Deliberately NOT implemented: POST /accounts/balance/get costs $0.05-$0.15
// per call (Balance product, forces a live refresh from the institution).
// Balance is read from /accounts/get's cached value instead (see syncItem in
// _sync-core.js) — free, and fresh as of the last successful Item update.
export function getAccountBalances() {
  throw new Error(
    "getAccountBalances() is intentionally not implemented — Plaid's /accounts/balance/get " +
    'endpoint costs $0.05-$0.15/call for a forced real-time refresh. Use the cached balance ' +
    'from getAccounts() / /accounts/get instead (see syncItem in _sync-core.js).'
  )
}

// ── Webhook verification ─────────────────────────────────────────────────────
// Plaid signs webhooks with a JWT (ES256) in the `Plaid-Verification` header.
// Verification: decode the JWT header to get `kid`, fetch (and cache) the
// matching public key via /webhook_verification_key/get, verify the JWS
// signature, then confirm the payload's `iat` is recent and its
// `request_body_sha256` matches a hash of the raw body.
// https://plaid.com/docs/api/webhooks/webhook-verification/
const verificationKeyCache = new Map() // key_id -> JWK

function base64UrlDecode(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

async function getVerificationKey(keyId) {
  if (verificationKeyCache.has(keyId)) return verificationKeyCache.get(keyId)
  logRealCall('/webhook_verification_key/get')
  const { key } = await plaidRequest('/webhook_verification_key/get', { key_id: keyId })
  verificationKeyCache.set(keyId, key)
  return key
}

export async function verifyWebhookSignature(rawBody, jwtHeader) {
  if (isMockMode()) return true // mock mode never receives real Plaid webhooks
  if (!jwtHeader) return false

  const parts = jwtHeader.split('.')
  if (parts.length !== 3) return false
  const [headerB64, payloadB64, sigB64] = parts

  let header, payload
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString('utf8'))
    payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'))
  } catch {
    return false
  }
  if (header.alg !== 'ES256' || !header.kid) return false

  // Reject replays older than 5 minutes
  if (!payload.iat || Math.abs(Date.now() / 1000 - payload.iat) > 300) return false

  // Confirm the raw body matches the hash the JWT claims to be signing
  const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex')
  if (bodyHash !== payload.request_body_sha256) return false

  try {
    const jwk = await getVerificationKey(header.kid)
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' })
    // ES256 JWS signatures are raw (r||s / IEEE-P1363), not DER.
    return crypto.verify(
      'sha256',
      Buffer.from(`${headerB64}.${payloadB64}`),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      base64UrlDecode(sigB64)
    )
  } catch (err) {
    console.error('plaid webhook verification failed:', err.message)
    return false
  }
}
