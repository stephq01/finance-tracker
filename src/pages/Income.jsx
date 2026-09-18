import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

const money = (n) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'GHS' }).format(n || 0)

function currentMonth() {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}

function monthLabel(ym) {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export default function Income() {
  const { user } = useAuth()
  const [month, setMonth] = useState(currentMonth())
  const [allEntries, setAllEntries] = useState([])
  const [allExpenses, setAllExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    source: '',
    amount: '',
    expected_date: '',
    received_date: new Date().toISOString().slice(0, 10),
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const [{ data: entries, error: e1 }, { data: expenses, error: e2 }] = await Promise.all([
      supabase.from('income_entries').select('*').order('received_date', { ascending: false }),
      supabase.from('expenses').select('date, amount'),
    ])
    if (e1) setError(e1.message)
    else setAllEntries(entries)
    if (e2) setError(e2.message)
    else setAllExpenses(expenses)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.source || !form.amount || !form.received_date) return
    setSaving(true)
    setError('')
    const { error } = await supabase.from('income_entries').insert({
      user_id: user.id,
      source: form.source,
      amount: Number(form.amount),
      expected_date: form.expected_date || null,
      received_date: form.received_date,
      notes: form.notes || null,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ source: '', amount: '', expected_date: '', received_date: form.received_date, notes: '' })
    load()
  }

  async function handleDelete(id) {
    await supabase.from('income_entries').delete().eq('id', id)
    load()
  }

  const monthEntries = useMemo(
    () => allEntries.filter((e) => e.received_date?.slice(0, 7) === month),
    [allEntries, month]
  )
  const monthExpensesTotal = useMemo(
    () => allExpenses.filter((e) => e.date?.slice(0, 7) === month).reduce((s, e) => s + Number(e.amount), 0),
    [allExpenses, month]
  )

  const stats = useMemo(() => {
    const total = monthEntries.reduce((sum, e) => sum + Number(e.amount), 0)
    const bySource = {}
    for (const e of monthEntries) bySource[e.source] = (bySource[e.source] || 0) + Number(e.amount)
    const late = monthEntries.filter(
      (e) => e.expected_date && e.received_date && e.received_date > e.expected_date
    ).length
    const net = total - monthExpensesTotal
    return { total, bySource, late, net }
  }, [monthEntries, monthExpensesTotal])

  // Every month that has either income or spending logged, most recent first.
  const monthlyHistory = useMemo(() => {
    const months = new Set()
    for (const e of allEntries) if (e.received_date) months.add(e.received_date.slice(0, 7))
    for (const e of allExpenses) if (e.date) months.add(e.date.slice(0, 7))
    return [...months]
      .sort((a, b) => b.localeCompare(a))
      .map((ym) => {
        const income = allEntries
          .filter((e) => e.received_date?.slice(0, 7) === ym)
          .reduce((s, e) => s + Number(e.amount), 0)
        const spending = allExpenses
          .filter((e) => e.date?.slice(0, 7) === ym)
          .reduce((s, e) => s + Number(e.amount), 0)
        return { ym, income, spending, net: income - spending }
      })
  }, [allEntries, allExpenses])

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h1 className="font-display text-2xl font-semibold text-text">Income &amp; cash flow</h1>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg bg-surface-2 border border-line px-3 py-1.5 text-sm text-text outline-none focus:border-income"
        />
      </div>
      <p className="text-sm text-muted mb-6">Every source, what actually landed, and what's left once spending is counted.</p>

      {/* net cash flow — the headline number */}
      <div
        className="rounded-xl border p-5 mb-4"
        style={{
          borderColor: stats.net >= 0 ? 'var(--color-income)' : 'var(--color-spend)',
          background: `color-mix(in srgb, var(--color-${stats.net >= 0 ? 'income' : 'spend'}) 10%, var(--color-surface))`,
        }}
      >
        <div className="text-xs text-muted mb-1">Net cash flow — {monthLabel(month)}</div>
        <div className="font-mono-nums text-3xl font-medium" style={{ color: stats.net >= 0 ? 'var(--color-income)' : 'var(--color-spend)' }}>
          {stats.net >= 0 ? '+' : ''}{money(stats.net)}
        </div>
        <div className="text-xs text-muted mt-1">
          {money(stats.total)} in, {money(monthExpensesTotal)} out
        </div>
      </div>

      {/* stat row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <div
          className="rounded-xl border-l-4 border border-line p-4"
          style={{ borderLeftColor: 'var(--color-income)', background: 'color-mix(in srgb, var(--color-income) 10%, var(--color-surface))' }}
        >
          <div className="text-xs text-muted mb-1">Income this month</div>
          <div className="font-mono-nums text-xl text-income font-medium">{money(stats.total)}</div>
        </div>
        <div
          className="rounded-xl border-l-4 border border-line p-4"
          style={{ borderLeftColor: 'var(--color-spend)', background: 'color-mix(in srgb, var(--color-spend) 10%, var(--color-surface))' }}
        >
          <div className="text-xs text-muted mb-1">Spending this month</div>
          <div className="font-mono-nums text-xl text-text font-medium">{money(monthExpensesTotal)}</div>
        </div>
        <div
          className="rounded-xl border-l-4 border border-line p-4 col-span-2 md:col-span-1"
          style={{ borderLeftColor: 'var(--color-worth)', background: 'color-mix(in srgb, var(--color-worth) 10%, var(--color-surface))' }}
        >
          <div className="text-xs text-muted mb-1">Arrived late this month</div>
          <div className="font-mono-nums text-xl text-text font-medium">{stats.late}</div>
        </div>
      </div>

      {/* add form */}
      <form onSubmit={handleAdd} className="rounded-xl border border-line bg-surface p-4 mb-8 grid gap-3 md:grid-cols-2">
        <div>
          <label className="block text-xs text-muted mb-1">Source</label>
          <input
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            placeholder="e.g. joggers & dresses sales"
            className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-income"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Amount (GHS)</label>
          <input
            type="number"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-income font-mono-nums"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Expected date (optional)</label>
          <input
            type="date"
            value={form.expected_date}
            onChange={(e) => setForm({ ...form, expected_date: e.target.value })}
            className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-income"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Received date</label>
          <input
            type="date"
            required
            value={form.received_date}
            onChange={(e) => setForm({ ...form, received_date: e.target.value })}
            className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-income"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-muted mb-1">Notes</label>
          <input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-income"
          />
        </div>
        {error && <p className="text-sm text-spend md:col-span-2">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="md:col-span-2 rounded-lg bg-income text-ink text-sm font-medium py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Add income entry'}
        </button>
      </form>

      {/* this month's entries */}
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : monthEntries.length === 0 ? (
        <p className="text-sm text-muted mb-8">Nothing logged for {monthLabel(month)} yet.</p>
      ) : (
        <div className="space-y-2 mb-8">
          {monthEntries.map((e) => {
            const isLate = e.expected_date && e.received_date > e.expected_date
            return (
              <div key={e.id} className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3">
                <div>
                  <div className="text-sm text-text">{e.source}</div>
                  <div className="text-xs text-muted">
                    {e.received_date}
                    {isLate && <span className="text-spend"> — later than expected</span>}
                    {e.notes && <span> · {e.notes}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-mono-nums text-sm text-income">{money(e.amount)}</div>
                  <button
                    onClick={() => handleDelete(e.id)}
                    className="text-xs text-muted hover:text-spend transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* monthly history — proves nothing resets or vanishes */}
      {monthlyHistory.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-text mb-3">Monthly history</h2>
          <div className="rounded-xl border border-line bg-surface overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted border-b border-line">
                  <th className="text-left font-normal px-4 py-2">Month</th>
                  <th className="text-right font-normal px-4 py-2">Income</th>
                  <th className="text-right font-normal px-4 py-2">Spending</th>
                  <th className="text-right font-normal px-4 py-2">Net</th>
                </tr>
              </thead>
              <tbody>
                {monthlyHistory.map((m) => (
                  <tr
                    key={m.ym}
                    onClick={() => setMonth(m.ym)}
                    className={`border-b border-line last:border-0 cursor-pointer hover:bg-surface-2 transition-colors ${m.ym === month ? 'bg-surface-2' : ''}`}
                  >
                    <td className="px-4 py-2.5 text-text">{monthLabel(m.ym)}</td>
                    <td className="px-4 py-2.5 text-right font-mono-nums text-income">{money(m.income)}</td>
                    <td className="px-4 py-2.5 text-right font-mono-nums text-text">{money(m.spending)}</td>
                    <td
                      className="px-4 py-2.5 text-right font-mono-nums font-medium"
                      style={{ color: m.net >= 0 ? 'var(--color-income)' : 'var(--color-spend)' }}
                    >
                      {m.net >= 0 ? '+' : ''}{money(m.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted mt-2">Every month you've ever logged stays here — nothing resets, this is just a different view of it. Tap a row to jump to that month above.</p>
        </div>
      )}
    </motion.div>
  )
}
