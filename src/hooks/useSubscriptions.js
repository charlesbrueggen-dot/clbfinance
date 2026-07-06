// src/hooks/useSubscriptions.js
// Detects recurring subscription charges from transaction history and lets
// the user track/cancel/manually-add them. "Cancel" only updates our own
// tracking — no provider exposes an API to cancel a subscription for us —
// so we deep-link straight to the provider's account/cancel page when we
// recognize the merchant, the way Rocket Money's cancel flow works.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const MS_PER_DAY = 1000 * 60 * 60 * 24

export const CATEGORIES = [
  'Streaming & Media', 'Music', 'Software & Cloud', 'Gaming',
  'Wellness & Education', 'Reading & News', 'Shopping & Delivery',
  'Security & VPN', 'Other',
]

export const CATEGORY_ICON = {
  'Streaming & Media':   '🎬',
  'Music':               '🎵',
  'Software & Cloud':    '☁️',
  'Gaming':              '🎮',
  'Wellness & Education':'🌱',
  'Reading & News':      '📰',
  'Shopping & Delivery':'🛍️',
  'Security & VPN':      '🔒',
  'Other':               '🔁',
}

// Curated list of common subscription billers. `aliases` are lowercase
// substrings that show up in real bank/card statement descriptors for that
// biller (e.g. "NETFLIX.COM", "GOOGLE *NETFLIX", "APPLE.COM/BILL"). Anything
// NOT matched here (Uber rides, gas, groceries…) is never treated as a
// subscription, no matter how often it repeats.
const SUBSCRIPTION_MERCHANTS = [
  { name: 'Netflix',                category: 'Streaming & Media',    aliases: ['netflix'],                                        url: 'https://www.netflix.com/youraccount' },
  { name: 'Spotify',                category: 'Music',                 aliases: ['spotify'],                                        url: 'https://www.spotify.com/account/subscription/' },
  { name: 'Hulu',                   category: 'Streaming & Media',    aliases: ['hulu'],                                           url: 'https://secure.hulu.com/account' },
  { name: 'Disney+',                category: 'Streaming & Media',    aliases: ['disneyplus', 'disney plus', 'disney+'],           url: 'https://www.disneyplus.com/account/subscription' },
  { name: 'Max (HBO)',              category: 'Streaming & Media',    aliases: ['hbomax', 'hbo max', 'max.com'],                   url: 'https://www.max.com/settings/subscription' },
  { name: 'Paramount+',             category: 'Streaming & Media',    aliases: ['paramount'],                                      url: 'https://www.paramountplus.com/account/' },
  { name: 'Peacock',                category: 'Streaming & Media',    aliases: ['peacock'],                                        url: 'https://www.peacocktv.com/account/subscriptions' },
  { name: 'ESPN+',                  category: 'Streaming & Media',    aliases: ['espn plus', 'espn+'],                             url: 'https://www.espn.com/watch/plans' },
  { name: 'YouTube Premium/TV',     category: 'Streaming & Media',    aliases: ['youtube premium', 'youtubepremium', 'youtube tv'],url: 'https://www.youtube.com/paid_memberships' },
  { name: 'Crunchyroll',            category: 'Streaming & Media',    aliases: ['crunchyroll'],                                    url: 'https://www.crunchyroll.com/acct/membership' },
  { name: 'SiriusXM',               category: 'Streaming & Media',    aliases: ['siriusxm', 'sirius xm'],                          url: 'https://care.siriusxm.com/manage' },
  { name: 'Twitch',                 category: 'Streaming & Media',    aliases: ['twitch'],                                         url: 'https://www.twitch.tv/subscriptions' },
  { name: 'Patreon',                category: 'Streaming & Media',    aliases: ['patreon'],                                        url: 'https://www.patreon.com/settings/memberships' },
  { name: 'Apple Subscriptions',    category: 'Software & Cloud',     aliases: ['apple.com/bill', 'apple.com bill', 'apple music', 'apple tv+', 'icloud'], url: 'https://apps.apple.com/account/subscriptions' },
  { name: 'Google Play/One',        category: 'Software & Cloud',     aliases: ['google *', 'google play', 'google one', 'google storage'], url: 'https://play.google.com/store/account/subscriptions' },
  { name: 'Adobe Creative Cloud',   category: 'Software & Cloud',     aliases: ['adobe'],                                          url: 'https://account.adobe.com/plans' },
  { name: 'Microsoft 365',         category: 'Software & Cloud',     aliases: ['microsoft 365', 'office 365', 'msft *'],          url: 'https://account.microsoft.com/services' },
  { name: 'Dropbox',                category: 'Software & Cloud',     aliases: ['dropbox'],                                        url: 'https://www.dropbox.com/account/plan' },
  { name: 'Notion',                 category: 'Software & Cloud',     aliases: ['notion'],                                         url: 'https://www.notion.so/my-account' },
  { name: 'Canva',                  category: 'Software & Cloud',     aliases: ['canva'],                                          url: 'https://www.canva.com/settings/billing' },
  { name: 'ChatGPT Plus',           category: 'Software & Cloud',     aliases: ['openai', 'chatgpt'],                              url: 'https://chatgpt.com/#settings/Subscription' },
  { name: 'Grammarly',              category: 'Software & Cloud',     aliases: ['grammarly'],                                      url: 'https://account.grammarly.com/subscription' },
  { name: 'LinkedIn Premium',       category: 'Software & Cloud',     aliases: ['linkedin'],                                       url: 'https://www.linkedin.com/premium/manage/' },
  { name: 'PlayStation Plus',       category: 'Gaming',                aliases: ['playstation', 'sony interactive'],               url: 'https://www.playstation.com/en-us/support/subscriptions/cancel-ps-plus-membership/' },
  { name: 'Xbox Game Pass',         category: 'Gaming',                aliases: ['xbox', 'msft *xbox'],                            url: 'https://account.microsoft.com/services' },
  { name: 'Nintendo Switch Online', category: 'Gaming',                aliases: ['nintendo'],                                      url: 'https://www.nintendo.com/switch/online-service/' },
  { name: 'Peloton',                category: 'Wellness & Education', aliases: ['peloton'],                                        url: 'https://www.onepeloton.com/account/subscriptions' },
  { name: 'Planet Fitness',         category: 'Wellness & Education', aliases: ['planet fitness'],                                url: 'https://www.planetfitness.com/my-account' },
  { name: 'Equinox',                category: 'Wellness & Education', aliases: ['equinox'],                                       url: 'https://www.equinox.com/account' },
  { name: 'Duolingo',               category: 'Wellness & Education', aliases: ['duolingo'],                                      url: 'https://www.duolingo.com/settings/subscription' },
  { name: 'Calm',                   category: 'Wellness & Education', aliases: ['calm.com', 'calm subscription'],                url: 'https://www.calm.com/manage-subscription' },
  { name: 'Headspace',              category: 'Wellness & Education', aliases: ['headspace'],                                     url: 'https://www.headspace.com/subscriptions/manage' },
  { name: 'Audible',                category: 'Reading & News',       aliases: ['audible'],                                       url: 'https://www.audible.com/account/membership' },
  { name: 'Kindle Unlimited',       category: 'Reading & News',       aliases: ['kindle unlimited'],                              url: 'https://www.amazon.com/kindle-dbs/subscribe/kuninvite' },
  { name: 'The New York Times',     category: 'Reading & News',       aliases: ['nytimes', 'new york times'],                     url: 'https://myaccount.nytimes.com/seg/subscription' },
  { name: 'Wall Street Journal',    category: 'Reading & News',       aliases: ['wall street journal', ' wsj'],                   url: 'https://myaccount.wsj.com/subscription' },
  { name: 'Washington Post',        category: 'Reading & News',       aliases: ['washington post'],                              url: 'https://subscribe.washingtonpost.com/account/' },
  { name: 'Amazon Prime',           category: 'Shopping & Delivery',  aliases: ['amazon prime', 'amzn prime', 'prime video'],     url: 'https://www.amazon.com/mc/pipelines/cancellation' },
  { name: 'DoorDash DashPass',      category: 'Shopping & Delivery',  aliases: ['doordash'],                                      url: 'https://www.doordash.com/consumer/dashpass/' },
  { name: 'Instacart+',             category: 'Shopping & Delivery',  aliases: ['instacart'],                                     url: 'https://www.instacart.com/express' },
  { name: 'Walmart+',                category: 'Shopping & Delivery',  aliases: ['walmart plus', 'walmart+'],                      url: 'https://www.walmart.com/plus' },
  { name: 'Costco Membership',      category: 'Shopping & Delivery',  aliases: ['costco whse', 'costco membership'],             url: 'https://customerservice.costco.com/' },
  { name: "Sam's Club Membership",  category: 'Shopping & Delivery',  aliases: ["sam's club", 'sams club'],                      url: 'https://www.samsclub.com/account/membership' },
  { name: 'HelloFresh',             category: 'Shopping & Delivery',  aliases: ['hellofresh'],                                    url: 'https://www.hellofresh.com/settings/subscription' },
  { name: 'Blue Apron',             category: 'Shopping & Delivery',  aliases: ['blue apron'],                                    url: 'https://www.blueapron.com/account' },
  { name: 'NordVPN',                category: 'Security & VPN',       aliases: ['nordvpn'],                                       url: 'https://my.nordaccount.com/billing/' },
  { name: 'ExpressVPN',             category: 'Security & VPN',       aliases: ['expressvpn'],                                    url: 'https://www.expressvpn.com/subscriptions' },
  { name: 'Norton/LifeLock',        category: 'Security & VPN',       aliases: ['norton', 'lifelock'],                            url: 'https://my.norton.com/extspa/account' },
  { name: 'McAfee',                 category: 'Security & VPN',       aliases: ['mcafee'],                                        url: 'https://www.mcafee.com/mysubscriptions' },
]

function normalizeMerchant(txn) {
  return (txn.merchant || txn.description || '')
    .trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+\d{2,}\s*$/, '')
    .trim()
}

function fallbackSearchUrl(name) {
  return `https://www.google.com/search?q=${encodeURIComponent(`cancel ${name} subscription`)}`
}

function matchKnownMerchant(text) {
  const t = (text || '').toLowerCase()
  return SUBSCRIPTION_MERCHANTS.find(m => m.aliases.some(a => t.includes(a)))
}

// Public: resolve the best cancel URL we have for a subscription name.
export function getCancelUrl(name) {
  return matchKnownMerchant(name)?.url || fallbackSearchUrl(name)
}

function addInterval(dateStr, frequency) {
  const d = new Date(dateStr + 'T12:00:00')
  if (frequency === 'weekly') d.setDate(d.getDate() + 7)
  else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d.toISOString().split('T')[0]
}

export function computeNextBillingDate(lastChargeDate, frequency) {
  return addInterval(lastChargeDate, frequency)
}

// Keeps rolling a next-billing date forward (by its frequency) until it's
// today or later — handles the case where the app hasn't been opened in a
// while so the stored estimate has drifted into the past.
export function rollForward(dateStr, frequency) {
  if (!dateStr) return dateStr
  let d = dateStr
  let guard = 0
  const todayStr = new Date().toISOString().split('T')[0]
  while (d < todayStr && guard < 1000) { d = addInterval(d, frequency); guard++ }
  return d
}

export function daysUntil(dateStr) {
  if (!dateStr) return null
  const target = new Date(dateStr + 'T00:00:00')
  const today   = new Date(new Date().toDateString())
  return Math.round((target - today) / MS_PER_DAY)
}

// Only flags charges at merchants we recognize as subscription billers (or
// transactions already tagged Wants > Subscriptions) — a plain recurring
// charge at, say, Uber or a gas station is NOT a subscription and never
// shows up here, however often it repeats.
export function detectRecurring(transactions) {
  const groups = {}
  for (const t of transactions) {
    if (t.kind !== 'expense') continue
    const text = `${t.merchant || ''} ${t.description || ''}`.trim()
    if (!text) continue

    const known = matchKnownMerchant(text)
    const taggedSubscription = !known && t.category === 'Wants' && t.subcategory === 'Subscriptions'
    if (!known && !taggedSubscription) continue

    const name     = known ? known.name : (t.merchant || t.description).trim()
    const category = known ? known.category : 'Other'
    const key = (known ? `known-${known.name}` : `tagged-${normalizeMerchant(t)}`).toLowerCase().replace(/[^a-z0-9]+/g, '-')
    ;(groups[key] ||= { name, category, url: known?.url || null, txns: [] }).txns.push(t)
  }

  const results = []
  for (const [key, group] of Object.entries(groups)) {
    const sorted = [...group.txns].sort((a, b) => new Date(a.date) - new Date(b.date))
    const last = sorted[sorted.length - 1]

    // Known subscription billers are flagged from the very first charge;
    // multiple charges let us refine the cadence instead of assuming monthly.
    let frequency = 'monthly'
    if (sorted.length >= 2) {
      const gaps = []
      for (let i = 1; i < sorted.length; i++) {
        gaps.push((new Date(sorted[i].date) - new Date(sorted[i - 1].date)) / MS_PER_DAY)
      }
      const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length
      if (avgGap <= 10) frequency = 'weekly'
      else if (avgGap >= 300) frequency = 'yearly'
      else frequency = 'monthly'
    }

    const amounts   = sorted.map(t => t.amount)
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length

    results.push({
      merchantKey: key,
      name:        group.name,
      category:    group.category,
      amount:      avgAmount,
      frequency,
      lastDate:    last.date,
      nextDate:    rollForward(computeNextBillingDate(last.date, frequency), frequency),
      occurrences: sorted.length,
      cancelUrl:   group.url || fallbackSearchUrl(group.name),
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

  // Tracks (or silently re-syncs) a subscription found by detection.
  // Detects price changes against whatever we already had on file.
  const track = async (detected, status = 'active') => {
    const existing = tracked.find(s => s.merchant_key === detected.merchantKey)

    let previous_amount  = existing?.previous_amount ?? null
    let price_changed_at = existing?.price_changed_at ?? null
    if (existing && Math.abs(existing.amount - detected.amount) > 0.01) {
      previous_amount  = existing.amount
      price_changed_at = new Date().toISOString()
    }

    const nextBilling = rollForward(
      existing?.next_billing_date || computeNextBillingDate(detected.lastDate, detected.frequency),
      detected.frequency
    )

    const payload = {
      user_id:           userId,
      merchant_key:      detected.merchantKey,
      name:              detected.name,
      amount:            detected.amount,
      frequency:         detected.frequency,
      category:          detected.category || existing?.category || 'Other',
      last_charge_date:  detected.lastDate,
      next_billing_date: nextBilling,
      cancel_url:        detected.cancelUrl,
      previous_amount,
      price_changed_at,
      source:            existing?.source || 'detected',
      status,
      cancelled_at:      status === 'cancelled' ? new Date().toISOString() : null,
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

  // Manually add a subscription that hasn't shown up in transactions (yet).
  const addManual = async (form) => {
    const merchantKey = `manual-${form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    const payload = {
      user_id:           userId,
      merchant_key:      merchantKey,
      name:              form.name.trim(),
      amount:            parseFloat(form.amount),
      frequency:         form.frequency,
      category:          form.category,
      next_billing_date: form.next_billing_date || null,
      cancel_url:        form.cancel_url?.trim() || getCancelUrl(form.name),
      source:            'manual',
      status:            'active',
    }
    await supabase.from('tracked_subscriptions').upsert(payload, { onConflict: 'user_id,merchant_key' })
    await load()
  }

  const updateSub = async (id, form) => {
    await supabase.from('tracked_subscriptions').update({
      name:              form.name.trim(),
      amount:            parseFloat(form.amount),
      frequency:         form.frequency,
      category:          form.category,
      next_billing_date: form.next_billing_date || null,
      cancel_url:        form.cancel_url?.trim() || null,
    }).eq('id', id).eq('user_id', userId)
    await load()
  }

  return {
    tracked, loading,
    track, cancelDetected, cancel, reactivate, addManual, updateSub,
    reload: load,
  }
}
