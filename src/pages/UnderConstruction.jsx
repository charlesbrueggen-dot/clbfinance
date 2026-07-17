// src/pages/UnderConstruction.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Hard gate placed in front of a page while it's being rebuilt. Renders a
// construction screen instead of `children` until the correct access code is
// entered — `children` (the real page) is never mounted before that, so any
// Pro/subscription check that page does on mount never runs either. Unlock
// state is local-only (component state), so a refresh re-locks it.
//
// TO REMOVE THIS GATE LATER: in App.jsx, change the route back from
//   <Route path="accounts" element={<UnderConstruction><Accounts /></UnderConstruction>} />
// to
//   <Route path="accounts" element={<Accounts />} />
// and delete this file (and its import in App.jsx).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'

const ACCESS_CODE = 'KingChar5' // case-sensitive

export default function UnderConstruction({ children }) {
  const [unlocked, setUnlocked] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  if (unlocked) return children

  const handleSubmit = e => {
    e.preventDefault()
    if (code === ACCESS_CODE) {
      setUnlocked(true)
      setError('')
    } else {
      setError('Incorrect code')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center text-center px-6" style={{ minHeight: '70vh' }}>
      <style>{`
        @keyframes uc-crane-swing {
          0%   { transform: rotate(-9deg); }
          50%  { transform: rotate(9deg); }
          100% { transform: rotate(-9deg); }
        }
        .uc-crane-arm {
          transform-origin: 100px 34px;
          animation: uc-crane-swing 3.6s ease-in-out infinite;
        }
      `}</style>

      <svg width="160" height="140" viewBox="0 0 200 160" fill="none" className="mb-5">
        {/* base */}
        <rect x="60" y="140" width="80" height="10" rx="2" className="text-primary" fill="currentColor" opacity="0.85" />
        {/* mast */}
        <rect x="96" y="34" width="8" height="106" rx="2" className="text-primary" fill="currentColor" opacity="0.85" />
        {/* swinging jib + hook */}
        <g className="uc-crane-arm">
          <rect x="30" y="30" width="140" height="7" rx="2" className="text-primary" fill="currentColor" opacity="0.85" />
          <line x1="150" y1="37" x2="150" y2="88" stroke="currentColor" className="text-primary" strokeWidth="2" opacity="0.6" />
          <rect x="139" y="88" width="22" height="18" rx="3" className="accent-text" fill="currentColor" opacity="0.9" />
        </g>
      </svg>

      <h2 className="text-xl font-black text-primary mb-2">Accounts is under construction</h2>
      <p className="text-muted text-sm mb-8 max-w-xs">We're building something great here. Check back soon.</p>

      <form onSubmit={handleSubmit} className="flex flex-col items-center gap-1.5">
        <p className="text-muted text-xs">Have an access code?</p>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={code}
            onChange={e => { setCode(e.target.value); if (error) setError('') }}
            className="input-field"
            style={{ width: 140, padding: '6px 10px', fontSize: 12 }}
            placeholder="Code"
            autoComplete="off"
          />
          <button type="submit" className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
            Enter
          </button>
        </div>
        {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
      </form>
    </div>
  )
}
