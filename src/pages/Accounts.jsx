import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const ACCOUNT_TYPES = ['Checking', 'Savings', 'Credit Card', 'Investment', 'Cash', 'Other']
const TYPE_ICONS = { Checking: '🏦', Savings: '💰', 'Credit Card': '💳', Investment: '📈', Cash: '💵', Other: '🏛' }

export default function Accounts() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ name: '', type: 'Checking', balance: '', institution: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setAccounts(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [user.id])

  const openAdd = () => { setEditItem(null); setForm({ name: '', type: 'Checking', balance: '', institution: '', notes: '' }); setShowModal(true) }
  const openEdit = item => { setEditItem(item); setForm({ name: item.name, type: item.type, balance: item.balance, institution: item.institution || '', notes: item.notes || '' }); setShowModal(true) }

  const handleSave = async e => {
    e.preventDefault()
    setSaving(true)
    const payload = { name: form.name.trim(), type: form.type, balance: parseFloat(form.balance) || 0, institution: form.institution.trim(), notes: form.notes, user_id: user.id }
    if (editItem) await supabase.from('accounts').update(payload).eq('id', editItem.id).eq('user_id', user.id)
    else await supabase.from('accounts').insert(payload)
    setSaving(false); setShowModal(false); load()
  }

  const handleDelete = async id => {
    if (!confirm('Delete this account?')) return
    await supabase.from('accounts').delete().eq('id', id).eq('user_id', user.id)
    load()
  }

  const totalBalance = accounts.filter(a => a.type !== 'Credit Card').reduce((s, a) => s + a.balance, 0)
  const totalDebt = accounts.filter(a => a.type === 'Credit Card').reduce((s, a) => s + a.balance, 0)

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-t-transparent border-t-transparent rounded-full animate-spin"></div></div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">My Accounts</h1>
        <p className="text-muted text-sm mt-1">Manage your connected bank accounts</p>
      </div>

      <button onClick={openAdd} className="btn-primary mb-6">+ Add Account</button>

      {accounts.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="card p-4">
            <p className="text-muted text-xs mb-1">Total Assets</p>
            <p className="text-2xl font-bold text-primary">{fmt(totalBalance)}</p>
          </div>
          <div className="card p-4">
            <p className="text-muted text-xs mb-1">Total Debt</p>
            <p className="text-2xl font-bold text-red-500">{fmt(totalDebt)}</p>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="card p-12 text-center" style={{ border: '2px dashed var(--card-border)' }}>
          <p className="font-bold text-primary text-lg mb-2">No accounts yet</p>
          <p className="text-muted text-sm mb-4">Add a bank account to start tracking your finances.</p>
          <button onClick={openAdd} className="btn-primary">+ Add your first account</button>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map(acc => (
            <div key={acc.id} className="card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-xl">
                  {TYPE_ICONS[acc.type] || '🏦'}
                </div>
                <div>
                  <p className="font-semibold text-primary">{acc.name}</p>
                  <p className="text-xs text-muted">{acc.type}{acc.institution ? ` · ${acc.institution}` : ''}</p>
                  {acc.notes && <p className="text-xs text-muted">{acc.notes}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className={`font-bold text-lg ${acc.type === 'Credit Card' ? 'text-red-500' : 'text-primary'}`}>{fmt(acc.balance)}</p>
                <button onClick={() => openEdit(acc)} className="text-muted hover:text-primary text-sm">✎</button>
                <button onClick={() => handleDelete(acc.id)} className="text-muted hover:text-red-500 text-sm">🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <p className="accent-text font-semibold text-lg">{editItem ? 'Edit Account' : 'Add Account'}</p>
              <button onClick={() => setShowModal(false)} className="text-muted hover:text-primary text-xl">✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="mb-4"><label className="label">Account Name</label><input className="input-field" placeholder="e.g., Chase Checking" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
              <div className="mb-4"><label className="label">Account Type</label><select className="input-field" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>{ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
              <div className="mb-4"><label className="label">Current Balance ($)</label><input className="input-field" type="number" step="0.01" placeholder="0.00" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} required /></div>
              <div className="mb-4"><label className="label">Institution (optional)</label><input className="input-field" placeholder="e.g., Chase Bank" value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))} /></div>
              <div className="mb-6"><label className="label">Notes (optional)</label><input className="input-field" placeholder="Any additional notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary justify-center">{saving ? 'Saving...' : editItem ? 'Save Changes' : 'Add Account'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
