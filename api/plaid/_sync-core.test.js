import { describe, it, expect } from 'vitest'
import {
  mapPlaidAccountType, normalizePlaidAmount, classifyTransaction, PFC_CATEGORY_MAP,
} from './_sync-core.js'
import { mockSync, mockAccounts } from './_mock-data.js'

// Full detailed-category list from Plaid's published taxonomy
// (https://plaid.com/documents/pfc-taxonomy-all.csv, PFC v2) — used to verify
// PFC_CATEGORY_MAP has an explicit, deliberate entry for every one of them
// instead of silently falling through to classifyTransaction's Wants/Other
// default. This is what backs the "skip the sync-time AI pass" decision.
const ALL_PFC_DETAILED_CATEGORIES = [
  'INCOME_CHILD_SUPPORT', 'INCOME_CONTRACTOR', 'INCOME_DIVIDENDS', 'INCOME_GIG_ECONOMY',
  'INCOME_INTEREST_EARNED', 'INCOME_LONG_TERM_DISABILITY', 'INCOME_MILITARY', 'INCOME_RENTAL',
  'INCOME_RETIREMENT_PENSION', 'INCOME_SALARY', 'INCOME_TAX_REFUND', 'INCOME_UNEMPLOYMENT', 'INCOME_OTHER',
  'LOAN_DISBURSEMENTS_AUTO', 'LOAN_DISBURSEMENTS_CASH_ADVANCES', 'LOAN_DISBURSEMENTS_EWA',
  'LOAN_DISBURSEMENTS_MORTGAGE', 'LOAN_DISBURSEMENTS_PERSONAL', 'LOAN_DISBURSEMENTS_STUDENT',
  'LOAN_DISBURSEMENTS_OTHER_DISBURSEMENT',
  'LOAN_PAYMENTS_BNPL', 'LOAN_PAYMENTS_CAR_PAYMENT', 'LOAN_PAYMENTS_CASH_ADVANCES',
  'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT', 'LOAN_PAYMENTS_EWA', 'LOAN_PAYMENTS_MORTGAGE_PAYMENT',
  'LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT', 'LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT', 'LOAN_PAYMENTS_OTHER_PAYMENT',
  'TRANSFER_IN_ACCOUNT_TRANSFER', 'TRANSFER_IN_DEPOSIT', 'TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS',
  'TRANSFER_IN_SAVINGS', 'TRANSFER_IN_TRANSFER_IN_FROM_APPS', 'TRANSFER_IN_WIRE', 'TRANSFER_IN_OTHER_TRANSFER_IN',
  'TRANSFER_OUT_ACCOUNT_TRANSFER', 'TRANSFER_OUT_CRYPTO', 'TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS',
  'TRANSFER_OUT_SAVINGS', 'TRANSFER_OUT_TRANSFER_OUT_FROM_APPS', 'TRANSFER_OUT_WIRE',
  'TRANSFER_OUT_WITHDRAWAL', 'TRANSFER_OUT_OTHER_TRANSFER_OUT',
  'BANK_FEES_ATM_FEES', 'BANK_FEES_INSUFFICIENT_FUNDS', 'BANK_FEES_INTEREST_CHARGE',
  'BANK_FEES_FOREIGN_TRANSACTION_FEES', 'BANK_FEES_OVERDRAFT_FEES', 'BANK_FEES_LATE_FEES',
  'BANK_FEES_CASH_ADVANCE', 'BANK_FEES_OTHER_BANK_FEES',
  'ENTERTAINMENT_CASINOS_AND_GAMBLING', 'ENTERTAINMENT_MUSIC_AND_AUDIO',
  'ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS', 'ENTERTAINMENT_TV_AND_MOVIES',
  'ENTERTAINMENT_VIDEO_GAMES', 'ENTERTAINMENT_OTHER_ENTERTAINMENT',
  'FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR', 'FOOD_AND_DRINK_COFFEE', 'FOOD_AND_DRINK_FAST_FOOD',
  'FOOD_AND_DRINK_GROCERIES', 'FOOD_AND_DRINK_RESTAURANT', 'FOOD_AND_DRINK_VENDING_MACHINES',
  'FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK',
  'GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS', 'GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES',
  'GENERAL_MERCHANDISE_CONVENIENCE_STORES', 'GENERAL_MERCHANDISE_DEPARTMENT_STORES',
  'GENERAL_MERCHANDISE_DISCOUNT_STORES', 'GENERAL_MERCHANDISE_ELECTRONICS',
  'GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES', 'GENERAL_MERCHANDISE_OFFICE_SUPPLIES',
  'GENERAL_MERCHANDISE_ONLINE_MARKETPLACES', 'GENERAL_MERCHANDISE_PET_SUPPLIES',
  'GENERAL_MERCHANDISE_SPORTING_GOODS', 'GENERAL_MERCHANDISE_SUPERSTORES',
  'GENERAL_MERCHANDISE_TOBACCO_AND_VAPE', 'GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE',
  'HOME_IMPROVEMENT_FURNITURE', 'HOME_IMPROVEMENT_HARDWARE', 'HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE',
  'HOME_IMPROVEMENT_SECURITY', 'HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT',
  'MEDICAL_DENTAL_CARE', 'MEDICAL_EYE_CARE', 'MEDICAL_NURSING_CARE',
  'MEDICAL_PHARMACIES_AND_SUPPLEMENTS', 'MEDICAL_PRIMARY_CARE', 'MEDICAL_VETERINARY_SERVICES',
  'MEDICAL_OTHER_MEDICAL',
  'PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS', 'PERSONAL_CARE_HAIR_AND_BEAUTY',
  'PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING', 'PERSONAL_CARE_OTHER_PERSONAL_CARE',
  'GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING', 'GENERAL_SERVICES_AUTOMOTIVE',
  'GENERAL_SERVICES_CHILDCARE', 'GENERAL_SERVICES_CONSULTING_AND_LEGAL', 'GENERAL_SERVICES_EDUCATION',
  'GENERAL_SERVICES_INSURANCE', 'GENERAL_SERVICES_POSTAGE_AND_SHIPPING', 'GENERAL_SERVICES_STORAGE',
  'GENERAL_SERVICES_OTHER_GENERAL_SERVICES',
  'GOVERNMENT_AND_NON_PROFIT_DONATIONS', 'GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS_AND_AGENCIES',
  'GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT', 'GOVERNMENT_AND_NON_PROFIT_OTHER_GOVERNMENT_AND_NON_PROFIT',
  'TRANSPORTATION_BIKES_AND_SCOOTERS', 'TRANSPORTATION_GAS', 'TRANSPORTATION_PARKING',
  'TRANSPORTATION_PUBLIC_TRANSIT', 'TRANSPORTATION_TAXIS_AND_RIDE_SHARES', 'TRANSPORTATION_TOLLS',
  'TRANSPORTATION_OTHER_TRANSPORTATION',
  'TRAVEL_FLIGHTS', 'TRAVEL_LODGING', 'TRAVEL_RENTAL_CARS', 'TRAVEL_OTHER_TRAVEL',
  'RENT_AND_UTILITIES_GAS_AND_ELECTRICITY', 'RENT_AND_UTILITIES_INTERNET_AND_CABLE',
  'RENT_AND_UTILITIES_RENT', 'RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT',
  'RENT_AND_UTILITIES_TELEPHONE', 'RENT_AND_UTILITIES_WATER', 'RENT_AND_UTILITIES_OTHER_UTILITIES',
  'OTHER_OTHER',
]

describe('mapPlaidAccountType', () => {
  it('maps a credit-type account to Credit Card regardless of subtype', () => {
    expect(mapPlaidAccountType('credit', 'credit card')).toBe('Credit Card')
  })
  it('maps depository subtypes to Checking/Savings', () => {
    expect(mapPlaidAccountType('depository', 'checking')).toBe('Checking')
    expect(mapPlaidAccountType('depository', 'savings')).toBe('Savings')
    expect(mapPlaidAccountType('depository', 'money market')).toBe('Savings')
  })
  it('maps investment accounts to Investment', () => {
    expect(mapPlaidAccountType('investment', 'brokerage')).toBe('Investment')
  })
  it('falls back to Other for anything unrecognized', () => {
    expect(mapPlaidAccountType('loan', 'student')).toBe('Other')
  })
})

describe('normalizePlaidAmount', () => {
  it('uses the opposite sign convention from Teller/CSV: positive = expense, negative = income', () => {
    expect(normalizePlaidAmount(42.5)).toEqual({ amount: 42.5, kind: 'expense' })
    expect(normalizePlaidAmount(-42.5)).toEqual({ amount: 42.5, kind: 'income' })
  })
})

describe('PFC_CATEGORY_MAP coverage', () => {
  it('has an explicit entry for every published PFC detailed category', () => {
    for (const code of ALL_PFC_DETAILED_CATEGORIES) {
      expect(PFC_CATEGORY_MAP[code], `missing mapping for ${code}`).toBeDefined()
    }
  })

  it('only the literal catch-all (OTHER_OTHER) resolves to the classifier miss bucket (Wants/Other)', () => {
    for (const [code, mapped] of Object.entries(PFC_CATEGORY_MAP)) {
      if (mapped.category === 'Wants' && mapped.subcategory === 'Other') {
        expect(code).toBe('OTHER_OTHER')
      }
    }
  })
})

describe('classifyTransaction', () => {
  it('classifies an expense using the category/subcategory from the map', () => {
    expect(classifyTransaction({ detailed: 'FOOD_AND_DRINK_GROCERIES' }, 'expense'))
      .toEqual({ category: 'Needs', subcategory: 'Groceries' })
  })

  it('classifies income using the source from the map', () => {
    expect(classifyTransaction({ detailed: 'INCOME_SALARY' }, 'income')).toEqual({ source: 'Salary' })
  })

  it('defaults an income-shaped transaction on an expense-mapped category to Refund, not Other', () => {
    expect(classifyTransaction({ detailed: 'FOOD_AND_DRINK_GROCERIES' }, 'income')).toEqual({ source: 'Refund' })
  })

  it('falls back to Wants/Other only for a genuinely unmapped code', () => {
    expect(classifyTransaction({ detailed: 'SOME_UNKNOWN_FUTURE_CODE' }, 'expense'))
      .toEqual({ category: 'Wants', subcategory: 'Other' })
  })
})

describe('mockSync (Plaid /transactions/sync mock)', () => {
  it('returns all mock transactions as `added` on the first call (no cursor)', () => {
    const first = mockSync(null)
    expect(first.added.length).toBeGreaterThan(0)
    expect(first.has_more).toBe(false)
    expect(first.next_cursor).toBeTruthy()
  })

  it('is idempotent: re-syncing with the returned cursor yields nothing new', () => {
    const first = mockSync(null)
    const second = mockSync(first.next_cursor)
    expect(second.added).toEqual([])
    expect(second.modified).toEqual([])
    expect(second.removed).toEqual([])
  })

  it('every mock transaction carries a PFC detailed category that PFC_CATEGORY_MAP covers', () => {
    for (const t of mockSync(null).added) {
      expect(PFC_CATEGORY_MAP[t.personal_finance_category.detailed], `unmapped category on mock txn ${t.transaction_id}`).toBeDefined()
    }
  })
})

describe('mockAccounts (Plaid /accounts/get mock)', () => {
  it('every mock account maps to a known account type and has a numeric current balance', () => {
    for (const a of mockAccounts()) {
      expect(mapPlaidAccountType(a.type, a.subtype)).not.toBe('Other')
      expect(typeof a.balances.current).toBe('number')
    }
  })
})
