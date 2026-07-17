import { useState, useEffect } from 'react'
import { Tag, Gift, Clover, Cake, Undo2, Sparkles, Pencil, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
const today = () => new Date().toISOString().split('T')[0]

const GAIN_TYPES = [
  { value: 'sold_item', label: 'Sold Something', Icon: Tag },
  { value: 'cashback', label: 'Cashback / Reward', Icon: Gift },
  { value: 'found', label: 'Found Money', Icon: Clover },
  { value: 'gift', label: 'Gift / Birthday', Icon: Cake },
  { value: 'refund', label: 'Refund', Icon: Undo2 },
  { value: 'other', label: 'Other', Icon: Sparkles },
]

const gainObj = v => GAIN_TYPES.find(t => t.value === v) || GAIN_TYPES[GAIN_TYPES.length - 1]

export default function Balance() {
  const { user } = useAuth()
  const [gains, setGains] = useState([])
  const [loading, setLoading] = useState(true)

  const [showGainModal, setShowGainModal] = useState(false)
  const [editGain, setEditGain] = useState(null)
  const [gainForm, setGainForm] = useState({ description: '', amount: '', type: 'sold_item', date: today(), notes: '' })
  const [savingGain, setSavingGain] = useState(false)

  const loadGains = async () => {
    const { data } = await supabase.from('balance_gains').select('*').eq('user_id', user.id).order('date', { ascending: false })
    setGains(data || [])
  }
  const load = async () => { await loadGains(); setLoading(false) }
  useEffect(() => { load() }, [user.id])

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

  const totalGains = gains.reduce((s, g) => s + (parseFloat(g.amount) || 0), 0)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }}></div>
    </div>
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-primary tracking-tight">Balance</h1>
        <p className="text-muted text-sm mt-1">Track your extra gains — cashback, sold items, refunds, and more</p>
      </div>

      {/* Hero total */}
      <div className="card p-6 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full flex items-center justify-center font-black text-lg"
            style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)' }}><Sparkles size={20} /></div>
          <div>
            <p className="text-muted text-xs">Total Gains</p>
            <p className="text-3xl font-black text-primary">{fmt(totalGains)}</p>
            <p className="text-xs text-muted mt-0.5">{gains.length} entr{gains.length !== 1 ? 'ies' : 'y'}</p>
          </div>
        </div>
      </div>

      {/* Gains list */}
      <button onClick={openAddGain} className="btn-primary mb-2 w-full justify-center">+ Log a Gain</button>
      <p className="text-xs text-muted mb-4 text-center">Sold something? Got cashback? Found a $20? Log it here.</p>

      {gains.length === 0 ? (
        <div className="card p-10 text-center" style={{ border: '2px dashed var(--card-border)' }}>
          <div className="flex justify-center mb-3 text-muted"><Clover size={36} /></div>
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
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-primary"
                    style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)' }}><gt.Icon size={17} /></div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-primary truncate">{g.description}</p>
                    <p className="text-xs text-muted">{gt.label} · {g.date}</p>
                    {g.notes && <p className="text-xs text-muted truncate">{g.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                  <span className="font-black text-sm text-emerald-500">+{fmt(g.amount)}</span>
                  <button onClick={() => openEditGain(g)} className="text-muted hover:text-primary"><Pencil size={14} /></button>
                  <button onClick={() => handleDeleteGain(g.id)} className="text-muted hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Gain Modal */}
      {showGainModal && (
        <div className="modal-overlay" onClick={() => setShowGainModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <p className="font-black text-primary text-lg">{editGain ? 'Edit Gain' : 'Log a Gain'}</p>
              <button onClick={() => setShowGainModal(false)} className="text-muted hover:text-primary"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveGain}>
              <div className="mb-5">
                <label className="label">Type of Gain</label>
                <div className="grid grid-cols-3 gap-2">
                  {GAIN_TYPES.map(opt => (
                    <button key={opt.value} type="button" onClick={() => setGainForm(f => ({ ...f, type: opt.value }))}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-semibold transition-all ${gainForm.type === opt.value ? 'text-primary' : 'text-muted hover:text-primary'}`}
                      style={{ borderColor: gainForm.type === opt.value ? '#10b981' : 'var(--card-border)', background: gainForm.type === opt.value ? 'rgba(16,185,129,0.08)' : 'var(--input-bg)' }}>
                      <opt.Icon size={20} />{opt.label}
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
