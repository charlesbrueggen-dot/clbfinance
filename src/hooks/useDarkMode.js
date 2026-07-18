import { useEffect, useState } from 'react'

// Tracks whether the `dark` class is present on <html>, so components can react to the
// app-level dark mode toggle (set in src/App.jsx) without re-deriving it themselves.
export function useDarkMode() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  return dark
}
