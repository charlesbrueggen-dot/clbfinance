// src/components/ProGate.jsx
// Shared paywall screen for Pro-only features. Identical behavior to the old
// per-page copies (POST /api/checkout → Stripe redirect), single styled version.
import { useState } from 'react'
import { Sparkle, Zap, Check } from 'lucide-react'
import { authHeader } from '../lib/supabase'

const PRO_PERKS = [
  'AI Coach with your real numbers',
  'Automatic bank sync (Plaid)',
  'CSV / spreadsheet import',
  'Investments, subscriptions & loan tracking',
]

export default function ProGate({ feature, Icon, description, userId }) {
  const [upgrading, setUpgrading] = useState(false)

  const handleUpgrade = async () => {
    setUpgrading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch { setUpgrading(false) }
  }

  return (
    <div className="flex items-center justify-center py-10">
      <div className="card p-8 max-w-md w-full text-center">
        <div className="icon-chip mx-auto mb-4" style={{ width: 64, height: 64, borderRadius: 20 }}>
          <Icon size={30} />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3"
          style={{ background: 'var(--positive-bg)', color: 'var(--positive)', border: '1px solid var(--positive)' }}>
          <Sparkle size={12} /> Pro Feature
        </div>
        <h2 className="text-2xl font-black text-primary mb-2">{feature}</h2>
        <p className="text-muted text-sm mb-5">{description}</p>

        <div className="text-left rounded-2xl p-4 mb-6" style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)' }}>
          {PRO_PERKS.map(perk => (
            <div key={perk} className="flex items-center gap-2 py-1.5">
              <Check size={14} style={{ color: 'var(--positive)' }} className="flex-shrink-0" />
              <span className="text-sm text-primary">{perk}</span>
            </div>
          ))}
        </div>

        <button onClick={handleUpgrade} disabled={upgrading} className="btn-primary w-full justify-center py-3">
          {upgrading ? 'Redirecting…' : <><Zap size={16} /> Upgrade to Pro — $6.99/mo</>}
        </button>
        <p className="text-xs text-muted mt-3">Cancel anytime.</p>
      </div>
    </div>
  )
}
