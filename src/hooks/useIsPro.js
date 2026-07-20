// src/hooks/useIsPro.js
// Shared Pro-status check, used by every Pro-gated page instead of each
// duplicating its own `subscriptions` query.
//
// DEV-TESTING-TOGGLE: also honors a local "view as free" override (set from
// Settings > Testing) so someone with a real paid subscription can preview
// the free-tier experience without touching their actual subscription row.
// This never changes what's in the database — it only changes what this
// hook reports locally, in this browser. Remove before shipping publicly:
// delete the FORCE_FREE_KEY check below and the Testing section in
// src/pages/Settings.jsx.
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export const FORCE_FREE_KEY = 'stride-force-free'

export function useIsPro(userId) {
  const [isPro, setIsPro] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const check = async () => {
      const { data } = await supabase
        .from('subscriptions').select('status')
        .eq('user_id', userId).eq('status', 'active').maybeSingle()
      if (cancelled) return
      const forcedFree = localStorage.getItem(FORCE_FREE_KEY) === '1'
      setIsPro(!!data && !forcedFree)
      setLoading(false)
    }
    check()
    return () => { cancelled = true }
  }, [userId])

  return { isPro, proLoading: loading }
}
