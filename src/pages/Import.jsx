import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

const today = () => new Date().toISOString().split('T')[0]

export default function Import() {
  const { user } = useAuth()
  const [step, setStep] = useState(0)
  const [rows, setRows] = useState([])
  const [headers, setHeaders] = useState([])
  const [dateCol, setDateCol] = useState(0)
  const [descCol, setDescCol] = useState(1)
  const [amtCol, setAmtCol] = useState(2)
  const [preview, setPreview] = useState([])
  const [importing, setImporting] = useState(false)
  const [doneCount, setDoneCount] = useState(0)
  const [dragging, setDragging] = useState(false)

  const parseCSV = text => {
    const lines = text.split('\n').filter(l => l.trim())
    return lines.map(line => {
      const cols = []; let cur = '', inQ = false
      for (const c of line) {
        if (c === '"') { inQ = !inQ }
        else if (c === ',' && !inQ) { cols.push(cur.trim()); cur = '' }
        else { cur += c }
      }
      cols.push(cur.trim())
      return cols
    })
  }

  const handleFile = file => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const parsed = parseCSV(ev.target.result)
      if (!parsed.length) return
      setHeaders(parsed[0].map((h, i) => ({ value: i, label: h || `Column ${i + 1}` })))
      setRows(parsed)
      setDateCol(0); setDescCol(Math.min(1, parsed[0].length - 1)); setAmtCol(Math.min(2, parsed[0].length - 1))
      setStep(1)
    }
    reader.readAsText(file)
  }

  const handleDrop = e => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) handleFile(file)
  }

  const handlePreview = () => {
    const prev = rows.slice(1, 6).map(r => ({
      date: r[dateCol] || '',
      desc: r[descCol] || '',
      amount: Math.abs(parseFloat((r[amtCol] || '0').replace(/[^0-9.-]/g, ''))) || 0
    }))
    setPreview(prev); setStep(2)
  }

  const handleImport = async () => {
    setImporting(true)
    const newExp = rows.slice(1).map(r => {
      const amt = Math.abs(parseFloat((r[amtCol] || '0').replace(/[^0-9.-]/g, ''))) || 0
      if (!amt) return null
      let date = today()
      try { const d = new Date(r[dateCol]); if (!isNaN(d)) date = d.toISOString().split('T')[0] } catch {}
      return { description: r[descCol] || 'Imported', amount: amt, category: 'Needs', subcategory: 'Other', date, notes: 'Imported from CSV', recurring: false, user_id: user.id }
    }).filter(Boolean)

    const BATCH = 50
    for (let i = 0; i < newExp.length; i += BATCH) {
      await supabase.from('expenses').insert(newExp.slice(i, i + BATCH))
    }
    setDoneCount(newExp.length)
    setImporting(false)
    setStep(3)
  }

  const reset = () => { setStep(0); setRows([]); setHeaders([]); setPreview([]) }

  const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary">Import Transactions</h1>
        <p className="text-muted text-sm mt-1">Upload a CSV from your bank to quickly add expenses.</p>
      </div>

      {/* Step 0: Upload */}
      {step === 0 && (
        <div className="card p-6">
          <p className="font-bold text-primary mb-1">Step 1: Upload File</p>
          <label
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`block mt-4 border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${dragging ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400'}`}
          >
            <div className="text-4xl mb-3">☁️</div>
            <p className="accent-text font-semibold">Upload a file</p>
            <p className="text-muted text-sm mt-1">CSV, XLS, XLSX up to 10MB</p>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={e => handleFile(e.target.files[0])} className="hidden" />
          </label>
          <button className="btn-secondary mt-4 opacity-50 cursor-not-allowed" disabled>Upload and Extract</button>
        </div>
      )}

      {/* Step 1: Map Columns */}
      {step === 1 && (
        <div className="card p-6">
          <p className="font-bold text-primary mb-1">Step 2: Map Columns</p>
          <p className="text-muted text-sm mb-4">{rows.length - 1} rows detected. Tell us which columns are which.</p>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div>
              <label className="label">Date Column</label>
              <select className="input-field" value={dateCol} onChange={e => setDateCol(+e.target.value)}>
                {headers.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Description Column</label>
              <select className="input-field" value={descCol} onChange={e => setDescCol(+e.target.value)}>
                {headers.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Amount Column</label>
              <select className="input-field" value={amtCol} onChange={e => setAmtCol(+e.target.value)}>
                {headers.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handlePreview} className="btn-primary">Preview Import</button>
            <button onClick={reset} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 2 && (
        <div className="card p-6">
          <p className="font-bold text-primary mb-1">Step 3: Preview (first 5 rows)</p>
          <div className="mt-4 mb-4 space-y-2">
            {preview.map((row, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: 'var(--card-border)' }}>
                <div>
                  <p className="font-medium text-sm text-primary">{row.desc || '—'}</p>
                  <p className="text-xs text-muted">{row.date}</p>
                </div>
                <span className="font-bold text-red-500">-{fmt(row.amount)}</span>
              </div>
            ))}
          </div>
          <p className="text-muted text-sm mb-4">{rows.length - 1} total transactions will be imported as expenses.</p>
          <div className="flex gap-3">
            <button onClick={handleImport} disabled={importing} className="btn-primary">{importing ? 'Importing...' : '✅ Import All'}</button>
            <button onClick={reset} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === 3 && (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <p className="text-2xl font-bold text-primary mb-2">{doneCount} transactions imported!</p>
          <p className="text-muted text-sm mb-6">They've been added to your Expenses page.</p>
          <button onClick={reset} className="btn-primary">Import Another File</button>
        </div>
      )}
    </div>
  )
}
