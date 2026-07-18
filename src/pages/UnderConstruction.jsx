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
          0%   { transform: rotate(-8deg); }
          50%  { transform: rotate(8deg); }
          100% { transform: rotate(-8deg); }
        }
        @keyframes uc-crane-hook-sway {
          0%   { transform: rotate(5deg); }
          50%  { transform: rotate(-5deg); }
          100% { transform: rotate(5deg); }
        }
        .uc-crane-top {
          transform-box: view-box;
          transform-origin: 109px 36px;
          animation: uc-crane-swing 4.2s ease-in-out infinite;
        }
        .uc-crane-hook {
          transform-box: view-box;
          transform-origin: 151px 41px;
          animation: uc-crane-hook-sway 4.2s ease-in-out infinite;
          animation-delay: -0.6s;
        }
      `}</style>

      {/* Tower crane: lattice mast (two chords + diagonal lacing), a
          swinging top assembly (cab, working jib, counter-jib + counterweight,
          trolley), and a hook that sways independently on its cable for a
          subtle lagging-pendulum effect. */}
      <svg width="190" height="170" viewBox="0 0 220 200" fill="none" className="mb-5 text-primary">
        {/* base plate */}
        <rect x="84" y="184" width="44" height="8" rx="1.5" fill="currentColor" opacity="0.9" />
        {/* mast chords (verticals) */}
        <line x1="94" y1="184" x2="94" y2="40" stroke="currentColor" strokeWidth="3" opacity="0.9" />
        <line x1="118" y1="184" x2="118" y2="40" stroke="currentColor" strokeWidth="3" opacity="0.9" />
        {/* mast lacing (diagonal lattice) */}
        <polyline
          points="94,184 118,166 94,148 118,130 94,112 118,94 94,76 118,58 94,40"
          stroke="currentColor" strokeWidth="1.5" opacity="0.55" fill="none"
        />
        {/* slewing platform atop the mast */}
        <rect x="88" y="32" width="42" height="8" rx="1.5" fill="currentColor" opacity="0.9" />

        {/* ── swinging assembly: cab, jib, counter-jib, counterweight, trolley ── */}
        <g className="uc-crane-top">
          {/* operator cab */}
          <rect x="99" y="40" width="20" height="13" rx="2" fill="currentColor" opacity="0.7" />

          {/* main jib (working arm) — top/bottom chords + truss lacing */}
          <line x1="109" y1="24" x2="200" y2="24" stroke="currentColor" strokeWidth="2.5" opacity="0.9" />
          <line x1="109" y1="36" x2="200" y2="36" stroke="currentColor" strokeWidth="2.5" opacity="0.9" />
          <polyline
            points="109,36 122,24 135,36 148,24 161,36 174,24 187,36 200,24"
            stroke="currentColor" strokeWidth="1.3" opacity="0.55" fill="none"
          />

          {/* counter-jib (short back arm) — chords + lacing */}
          <line x1="109" y1="26" x2="65" y2="26" stroke="currentColor" strokeWidth="2.5" opacity="0.9" />
          <line x1="109" y1="36" x2="65" y2="36" stroke="currentColor" strokeWidth="2.5" opacity="0.9" />
          <polyline
            points="109,36 94,26 79,36 65,26"
            stroke="currentColor" strokeWidth="1.3" opacity="0.55" fill="none"
          />

          {/* counterweight blocks */}
          <rect x="50" y="30" width="13" height="16" rx="1.5" className="accent-text" fill="currentColor" opacity="0.85" />
          <rect x="64" y="32" width="11" height="14" rx="1.5" className="accent-text" fill="currentColor" opacity="0.85" />

          {/* trolley riding the jib */}
          <rect x="145" y="34" width="12" height="7" rx="1.5" fill="currentColor" opacity="0.85" />

          {/* ── hook + cables: sways independently for a pendulum-lag feel ── */}
          <g className="uc-crane-hook">
            <line x1="148" y1="41" x2="148" y2="74" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
            <line x1="154" y1="41" x2="154" y2="74" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
            <rect x="143" y="74" width="16" height="12" rx="2" className="accent-text" fill="currentColor" opacity="0.9" />
            <path d="M151 86 q0 8 6 8 q6 0 4.5 -6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.85" />
          </g>
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
        {error && <p className="text-xs" style={{ color: 'var(--negative-strong)' }}>{error}</p>}
      </form>
    </div>
  )
}
