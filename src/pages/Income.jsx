import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import PageGlow from '../components/PageGlow'

const money = (n) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'GHS' }).format(n || 0)

export default function Income() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
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
    const { data, error } = await supabase
      .from('income_entries')
      .select('*')
      .order('received_date', { ascending: false })
    if (error) setError(error.message)
    else setEntries(data)
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

  const stats = useMemo(() => {
    const total = entries.reduce((sum, e) => sum + Number(e.amount), 0)
    const bySource = {}
    for (const e of entries) bySource[e.source] = (bySource[e.source] || 0) + Number(e.amount)
    const late = entries.filter(
      (e) => e.expected_date && e.received_date && e.received_date > e.expected_date
    ).length
    return { total, bySource, late }
  }, [entries])

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageGlow color="income" />
      <h1 className="font-display text-2xl font-semibold text-text mb-1">Income &amp; cash flow</h1>
      <p className="text-sm text-muted mb-6">Every source, what actually landed, and whether it landed on time.</p>

      {/* stat row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <div
          className="rounded-xl border-l-4 border border-line p-4"
          style={{ borderLeftColor: 'var(--color-income)', background: 'color-mix(in srgb, var(--color-income) 10%, var(--color-surface))' }}
        >
          <div className="text-xs text-muted mb-1">Total logged</div>
          <div className="font-mono-nums text-xl text-income font-medium">{money(stats.total)}</div>
        </div>
        <div
          className="rounded-xl border-l-4 border border-line p-4"
          style={{ borderLeftColor: 'var(--color-worth)', background: 'color-mix(in srgb, var(--color-worth) 10%, var(--color-surface))' }}
        >
          <div className="text-xs text-muted mb-1">Sources</div>
          <div className="font-mono-nums text-xl text-text font-medium">{Object.keys(stats.bySource).length}</div>
        </div>
        <div
          className="rounded-xl border-l-4 border border-line p-4 col-span-2 md:col-span-1"
          style={{ borderLeftColor: 'var(--color-spend)', background: 'color-mix(in srgb, var(--color-spend) 10%, var(--color-surface))' }}
        >
          <div className="text-xs text-muted mb-1">Arrived late vs. expected</div>
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
            placeholder="e.g. joggers &amp; dresses sales"
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

      {/* list */}
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted">Nothing logged yet — add your first entry above.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => {
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
    </motion.div>
  )
}
