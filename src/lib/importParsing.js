// src/lib/importParsing.js
// Bank-agnostic CSV/XLS/XLSX statement parsing: fuzzy column detection, date
// format auto-detection, amount-string parsing, and row normalization onto
// the same { amount, kind } convention used everywhere else in the app
// (see src/lib/txSign.js).
import { normalizeSignedAmount } from './txSign.js'

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB, matches the UI's stated limit

// ── File → grid of strings ───────────────────────────────────────────────────
// SheetJS auto-detects CSV vs XLS vs XLSX from the byte content, so one code
// path handles all three formats. raw:false renders every cell (including
// genuine Excel date cells) as display text, so downstream date parsing only
// ever has to deal with strings.
//
// SheetJS is ~400KB minified — by far the app's largest dependency — and is
// only ever needed at the moment a user actually picks a file to import. The
// dynamic import() keeps it out of every page bundle entirely; it downloads
// (once, then cached) in the instant between choosing a file and parsing it.
export async function parseSpreadsheetFile(file) {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File is ${(file.size / (1024 * 1024)).toFixed(1)}MB, which is over the 10MB limit.`)
  }
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  let workbook
  try {
    workbook = XLSX.read(buf, { type: 'array' })
  } catch {
    throw new Error("We couldn't read this file. Make sure it's a valid CSV, XLS, or XLSX export from your bank.")
  }
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('The file has no sheets/data in it.')
  const sheet = workbook.Sheets[sheetName]
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' })
  const cleaned = grid
    .map(row => row.map(cell => String(cell ?? '').trim()))
    .filter(row => row.some(cell => cell !== ''))
  if (cleaned.length < 2) throw new Error('The file needs a header row plus at least one transaction row.')
  const headers = cleaned[0]
  const rows = cleaned.slice(1)
  return { headers, rows }
}

// ── Fuzzy column detection ───────────────────────────────────────────────────
function normalizeHeader(h) {
  return String(h ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

const FIELD_ALIASES = {
  date: {
    exact: ['date', 'transaction date', 'trans date', 'posted date', 'post date', 'posting date', 'effective date', 'date posted', 'value date'],
    contains: ['date'],
  },
  description: {
    exact: ['description', 'desc', 'payee', 'merchant', 'merchant name', 'name', 'memo', 'transaction', 'details', 'narrative', 'reference'],
    contains: ['desc', 'payee', 'merchant', 'memo', 'narrative', 'detail', 'reference'],
  },
  amount: {
    exact: ['amount', 'amt', 'transaction amount', 'value'],
    contains: ['amount', 'amt'],
  },
  debit: {
    exact: ['debit', 'debit amount', 'withdrawal', 'withdrawals', 'money out', 'payment amount', 'charges'],
    contains: ['debit', 'withdrawal', 'charge'],
  },
  credit: {
    exact: ['credit', 'credit amount', 'deposit', 'deposits', 'money in'],
    contains: ['credit', 'deposit'],
  },
}

function scoreHeader(header, field) {
  const h = normalizeHeader(header)
  if (!h) return 0
  if (h.includes('balance')) return 0 // never treat a running/ledger balance column as transactional
  const def = FIELD_ALIASES[field]
  if (def.exact.includes(h)) return 100
  if (def.contains.some(c => h.includes(c))) return 60
  return 0
}

// Returns { columns: { date, description, amount?, debit?, credit? }, confidence: { field: score } }
export function detectColumns(headers) {
  const priority = ['date', 'amount', 'debit', 'credit', 'description']
  const used = new Set()
  const columns = {}
  const confidence = {}
  for (const field of priority) {
    const scored = headers
      .map((h, i) => ({ i, score: scoreHeader(h, field) }))
      .filter(c => c.score > 0 && !used.has(c.i))
      .sort((a, b) => b.score - a.score)
    if (scored.length) {
      columns[field] = scored[0].i
      confidence[field] = scored[0].score
      used.add(scored[0].i)
    }
  }
  // Debit/Credit only make sense as a pair — a lone match is unreliable, drop it
  if ((columns.debit != null) !== (columns.credit != null)) {
    delete columns.debit; delete columns.credit
    delete confidence.debit; delete confidence.credit
  }
  return { columns, confidence }
}

// ── Amount parsing ───────────────────────────────────────────────────────────
// Handles currency symbols, thousands separators, accounting-style
// parentheses for negatives, trailing minus signs, and DR/CR suffixes.
export function parseAmountString(raw) {
  if (raw == null) return null
  let s = String(raw).trim()
  if (!s) return null

  let forceNegative = false
  if (/^\(.*\)$/.test(s)) { forceNegative = true; s = s.slice(1, -1).trim() }
  if (/\bdr\.?\s*$/i.test(s)) { forceNegative = true; s = s.replace(/\bdr\.?\s*$/i, '').trim() }
  else if (/\bcr\.?\s*$/i.test(s)) { s = s.replace(/\bcr\.?\s*$/i, '').trim() }
  if (/-\s*$/.test(s)) { forceNegative = true; s = s.replace(/-\s*$/, '').trim() }

  s = s.replace(/[^0-9.\-]/g, '')
  if (!s || s === '-' || s === '.' || s === '-.') return null

  const n = parseFloat(s)
  if (isNaN(n)) return null
  return forceNegative ? -Math.abs(n) : n
}

// ── Date format detection + parsing ──────────────────────────────────────────
const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
}

function normalizeYear(y) {
  y = Number(y)
  if (y < 100) return y < 70 ? 2000 + y : 1900 + y
  return y
}

// Classifies a single date string. Returns { format, y, m, d } or null.
// format is 'YMD' | 'MDY' | 'DMY' | 'MONTH_NAME' | 'AMBIGUOUS' (numeric, both
// parts <=12 so month/day order can't be told from this value alone).
function classifyDateValue(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return null

  let m = s.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/)
  if (m) return { format: 'YMD', y: +m[1], m: +m[2], d: +m[3] }

  m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
  if (m) {
    const a = +m[1], b = +m[2], y = normalizeYear(m[3])
    if (a > 12 && b <= 12) return { format: 'DMY', y, m: b, d: a }
    if (b > 12 && a <= 12) return { format: 'MDY', y, m: a, d: b }
    if (a <= 12 && b <= 12) return { format: 'AMBIGUOUS', y, m: a, d: b }
    return null
  }

  // Bare Excel date serial number (epoch 1899-12-30), in case a date cell
  // wasn't formatted as a date in the source file
  m = s.match(/^(\d{4,6})$/)
  if (m) {
    const serial = +m[1]
    if (serial > 20000 && serial < 60000) {
      const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000)
      return { format: 'YMD', y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() }
    }
    return null
  }

  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})$/)
  if (m && MONTHS[m[1].toLowerCase()]) return { format: 'MONTH_NAME', y: normalizeYear(m[3]), m: MONTHS[m[1].toLowerCase()], d: +m[2] }

  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s\-]([A-Za-z]{3,9})\.?[\s\-](\d{2,4})$/)
  if (m && MONTHS[m[2].toLowerCase()]) return { format: 'MONTH_NAME', y: normalizeYear(m[3]), m: MONTHS[m[2].toLowerCase()], d: +m[1] }

  return null
}

// Samples a column's values and votes on the dominant format. Returns
// { format, confidence } where confidence is 0-1 (1 = unambiguous evidence).
export function detectDateFormat(values) {
  const sample = values.filter(v => String(v ?? '').trim()).slice(0, 200)
  if (!sample.length) return { format: null, confidence: 0 }

  let votesMDY = 0, votesDMY = 0, votesYMD = 0, votesMonthName = 0, ambiguous = 0, invalid = 0
  for (const v of sample) {
    const c = classifyDateValue(v)
    if (!c) { invalid++; continue }
    if (c.format === 'MDY') votesMDY++
    else if (c.format === 'DMY') votesDMY++
    else if (c.format === 'YMD') votesYMD++
    else if (c.format === 'MONTH_NAME') votesMonthName++
    else if (c.format === 'AMBIGUOUS') ambiguous++
  }

  if (sample.length - invalid === 0) return { format: null, confidence: 0 }
  if (votesYMD > 0 && votesMDY === 0 && votesDMY === 0 && votesMonthName === 0) return { format: 'YMD', confidence: 1 }
  if (votesMonthName > 0 && votesMDY === 0 && votesDMY === 0 && votesYMD === 0) return { format: 'MONTH_NAME', confidence: 1 }
  if (votesDMY > 0 && votesMDY === 0) return { format: 'DMY', confidence: 1 }
  if (votesMDY > 0 && votesDMY === 0) return { format: 'MDY', confidence: 1 }
  if (votesMDY > 0 && votesDMY > 0) return { format: 'MDY', confidence: 0.3 } // conflicting evidence within one column
  if (ambiguous > 0) return { format: 'MDY', confidence: 0.5 } // all days <=12 — can't verify, default to US convention
  return { format: null, confidence: 0 }
}

// Parses one value into an ISO yyyy-mm-dd string using the column's detected
// format to resolve ambiguous (day<=12, month<=12) numeric dates.
export function parseDateWithFormat(raw, format) {
  const c = classifyDateValue(raw)
  if (!c) return null
  let { y, m, d } = c
  if (c.format === 'AMBIGUOUS' && format === 'DMY') { [m, d] = [d, m] }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const iso = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  if (isNaN(new Date(`${iso}T00:00:00Z`).getTime())) return null
  return iso
}

// ── Row normalization ────────────────────────────────────────────────────────
// Produces { date, description, amount, kind } using the shared sign
// convention (amount always positive, direction in `kind`). `invertSign`
// implements the credit-card convention where a purchase is positive and a
// payment is negative in the source file.
export function normalizeRow(row, columns, dateFormat, { invertSign = false } = {}) {
  const rawDate = columns.date != null ? row[columns.date] : null
  const description = columns.description != null ? String(row[columns.description] ?? '').trim() : ''
  const date = rawDate != null ? parseDateWithFormat(rawDate, dateFormat) : null

  let amount = null, kind = null
  if (columns.debit != null && columns.credit != null) {
    const debitVal = parseAmountString(row[columns.debit])
    const creditVal = parseAmountString(row[columns.credit])
    if (debitVal) { amount = Math.abs(debitVal); kind = 'expense' }
    else if (creditVal) { amount = Math.abs(creditVal); kind = 'income' }
  } else if (columns.amount != null) {
    const parsed = parseAmountString(row[columns.amount])
    if (parsed != null && parsed !== 0) {
      const normalized = normalizeSignedAmount(parsed)
      amount = normalized.amount
      kind = normalized.kind
    }
  }

  if (kind && invertSign) kind = kind === 'income' ? 'expense' : 'income'

  return { date, description, amount, kind }
}

// ── Mapping validation ───────────────────────────────────────────────────────
// Blocks progression to preview/import when we can't confidently parse the file.
export function validateMapping({ columns, dateFormatResult }) {
  const errors = []
  if (columns.date == null) {
    errors.push('No date column could be found. Check that the file has a column with transaction dates.')
  } else if (!dateFormatResult?.format) {
    errors.push("A date column was found, but none of its values look like a recognizable date.")
  }

  const hasAmount = columns.amount != null
  const hasDebitCredit = columns.debit != null && columns.credit != null
  if (!hasAmount && !hasDebitCredit) {
    errors.push('No amount column (or a Debit/Credit column pair) could be found.')
  }
  if (columns.description == null) {
    errors.push('No description/payee column could be found.')
  }
  return { valid: errors.length === 0, errors }
}

// ── Duplicate detection key ──────────────────────────────────────────────────
// Same (account, date, kind, amount, normalized description) → same transaction.
export function buildDedupeKey({ accountId, date, kind, amount, description }) {
  const normDesc = String(description ?? '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200)
  const amt = Number(amount).toFixed(2)
  return `${accountId || 'none'}|${date}|${kind}|${amt}|${normDesc}`
}
