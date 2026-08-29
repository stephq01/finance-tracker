import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import PageGlow from '../components/PageGlow'

const money = (n) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'GHS' }).format(n || 0)

export default function Debt() {
  const { user } = useAuth()
  const [debts, setDebts] = useState([])
  const [monthlyIncome, setMonthlyIncome] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', balance: '', interest_rate: '', minimum_payment: '', due_day: '' })
  const [payFor, setPayFor] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const [{ data: d }, { data: inc }] = await Promise.all([
      supabase.from('debts').select('*').order('created_at'),
      supabase.from('income_entries').select('amount').gte('received_date', thirtyDaysAgo),
    ])
    setDebts(d || [])
    setMonthlyIncome((inc || []).reduce((s, i) => s + Number(i.amount), 0))
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function addDebt(e) {
    e.preventDefault()
    if (!form.name || !form.balance) return
    setSaving(true)
    await supabase.from('debts').insert({
      user_id: user.id,
      name: form.name,
      balance: Number(form.balance),
      interest_rate: form.interest_rate ? Number(form.interest_rate) : null,
      minimum_payment: form.minimum_payment ? Number(form.minimum_payment) : null,
      due_day: form.due_day ? Number(form.due_day) : null,
    })
    setSaving(false)
    setForm({ name: '', balance: '', interest_rate: '', minimum_payment: '', due_day: '' })
    setShowAdd(false)
    load()
  }

  async function makePayment(e, d) {
    e.preventDefault()
    if (!payAmount) return
    setSaving(true)
    await supabase.from('debts').update({
      balance: Math.max(0, Number(d.balance) - Number(payAmount)),
    }).eq('id', d.id)
    setSaving(false)
    setPayAmount('')
    setPayFor(null)
    load()
  }

  async function handleDelete(id) {
    await supabase.from('debts').delete().eq('id', id)
    load()
  }

  const totals = useMemo(() => {
    const balance = debts.reduce((s, d) => s + Number(d.balance), 0)
    const minPayments = debts.reduce((s, d) => s + Number(d.minimum_payment || 0), 0)
    const dti = monthlyIncome > 0 ? Math.round((minPayments / monthlyIncome) * 100) : null
    return { balance, minPayments, dti }
  }, [debts, monthlyIncome])

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageGlow color="debt" />
      <h1 className="font-display text-2xl font-semibold text-text mb-1">Debt</h1>
      <p className="text-sm text-muted mb-6">Balances, rates, minimum payments — and where you stand against income.</p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <div className="rounded-xl border-l-4 border border-line p-4"
          style={{ borderLeftColor: 'var(--color-debt)', background: 'color-mix(in srgb, var(--color-debt) 10%, var(--color-surface))' }}>
          <div className="text-xs text-muted mb-1">Total balance</div>
          <div className="font-mono-nums text-xl font-medium" style={{ color: 'var(--color-debt)' }}>{money(totals.balance)}</div>
        </div>
        <div className="rounded-xl border-l-4 border border-line p-4"
          style={{ borderLeftColor: 'var(--color-budget)', background: 'color-mix(in srgb, var(--color-budget) 10%, var(--color-surface))' }}>
          <div className="text-xs text-muted mb-1">Monthly minimums</div>
          <div className="font-mono-nums text-xl text-text font-medium">{money(totals.minPayments)}</div>
        </div>
        <div className="rounded-xl border-l-4 border border-line p-4 col-span-2 md:col-span-1"
          style={{ borderLeftColor: 'var(--color-worth)', background: 'color-mix(in srgb, var(--color-worth) 10%, var(--color-surface))' }}>
          <div className="text-xs text-muted mb-1">Debt-to-income (last 30d)</div>
          <div className="font-mono-nums text-xl text-text font-medium">{totals.dti === null ? '—' : `${totals.dti}%`}</div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="space-y-3 mb-6">
          {debts.map((d) => (
            <div key={d.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                <div>
                  <div className="text-sm text-text font-medium">{d.name}</div>
                  <div className="text-xs text-muted">
                    {d.interest_rate ? `${d.interest_rate}% APR · ` : ''}
                    {d.minimum_payment ? `${money(d.minimum_payment)} min` : 'no set minimum'}
                    {d.due_day ? ` · due day ${d.due_day}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPayFor(payFor === d.id ? null : d.id)}
                    className="text-xs rounded-lg px-3 py-1.5 font-medium text-ink" style={{ background: 'var(--color-debt)' }}>
                    + Payment
                  </button>
                  <button onClick={() => handleDelete(d.id)} className="text-xs text-muted hover:text-spend transition-colors">Delete</button>
                </div>
              </div>
              <div className="font-mono-nums text-sm text-text">{money(d.balance)} remaining</div>
              {payFor === d.id && (
                <form onSubmit={(e) => makePayment(e, d)} className="mt-3 pt-3 border-t border-line flex gap-2">
                  <input type="number" step="0.01" autoFocus placeholder="Payment amount (GHS)" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                    className="flex-1 rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none font-mono-nums" />
                  <button type="submit" disabled={saving} className="rounded-lg text-ink text-sm font-medium px-4 py-2 disabled:opacity-50" style={{ background: 'var(--color-debt)' }}>
                    {saving ? '…' : 'Apply'}
                  </button>
                </form>
              )}
            </div>
          ))}
          {debts.length === 0 && <p className="text-sm text-muted">No debts logged — hopefully that's the truth and not just untracked yet.</p>}
        </div>
      )}

      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-muted hover:text-text hover:border-debt transition-colors w-full">
          + Add a debt
        </button>
      ) : (
        <form onSubmit={addDebt} className="rounded-xl border border-line bg-surface p-4 grid gap-3 sm:grid-cols-2">
          <input placeholder="Name (e.g. Student loan, Credit line)" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none sm:col-span-2" />
          <input type="number" step="0.01" placeholder="Current balance (GHS)" required value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none font-mono-nums" />
          <input type="number" step="0.01" placeholder="Interest rate % (optional)" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none font-mono-nums" />
          <input type="number" step="0.01" placeholder="Minimum payment (optional)" value={form.minimum_payment} onChange={(e) => setForm({ ...form, minimum_payment: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none font-mono-nums" />
          <input type="number" placeholder="Due day of month (optional)" value={form.due_day} onChange={(e) => setForm({ ...form, due_day: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none font-mono-nums" />
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" disabled={saving} className="rounded-lg text-ink text-sm font-medium px-4 py-2 disabled:opacity-50" style={{ background: 'var(--color-debt)' }}>
              {saving ? 'Adding…' : 'Add debt'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-line text-sm text-muted px-4 py-2">Cancel</button>
          </div>
        </form>
      )}
    </motion.div>
  )
}
