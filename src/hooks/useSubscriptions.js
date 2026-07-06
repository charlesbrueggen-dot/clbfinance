// src/hooks/useSubscriptions.js
// Detects recurring charges from transaction history and lets the user
// track/cancel them. "Cancel" only updates our own tracking — there's no
// API to actually cancel a third-party subscription, so we deep-link to
// the provider's account page when we know it, and fall back to a search.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const MS_PER_DAY = 1000 * 60 * 60 * 24

const CANCEL_URLS = {
  netflix:          'https://www.netflix.com/youraccount',
  spotify:          'https://www.spotify.com/account/subscription/',
  hulu:             'https://secure.hulu.com/account',
  disney:           'https://www.disneyplus.com/account/subscription',
  'hbo':            'https://www.max.com/settings/subscription',
  max:              'https://www.max.com/settings/subscription',
  paramount:        'https://www.paramountplus.com/account/',
  peacock:          'https://www.peacocktv.com/account/subscriptions',
  'youtube premium':'https://www.youtube.com/paid_memberships',
  'apple':          'https://apps.apple.com/account/subscriptions',
  'amazon prime':   'https://www.amazon.com/mc/pipelines/cancellation',
  audible:          'https://www.audible.com/account/membership',
  'playstation':    'https://www.playstation.com/en-us/support/subscriptions/cancel-ps-plus-membership/',
  xbox:             'https://account.microsoft.com/services',
  'adobe':          'https://account.adobe.com/plans',
  dropbox:          'https://www.dropbox.com/account/plan',
  'planet fitness': 'https://www.planetfitness.com/my-account',
  crunchyroll:      'https://www.crunchyroll.com/acct/membership',
  nytimes:          'https://myaccount.nytimes.com/seg/subscription',
}

function getCancelUrl(name) {
  const key = (name || '').toLowerCase()
  const match = Object.keys(CANCEL_URLS).find(k => key.includes(k))
  return match ? CANCEL_URLS[match] : `https://www.google.com/search?q=${encodeURIComponent(`cancel ${name} subscription`)}`
}

function normalizeMerchant(txn) {
  return (txn.merchant || txn.description || '')
    .trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+\d{2,}\s*$/, '')
    .trim()
}

// Groups expense transactions by merchant and flags ones that recur on a
// roughly weekly/monthly/yearly cadence with a consistent amount.
export function detectRecurring(transactions) {
  const groups = {}
  for (const t of transactions) {
    if (t.kind !== 'expense') continue
    const key = normalizeMerchant(t)
    if (!key) continue
    ;(groups[key] ||= []).push(t)
  }

  const results = []
  for (const [key, txns] of Object.entries(groups)) {
    if (txns.length < 2) continue
    const sorted = [...txns].sort((a, b) => new Date(a.date) - new Date(b.date))

    const gaps = []
    for (let i = 1; i < sorted.length; i++) {
      gaps.push((new Date(sorted[i].date) - new Date(sorted[i - 1].date)) / MS_PER_DAY)
    }
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length

    let frequency = null
    if (avgGap >= 25 && avgGap <= 35) frequency = 'monthly'
    else if (avgGap >= 6 && avgGap <= 8) frequency = 'weekly'
    else if (avgGap >= 350 && avgGap <= 380) frequency = 'yearly'
    if (!frequency) continue

    const amounts = sorted.map(t => t.amount)
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length
    const maxDelta = Math.max(...amounts.map(a => Math.abs(a - avgAmount)))
    if (avgAmount === 0 || maxDelta / avgAmount > 0.15) continue

    const last = sorted[sorted.length - 1]
    results.push({
      merchantKey: key,
      name:        last.merchant || last.description,
      amount:      avgAmount,
      frequency,
      lastDate:    last.date,
      occurrences: sorted.length,
    })
  }
  return results.sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a))
}

export function monthlyEquivalent({ amount, frequency }) {
  if (frequency === 'weekly') return amount * (52 / 12)
  if (frequency === 'yearly') return amount / 12
  return amount
}

export function useSubscriptions(userId) {
  const [tracked, setTracked] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('tracked_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setTracked(data || [])
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const track = async (detected, status = 'active') => {
    const payload = {
      user_id:          userId,
      merchant_key:     detected.merchantKey,
      name:             detected.name,
      amount:           detected.amount,
      frequency:        detected.frequency,
      last_charge_date: detected.lastDate,
      cancel_url:       getCancelUrl(detected.name),
      status,
      cancelled_at:     status === 'cancelled' ? new Date().toISOString() : null,
    }
    await supabase.from('tracked_subscriptions').upsert(payload, { onConflict: 'user_id,merchant_key' })
    await load()
  }

  // For a merchant we've never tracked before: track it and mark cancelled in one step.
  const cancelDetected = (detected) => track(detected, 'cancelled')

  const cancel = async (id) => {
    await supabase
      .from('tracked_subscriptions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', id).eq('user_id', userId)
    await load()
  }

  const reactivate = async (id) => {
    await supabase
      .from('tracked_subscriptions')
      .update({ status: 'active', cancelled_at: null })
      .eq('id', id).eq('user_id', userId)
    await load()
  }

  return { tracked, loading, track, cancelDetected, cancel, reactivate, reload: load }
}
