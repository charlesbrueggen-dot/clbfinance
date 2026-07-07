// api/teller/_teller-client.js
// ═════════════════════════════════════════════════════════════════════════════
// ⚠ THIS IS THE ONLY FILE THAT TALKS TO THE REAL TELLER API. ⚠
//
// Every other Teller file (enroll.js, sync-transactions.js, disconnect.js,
// webhook.js) goes through the functions exported here, so when Teller
// credentials arrive there is exactly one place to wire them up.
//
// ── COST / CALL MANIFEST (keep this updated when adding new Teller calls) ───
//   GET    /accounts                     listAccounts()      flat-fee Transactions
//   GET    /accounts/:id/transactions    listTransactions()  product ($0.30/enrollment
//                                                             /month) — call volume
//                                                             does NOT affect cost.
//   DELETE /accounts/:id                 deleteAccount()     revokes access; stops
//                                                             future billing for that
//                                                             account/enrollment.
//   GET    /accounts/:id/balances        NOT IMPLEMENTED     $0.10/call — see the
//                                                             getAccountBalances()
//                                                             tripwire below. Balance
//                                                             is derived from
//                                                             running_balance instead
//                                                             (_sync-core.js).
// Callers: listAccounts/listTransactions/deleteAccount are only ever invoked from
// syncEnrollment() in _sync-core.js (deleteAccount is also called directly from
// disconnect.js). syncEnrollment is called by enroll.js (initial import),
// sync-transactions.js (manual "Sync All"), and webhook.js (Teller-pushed events).
// Every real network call is logged at runtime with a `[teller:api]` prefix —
// check Vercel function logs to see actual usage.
//
// MOCK MODE (current default):
//   Until TELLER_USE_MOCKS=false is set, every function returns realistic
//   sample data from ./_mock-data.js and never makes a network call. This lets
//   the whole enroll → sync → display flow run end-to-end with no credentials.
//
// TODO ── once your Teller account is approved, set these env vars in Vercel
// (Project → Settings → Environment Variables) and locally for `vercel dev`:
//
//   TELLER_USE_MOCKS=false           ← flips this module to real API calls
//   TELLER_ENVIRONMENT=sandbox       ← 'sandbox' | 'development' | 'production'
//   TELLER_CERTIFICATE_B64=...       ← base64 of certificate.pem from the
//                                      Teller dashboard (base64 so the PEM
//                                      survives being an env var)
//   TELLER_PRIVATE_KEY_B64=...       ← base64 of private_key.pem
//   TELLER_SIGNING_SECRET=...        ← webhook signing secret (Teller
//                                      dashboard → Application → Webhooks)
//
//   To base64-encode the PEMs:  base64 -w0 certificate.pem
//   (PowerShell: [Convert]::ToBase64String([IO.File]::ReadAllBytes('certificate.pem')))
//
// Notes on the real API (https://teller.io/docs):
//   - Base URL https://api.teller.io
//   - Auth is HTTP Basic with the enrollment's access token as the username
//     and an empty password
//   - development/production require the mTLS client certificate above;
//     sandbox does not, but sending it is harmless
// ═════════════════════════════════════════════════════════════════════════════
import https from 'https'
import crypto from 'crypto'
import { mockAccounts, mockTransactions } from './_mock-data.js'

const TELLER_API_HOST = 'api.teller.io'

export function isMockMode() {
  // Mock until explicitly disabled, so nothing breaks before credentials exist.
  return process.env.TELLER_USE_MOCKS !== 'false'
}

function logRealCall(method, path, note) {
  // Visible in Vercel function logs — an audit trail of actual Teller usage,
  // separate from the static cost comments above.
  console.log(`[teller:api] ${method} ${path}${note ? ` — ${note}` : ''}`)
}

// ── Low-level request helper (real mode only) ────────────────────────────────
let cachedAgent = null
function mtlsAgent() {
  if (cachedAgent) return cachedAgent
  const cert = process.env.TELLER_CERTIFICATE_B64
  const key  = process.env.TELLER_PRIVATE_KEY_B64
  cachedAgent = new https.Agent({
    cert: cert ? Buffer.from(cert, 'base64').toString('utf8') : undefined,
    key:  key  ? Buffer.from(key,  'base64').toString('utf8') : undefined,
  })
  return cachedAgent
}

function tellerRequest(path, accessToken, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = https.request({
      host: TELLER_API_HOST,
      path,
      method,
      agent: mtlsAgent(),
      auth: `${accessToken}:`, // Basic auth: token as username, empty password
      headers: { Accept: 'application/json' },
    }, res => {
      let body = ''
      res.on('data', chunk => { body += chunk })
      res.on('end', () => {
        let json = null
        try { json = body ? JSON.parse(body) : null } catch { /* non-JSON body */ }
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(json)

        if (res.statusCode === 429) {
          // Distinct from other failures so callers can back off instead of
          // just showing a generic "sync failed" error.
          const err = new Error('Teller API rate limit hit (429) — back off before retrying')
          err.statusCode = 429
          err.rateLimited = true
          err.retryAfterSeconds = res.headers['retry-after'] ? Number(res.headers['retry-after']) : null
          return reject(err)
        }

        const message = json?.error?.message || `Teller API ${method} ${path} failed (${res.statusCode})`
        const err = new Error(message)
        err.statusCode = res.statusCode
        reject(err)
      })
    })
    req.on('error', reject)
    req.end()
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

// List accounts for an enrollment. GET /accounts
export async function listAccounts(accessToken) {
  if (isMockMode()) return mockAccounts()
  logRealCall('GET', '/accounts', 'flat-fee product, no per-call cost')
  return tellerRequest('/accounts', accessToken)
}

// List transactions for one account, newest first.
// GET /accounts/:id/transactions?count=N
export async function listTransactions(accessToken, accountId, { count = 200 } = {}) {
  if (isMockMode()) return mockTransactions(accountId, count)
  logRealCall('GET', `/accounts/${accountId}/transactions`, 'flat-fee product, no per-call cost')
  return tellerRequest(`/accounts/${accountId}/transactions?count=${count}`, accessToken)
}

// Revoke API access to a single account. DELETE /accounts/:id
// Once every account under an enrollment has been revoked, Teller stops
// billing for that enrollment — see disconnect.js for why we only drop our
// local record after *every* account here has succeeded.
export async function deleteAccount(accessToken, accountId) {
  if (isMockMode()) return { success: true }
  logRealCall('DELETE', `/accounts/${accountId}`, 'revokes access, stops future billing for this account')
  return tellerRequest(`/accounts/${accountId}`, accessToken, 'DELETE')
}

// Deliberately NOT implemented: GET /accounts/:id/balances costs $0.10/call.
// Balance is derived from account_transactions.running_balance instead (see
// syncEnrollment in _sync-core.js). This stub exists so an accidental future
// call fails loudly at commit/PR-review time instead of silently costing
// money in production.
export function getAccountBalances() {
  throw new Error(
    "getAccountBalances() is intentionally not implemented — Teller's /accounts/:id/balances " +
    'endpoint costs $0.10/call. Derive balance from the running_balance of the newest posted ' +
    'transaction instead (see syncEnrollment in _sync-core.js).'
  )
}

// Verify a Teller webhook signature.
// Header format:  Teller-Signature: t=<unix_ts>,v1=<hex hmac>
// Signed payload: `${t}.${rawRequestBody}` with HMAC-SHA256(TELLER_SIGNING_SECRET)
export function verifyWebhookSignature(rawBody, signatureHeader) {
  const secret = process.env.TELLER_SIGNING_SECRET
  if (!secret) {
    // TODO: remove this bypass once TELLER_SIGNING_SECRET is configured —
    // without it, webhook authenticity is only enforced when the secret exists.
    console.warn('TELLER_SIGNING_SECRET not set — skipping webhook signature verification (mock/dev only)')
    return isMockMode()
  }
  if (!signatureHeader) return false

  const parts = Object.fromEntries(
    signatureHeader.split(',').map(kv => kv.trim().split('=', 2))
  )
  const timestamp = parts.t
  const signatures = signatureHeader
    .split(',').map(kv => kv.trim())
    .filter(kv => kv.startsWith('v1='))
    .map(kv => kv.slice(3))
  if (!timestamp || signatures.length === 0) return false

  // Reject replays older than 5 minutes
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex')

  return signatures.some(sig => {
    try {
      return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))
    } catch {
      return false
    }
  })
}
