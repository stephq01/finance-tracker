import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import PageGlow from '../components/PageGlow'

const money = (n) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'GHS' }).format(n || 0)

function currentMonth() {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}

export default function Budget() {
  const { user } = useAuth()
  const [month, setMonth] = useState(currentMonth())
  const [budgets, setBudgets] = useState([])
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ category: '', budgeted_amount: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const monthStart = `${month}-01`
    const [{ data: b }, { data: e }] = await Promise.all([
      supabase.from('budgets').select('*').eq('month', monthStart),
      supabase.from('expenses').select('category, amount, date').gte('date', monthStart)
        .lt('date', new Date(new Date(monthStart).setMonth(new Date(monthStart).getMonth() + 1)).toISOString().slice(0, 10)),
    ])
    setBudgets(b || [])
    setExpenses(e || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.category || !form.budgeted_amount) return
    setSaving(true)
    await supabase.from('budgets').upsert(
      {
        user_id: user.id,
        category: form.category,
        month: `${month}-01`,
        budgeted_amount: Number(form.budgeted_amount),
      },
      { onConflict: 'user_id,category,month' }
    )
    setSaving(false)
    setForm({ category: '', budgeted_amount: '' })
    load()
  }

  async function handleDelete(id) {
    await supabase.from('budgets').delete().eq('id', id)
    load()
  }

  const rows = useMemo(() => {
    return budgets.map((b) => {
      const actual = expenses.filter((e) => e.category === b.category).reduce((sum, e) => sum + Number(e.amount), 0)
      return { ...b, actual, remaining: Number(b.budgeted_amount) - actual }
    })
  }, [budgets, expenses])

  const totals = useMemo(() => {
    const budgeted = rows.reduce((s, r) => s + Number(r.budgeted_amount), 0)
    const actual = rows.reduce((s, r) => s + r.actual, 0)
    return { budgeted, actual }
  }, [rows])

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageGlow color="budget" />
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h1 className="font-display text-2xl font-semibold text-text">Budget</h1>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg bg-surface-2 border border-line px-3 py-1.5 text-sm text-text outline-none focus:border-budget" />
      </div>
      <p className="text-sm text-muted mb-6">Budgeted vs. actual, by category, matched against what you logged in Spending for the same category name.</p>

      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="rounded-xl border-l-4 border border-line p-4"
          style={{ borderLeftColor: 'var(--color-budget)', background: 'color-mix(in srgb, var(--color-budget) 10%, var(--color-surface))' }}>
          <div className="text-xs text-muted mb-1">Budgeted this month</div>
          <div className="font-mono-nums text-xl text-text font-medium">{money(totals.budgeted)}</div>
        </div>
        <div className="rounded-xl border-l-4 border border-line p-4"
          style={{ borderLeftColor: totals.actual > totals.budgeted ? 'var(--color-spend)' : 'var(--color-income)', background: `color-mix(in srgb, var(--color-${totals.actual > totals.budgeted ? 'spend' : 'income'}) 10%, var(--color-surface))` }}>
          <div className="text-xs text-muted mb-1">Actually spent</div>
          <div className="font-mono-nums text-xl text-text font-medium">{money(totals.actual)}</div>
        </div>
      </div>

      <form onSubmit={handleAdd} className="rounded-xl border border-line bg-surface p-4 mb-8 grid gap-3 sm:grid-cols-3">
        <input placeholder="Category (match Spending exactly)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-budget sm:col-span-2" />
        <input type="number" step="0.01" placeholder="Budgeted (GHS)" value={form.budgeted_amount} onChange={(e) => setForm({ ...form, budgeted_amount: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-budget font-mono-nums" />
        <button type="submit" disabled={saving}
          className="sm:col-span-3 rounded-lg bg-budget text-ink text-sm font-medium py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50">
          {saving ? 'Saving…' : 'Set budget for this category'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">No budgets set for this month yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const pct = r.budgeted_amount > 0 ? Math.min(100, (r.actual / r.budgeted_amount) * 100) : 0
            const over = r.remaining < 0
            return (
              <div key={r.id} className="rounded-lg border border-line bg-surface px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-text">{r.category}</div>
                  <div className="flex items-center gap-3">
                    <div className="font-mono-nums text-sm text-text">{money(r.actual)} / {money(r.budgeted_amount)}</div>
                    <button onClick={() => handleDelete(r.id)} className="text-xs text-muted hover:text-spend transition-colors">Delete</button>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: over ? 'var(--color-spend)' : 'var(--color-budget)' }} />
                </div>
                <div className="text-xs mt-1" style={{ color: over ? 'var(--color-spend)' : 'var(--color-muted)' }}>
                  {over ? `${money(Math.abs(r.remaining))} over` : `${money(r.remaining)} left`}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
