// ─── Save ─────────────────────────────────────────────────────────────────
export default function Investments() {
  // …all your component code…
}

const handleSave = async () => {
  setSaving(true)

  // Helper to safely parse numbers
  const safeNum = val => {
    const n = parseFloat(val)
    return isNaN(n) ? null : n
  }

  let payload = { user_id: user.id, type: activeType }

  if (activeType === 'Stock' || activeType === 'ETF') {
    payload = {
      ...payload,
      symbol: form.symbol.toUpperCase().trim(),
      name: form.name.trim(),
      sector: form.sector || 'Other',
      shares: safeNum(form.shares) || 0,
      avg_cost: safeNum(form.avg_cost) || 0,
      current_price: safeNum(form.current_price) || safeNum(form.avg_cost) || 0,
      portfolio_pct: 0,
      purchase_date: form.purchase_date || null,
    }
  } else if (activeType === 'Crypto') {
    payload = {
      ...payload,
      symbol: form.symbol.toUpperCase().trim() || '',
      name: form.name.trim(),
      sector: 'Crypto',
      shares: safeNum(form.shares) || 0,
      avg_cost: safeNum(form.avg_cost) || 0,
      current_price: safeNum(form.current_price) || safeNum(form.avg_cost) || 0,
      portfolio_pct: 0,
      purchase_date: form.purchase_date || null,
    }
  } else if (activeType === 'Bond') {
    payload = {
      ...payload,
      symbol: '',
      name: form.name.trim(),
      sector: 'Finance',
      shares: 1,
      avg_cost: safeNum(form.purchase_price) || 0,     // what you paid
      current_price: safeNum(form.face_value) || 0,    // face / par value
      portfolio_pct: safeNum(form.coupon_rate) || 0,   // coupon %
      maturity_date: form.maturity_date || null,
      purchase_date: form.purchase_date || null,
    }
  } else if (activeType === 'Mutual Fund') {
    payload = {
      ...payload,
      symbol: form.symbol.toUpperCase().trim() || '',
      name: form.name.trim(),
      sector: 'Other',
      shares: safeNum(form.shares) || 0,
      avg_cost: safeNum(form.nav) || 0,
      current_price: safeNum(form.nav) || 0,
      portfolio_pct: 0,
      purchase_date: form.purchase_date || null,
    }
  }

  try {
    if (editItem) {
      const { error } = await supabase.from('investments').update(payload).eq('id', editItem.id).eq('user_id', user.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('investments').insert(payload)
      if (error) throw error
    }
    setShowModal(false)
    load()
  } catch (err) {
    console.error('Save failed:', err)
    alert(`Failed to save investment: ${err.message}`)
  } finally {
    setSaving(false)
  }
}
