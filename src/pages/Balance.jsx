import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const today = () => new Date().toISOString().split('T')[0]

const ACCOUNT_TYPES = [
  { value: 'cash', label: 'Cash / Wallet', icon: '💵' },
  { value: 'checking', label: 'Checking', icon: '🏦' },
  { value: 'savings', label: 'Savings', icon: '💰' },
  { value: 'piggy', label: 'Piggy Bank / Jar', icon: '🐷' },
  { value: 'digital', label: 'Digital Wallet', icon: '📱' },
  { value: 'other', label: 'Other', icon: '🏛' },
]

const GAIN_TYPES = [
  { value: 'sold_item', label: 'Sold Something', icon: '🏷' },
  { value: 'cashback', label: 'Cashback / Reward', icon: '🎁' },
  { value: 'found', label: 'Found Money', icon: '🍀' },
  { value: 'gift', label: 'Gift / Birthday', icon: '🎂' },
  { value: 'refund', label: 'Refund', icon: '↩️' },
  { value: 'other', label: 'Other', icon: '✨' },
]

const typeObj = v => ACCOUNT_TYPES.find(t => t.value === v) || ACCOUNT_TYPES[ACCOUNT_TYPES.length - 1]
const gainObj = v => GAIN_TYPES.find(t => t.value === v) || GAIN_TYPES[GAIN_TYPES.length - 1]

const TABS = ['Accounts', 'Gains']

export default function Balance() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [gains, setGains] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Accounts')

  const [showAccountModal, setShowAccountModal] = useState(false)
  const [editAccount, setEditAccount] = useState(null)
  const [accountForm, setAccountForm] = useState({ name: '', type: 'cash', balance: '', notes: '' })
  const [savingAccount, setSavingAccount] = useState(false)

  const [showGainModal, setShowGainModal] = useState(false)
  const [editGain, setEditGain] = useState(null)
  const [gainForm, setGainForm] = useState({ description: '', amount: '', type: 'sold_item', date: today(), notes: '' })
  const [savingGain, setSavingGain] = useState(false)

  const loadAccounts = async () => {
    const { data } = await supabase.from('balance_accounts').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setAccounts(data || [])
  }
  const loadGains = async () => {
    const { data } = await supabase.from('balance_gains').select('*').eq('user_id', user.id).order('date', { ascending: false })
    setGains(data || [])
  }
  const load = async () => { await Promise.all([loadAccounts(), loadGains()]); setLoading(false) }
  useEffect(() => { load() }, [user.id])

  const openAddAccount = () => { setEditAccount(null); setAccountForm({ name: '', type: 'cash', balance: '', notes: '' }); setShowAccountModal(true) }
  const openEditAccount = item => { setEditAccount(item); setAccountForm({ name: item.name, type: item.type, balance: item.balance, notes: item.notes || '' }); setShowAccountModal(true) }
  const handleSaveAccount = async e => {
    e.preventDefault(); setSavingAccount(true)
    const payload = { name: accountForm.name.trim(), type: accountForm.type, balance: parseFloat(accountForm.balance) || 0, notes: accountForm.notes, user_id: user.id }
    if (editAccount) await supabase.from('balance_accounts').update(payload).eq('id', editAccount.id).eq('user_id', user.id)
    else await supabase.from('balance_accounts').insert(payload)
    setSavingAccount(false); setShowAccountModal(false); loadAccounts()
  }
  const handleDeleteAccount = async id => { await supabase.from('balance_accounts').delete().eq('id', id).eq('user_id', user.id); loadAccounts() }

  const openAddGain = () => { setEditGain(null); setGainForm({ description: '', amount: '', type: 'sold_item', date: today(), notes: '' }); setShowGainModal(true) }
  const openEditGain = item => { setEditGain(item); setGainForm({ description: item.description, amount: item.amount, type: item.type, date: item.date, notes: item.notes || '' }); setShowGainModal(true) }
  const handleSaveGain = async e => {
    e.preventDefault(); setSavingGain(true)
    const payload = { description: gainForm.description.trim(), amount: parseFloat(gainForm.amount) || 0, type: gainForm.type, date: gainForm.date, notes: gainForm.notes, user_id: user.id }
    if (editGain) await supabase.from('balance_gains').update(payload).eq('id', editGain.id).eq('user_id', user.id)
    else await supabase.from('balance_gains').insert(payload)
    setSavingGain(false); setShowGainModal(false); loadGains()
  }
  const handleDeleteGain = async id => { await supabase.from('balance_gains').delete().eq('id', id).eq('user_id', user.id); loadGains() }

  const totalHeld  = accounts.reduce((s, a) => s + (parseFloat(a.balance) || 0), 0)
  const totalGains = gains.reduce((s, g) => s + (parseFloat(g.amount) || 0), 0)
  const netBalance = totalHeld + totalGains

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }}></div>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-primary tracking-tight">Balance</h1>
        <p className="text-muted text-sm mt-1">Your actual money on hand — accounts, cash, and small gains</p>
      </div>

      {/* Hero total */}
      <div className="card p-6 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-full flex items-center justify-center font-black text-lg"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}>$</div>
          <div>
            <p className="text-muted text-xs">Total Balance</p>
            <p className="text-3xl font-black text-primary">{fmt(netBalance)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl p-3" style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)' }}>
            <p className="text-muted text-xs mb-1">💰 Money Held</p>
            <p className="font-black text-primary">{fmt(totalHeld)}</p>
            <p className="text-xs text-muted">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)' }}>
            <p className="text-muted text-xs mb-1">✨ Extra Gains</p>
            <p className="font-black text-primary">{fmt(totalGains)}</p>
            <p className="text-xs text-muted">{gains.length} entr{gains.length !== 1 ? 'ies' : 'y'}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-1 mb-4 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-white dark:bg-gray-900 shadow text-primary' : 'text-muted'}`}>
            {t === 'Accounts' ? '💳 Accounts' : '✨ Gains'}
          </button>
        ))}
      </div>

      {/* Accounts */}
      {tab === 'Accounts' && (
        <>
          <button onClick={openAddAccount} className="btn-primary mb-4 w-full justify-center">+ Add Account / Wallet</button>
          {accounts.length === 0 ? (
            <div className="card p-10 text-center" style={{ border: '2px dashed var(--card-border)' }}>
              <div className="text-4xl mb-3">💵</div>
              <p className="font-bold text-primary mb-1">No accounts added yet</p>
              <p className="text-muted text-sm mb-4">Add your wallet, bank account, or piggy bank — wherever you keep money.</p>
              <button onClick={openAddAccount} className="btn-primary">+ Add First Account</button>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map(acc => {
                const t = typeObj(acc.type)
                return (
                  <div key={acc.id} className="card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)' }}>{t.icon}</div>
                      <div>
                        <p className="font-semibold text-primary">{acc.name}</p>
                        <p className="text-xs text-muted">{t.label}</p>
                        {acc.notes && <p className="text-xs text-muted">{acc.notes}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-black text-lg text-primary">{fmt(acc.balance)}</p>
                      <button onClick={() => openEditAccount(acc)} className="text-muted hover:text-primary text-sm">✎</button>
                      <button onClick={() => handleDeleteAccount(acc.id)} className="text-muted hover:text-red-500 text-sm">🗑</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Gains */}
      {tab === 'Gains' && (
        <>
          <button onClick={openAddGain} className="btn-primary mb-2 w-full justify-center">+ Log a Gain</button>
          <p className="text-xs text-muted mb-4 text-center">Sold something? Got cashback? Found a $20? Log it here.</p>
          {gains.length === 0 ? (
            <div className="card p-10 text-center" style={{ border: '2px dashed var(--card-border)' }}>
              <div className="text-4xl mb-3">🍀</div>
              <p className="font-bold text-primary mb-1">No gains logged yet</p>
              <p className="text-muted text-sm mb-4">Log small wins — sold items, rewards, refunds, or anything unexpected.</p>
              <button onClick={openAddGain} className="btn-primary">+ Log a Gain</button>
            </div>
          ) : (
            <div className="space-y-2">
              {gains.map(g => {
                const gt = gainObj(g.type)
                return (
                  <div key={g.id} className="card p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                        style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)' }}>{gt.icon}</div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-primary truncate">{g.description}</p>
                        <p className="text-xs text-muted">{gt.label} · {g.date}</p>
                        {g.notes && <p className="text-xs text-muted truncate">{g.notes}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                      <span className="font-black text-sm text-emerald-500">+{fmt(g.amount)}</span>
                      <button onClick={() => openEditGain(g)} className="text-muted hover:text-primary text-sm">✎</button>
                      <button onClick={() => handleDeleteGain(g.id)} className="text-muted hover:text-red-500 text-sm">🗑</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Account Modal */}
      {showAccountModal && (
        <div className="modal-overlay" onClick={() => setShowAccountModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <p className="font-black text-primary text-lg">{editAccount ? 'Edit Account' : 'Add Account'}</p>
              <button onClick={() => setShowAccountModal(false)} className="text-muted hover:text-primary text-xl">✕</button>
            </div>
            <form onSubmit={handleSaveAccount}>
              <div className="mb-5">
                <label className="label">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {ACCOUNT_TYPES.map(opt => (
                    <button key={opt.value} type="button" onClick={() => setAccountForm(f => ({ ...f, type: opt.value }))}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-semibold transition-all ${accountForm.type === opt.value ? 'text-primary' : 'text-muted hover:text-primary'}`}
                      style={{ borderColor: accountForm.type === opt.value ? '#10b981' : 'var(--card-border)', background: accountForm.type === opt.value ? 'rgba(16,185,129,0.08)' : 'var(--input-bg)' }}>
                      <span className="text-xl">{opt.icon}</span>{opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <label className="label">Account Name</label>
                <input className="input-field" placeholder="e.g., My Wallet, Chase Savings, Jar on Shelf"
                  value={accountForm.name} onChange={e => setAccountForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="mb-4">
                <label className="label">Current Balance ($)</label>
                <input className="input-field" type="number" step="0.01" min="0" placeholder="0.00"
                  value={accountForm.balance} onChange={e => setAccountForm(f => ({ ...f, balance: e.target.value }))} required />
              </div>
              <div className="mb-6">
                <label className="label">Notes (optional)</label>
                <input className="input-field" placeholder="Any extra details"
                  value={accountForm.notes} onChange={e => setAccountForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowAccountModal(false)} className="btn-secondary justify-center">Cancel</button>
                <button type="submit" disabled={savingAccount} className="btn-primary justify-center">{savingAccount ? 'Saving...' : editAccount ? 'Save Changes' : 'Add Account'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gain Modal */}
      {showGainModal && (
        <div className="modal-overlay" onClick={() => setShowGainModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <p className="font-black text-primary text-lg">{editGain ? 'Edit Gain' : 'Log a Gain'}</p>
              <button onClick={() => setShowGainModal(false)} className="text-muted hover:text-primary text-xl">✕</button>
            </div>
            <form onSubmit={handleSaveGain}>
              <div className="mb-5">
                <label className="label">Type of Gain</label>
                <div className="grid grid-cols-3 gap-2">
                  {GAIN_TYPES.map(opt => (
                    <button key={opt.value} type="button" onClick={() => setGainForm(f => ({ ...f, type: opt.value }))}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-semibold transition-all ${gainForm.type === opt.value ? 'text-primary' : 'text-muted hover:text-primary'}`}
                      style={{ borderColor: gainForm.type === opt.value ? '#10b981' : 'var(--card-border)', background: gainForm.type === opt.value ? 'rgba(16,185,129,0.08)' : 'var(--input-bg)' }}>
                      <span className="text-xl">{opt.icon}</span>{opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <label className="label">Description</label>
                <input className="input-field" placeholder="e.g., Sold old phone, Amazon cashback"
                  value={gainForm.description} onChange={e => setGainForm(f => ({ ...f, description: e.target.value }))} required />
              </div>
              <div className="mb-4">
                <label className="label">Amount ($)</label>
                <input className="input-field" type="number" step="0.01" min="0" placeholder="0.00"
                  value={gainForm.amount} onChange={e => setGainForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div className="mb-4">
                <label className="label">Date</label>
                <input className="input-field" type="date" value={gainForm.date}
                  onChange={e => setGainForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div className="mb-6">
                <label className="label">Notes (optional)</label>
                <textarea className="input-field resize-none" rows={2} placeholder="Any extra details"
                  value={gainForm.notes} onChange={e => setGainForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowGainModal(false)} className="btn-secondary justify-center">Cancel</button>
                <button type="submit" disabled={savingGain} className="btn-primary justify-center">{savingGain ? 'Saving...' : editGain ? 'Save Changes' : 'Log Gain'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
