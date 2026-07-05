import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../App'
import { supabase } from '../lib/supabase'

const fmt = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)

const SYSTEM_PROMPT = (financialData) => `You are Stride Coach, a sharp and supportive personal finance coach built into the Stride Finance app. You have a warm but direct style — you don't sugarcoat, but you're always encouraging.

Here is the user's current financial data from their Stride dashboard:

INCOME:
- Total Income: ${fmt(financialData.totalIncome)}
- Sources: ${financialData.income.map(i => `${i.source}: ${fmt(i.amount)} (${i.frequency || 'one-time'})`).join(', ') || 'None yet'}

BALANCE (Cash on hand):
- Total Balance: ${fmt(financialData.totalBalance)}

EXPENSES:
- Total Expenses: ${fmt(financialData.totalExpenses)}
- This Month: ${fmt(financialData.monthExpenses)}
- By Category: ${financialData.expensesByCategory.map(([cat, amt]) => `${cat}: ${fmt(amt)}`).join(', ') || 'None yet'}

SAVINGS RATE: ${financialData.savingsRate}%
SURPLUS/DEFICIT: ${financialData.surplus >= 0 ? '+' : ''}${fmt(financialData.surplus)}

GOALS: ${financialData.goals.map(g => `${g.name} (target: ${fmt(g.target_amount)}, saved: ${fmt(g.current_amount)})`).join(', ') || 'No goals set yet'}

LOANS/DEBTS: ${financialData.loans.length} active loan(s)

Guidelines:
- Reference their ACTUAL numbers when giving advice — be specific, not generic
- Keep responses concise (2-4 short paragraphs max unless they ask for detail)
- Use plain language, no jargon
- If they haven't entered much data yet, encourage them to add it so you can give better advice
- You can suggest they navigate to specific pages in the app (Income, Expenses, Goals, etc.)
- Never make up financial data — only use what's provided above
- Format numbers in USD when referencing amounts`

function ProGate({ feature, icon, description, userId }) {
  const [upgrading, setUpgrading] = useState(false)

  const handleUpgrade = async () => {
    setUpgrading(true)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch {
      setUpgrading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-64 text-center px-6">
      <div className="text-5xl mb-4">{icon}</div>
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3"
        style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
        ✦ Pro Feature
      </div>
      <h2 className="text-xl font-black text-primary mb-2">{feature}</h2>
      <p className="text-muted text-sm mb-6 max-w-xs">{description}</p>
      <button onClick={handleUpgrade} disabled={upgrading} className="btn-primary px-8">
        {upgrading ? 'Redirecting…' : '⚡ Upgrade to Pro — $4.99/mo'}
      </button>
    </div>
  )
}

export default function AICoach() {
  const { user } = useAuth()
  const [isPro, setIsPro] = useState(false)
  const [proLoading, setProLoading] = useState(true)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hey! I'm your Stride Coach 👋 I've pulled up your financial data and I'm ready to help. You can ask me anything — whether it's analyzing your spending, planning for a goal, or figuring out how to save more. What's on your mind?",
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [financialData, setFinancialData] = useState(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [dark, setDarkDetect] = useState(document.documentElement.classList.contains('dark'))
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const checkPro = async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle()
      setIsPro(!!data)
      setProLoading(false)
    }
    checkPro()
  }, [user.id])

  useEffect(() => {
    const obs = new MutationObserver(() => setDarkDetect(document.documentElement.classList.contains('dark')))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    const loadData = async () => {
      const [{ data: income }, { data: expenses }, { data: goals }, { data: balance }, { data: loans }] = await Promise.all([
        supabase.from('income').select('*').eq('user_id', user.id),
        supabase.from('expenses').select('*').eq('user_id', user.id),
        supabase.from('goals').select('*').eq('user_id', user.id),
        supabase.from('balance').select('*').eq('user_id', user.id),
        supabase.from('loans').select('*').eq('user_id', user.id),
      ])

      const inc = income || []
      const exp = expenses || []
      const gls = goals || []
      const bal = balance || []
      const lns = loans || []

      const totalIncome = inc.reduce((s, i) => s + i.amount, 0)
      const totalBalance = bal.reduce((s, b) => s + b.amount, 0)
      const totalExpenses = exp.reduce((s, e) => s + e.amount, 0)
      const thisMonth = new Date().toISOString().slice(0, 7)
      const monthExpenses = exp.filter(e => e.date?.slice(0, 7) === thisMonth).reduce((s, e) => s + e.amount, 0)

      const catMap = {}
      exp.forEach(e => { catMap[e.category] = (catMap[e.category] || 0) + e.amount })
      const expensesByCategory = Object.entries(catMap).sort((a, b) => b[1] - a[1])

      const savingsBase = totalIncome > 0 ? totalIncome : totalBalance
      const savingsRate = savingsBase > 0 ? ((savingsBase - totalExpenses) / savingsBase * 100).toFixed(1) : '0.0'
      const surplus = (totalBalance > 0 ? totalBalance : totalIncome) - totalExpenses

      setFinancialData({ income: inc, expenses: exp, goals: gls, balance: bal, loans: lns, totalIncome, totalBalance, totalExpenses, monthExpenses, expensesByCategory, savingsRate, surplus })
      setDataLoading(false)
    }
    loadData()
  }, [user.id])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading || !financialData) return

    const userMsg = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-5',
          max_tokens: 1024,
          system: SYSTEM_PROMPT(financialData),
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error?.message || `Server error ${response.status}`)
      }

      const data = await response.json()
      const reply = data.content?.[0]?.text || 'Sorry, I could not generate a response.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${err.message}` }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const STARTERS = [
    "How's my savings rate looking?",
    "Where am I overspending?",
    "Help me reach my goals faster",
    "How can I reduce my expenses?",
  ]

  if (proLoading || dataLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: 'var(--text-primary)', borderTopColor: 'transparent' }} />
    </div>
  )

  if (!isPro) return (
    <ProGate
      feature="Stride AI Coach"
      icon="🤖"
      description="Get personalized financial advice powered by AI — analyzing your real spending, income, and goals to give you specific, actionable guidance."
      userId={user.id}
    />
  )

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 56px - 48px)', maxHeight: '800px' }}>
      {/* Header */}
      <div className="mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl font-black"
            style={{ background: dark ? '#10b981' : 'rgba(255,255,255,0.22)', color: dark ? '#000' : '#fff', border: '2px solid rgba(255,255,255,0.3)' }}>
            S
          </div>
          <div>
            <h1 className="text-xl font-black text-primary tracking-tight">Stride Coach</h1>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"></span>
              <p className="text-muted text-xs">Your AI finance coach · data synced</p>
            </div>
          </div>
        </div>
      </div>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-2 min-h-0">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
              style={msg.role === 'user'
                ? { background: dark ? '#10b981' : 'rgba(255,255,255,0.9)', color: dark ? '#000' : '#1a3a6b', fontWeight: 600, borderRadius: '18px 18px 4px 18px' }
                : { background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', borderRadius: '18px 18px 18px 4px', whiteSpace: 'pre-wrap' }
              }
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="px-5 py-3 rounded-2xl text-sm" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '18px 18px 18px 4px' }}>
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--text-muted)', animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--text-muted)', animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--text-muted)', animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}

        {messages.length === 1 && !loading && (
          <div className="flex flex-wrap gap-2 pt-2">
            {STARTERS.map(s => (
              <button key={s} onClick={() => { setInput(s); setTimeout(() => inputRef.current?.focus(), 50) }}
                className="text-xs px-3 py-2 rounded-full font-semibold transition-opacity hover:opacity-75"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--card-border)', color: 'var(--text-muted)' }}>
                {s}
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Financial snapshot */}
      <div className="flex-shrink-0 grid grid-cols-3 gap-2 my-3">
        {[
          { label: 'Balance', val: fmt(financialData.totalBalance) },
          { label: 'This Month', val: fmt(financialData.monthExpenses) },
          { label: 'Savings', val: `${financialData.savingsRate}%` },
        ].map(s => (
          <div key={s.label} className="card px-3 py-2 text-center">
            <p className="text-xs text-muted">{s.label}</p>
            <p className="text-sm font-black text-primary">{s.val}</p>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 flex gap-2">
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask your coach anything…"
          disabled={loading}
          className="input-field resize-none"
          style={{ minHeight: '44px', maxHeight: '120px', lineHeight: '1.5', paddingTop: '10px' }}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()} className="btn-primary px-4 flex-shrink-0" style={{ alignSelf: 'flex-end', height: '44px' }}>
          ↑
        </button>
      </div>
    </div>
  )
}
