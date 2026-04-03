// src/pages/Investments.jsx
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../App'

export default function Investments() {
  const { user } = useAuth()
  const [investments, setInvestments] = useState([])

  const fetchInvestments = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('investments')
      .select('*')
      .eq('user_id', user.id)
    if (error) console.error(error)
    else setInvestments(data)
  }, [user])

  useEffect(() => {
    fetchInvestments()
  }, [fetchInvestments])

  return (
    <div>
      <h1>Investments</h1>
      {investments.length === 0 ? (
        <p>No investments found.</p>
      ) : (
        <ul>
          {investments.map(inv => (
            <li key={inv.id}>{inv.name} - ${inv.amount}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
