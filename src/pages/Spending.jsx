import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import PageGlow from '../components/PageGlow'

const money = (n) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'GHS' }).format(n || 0)

const FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly', 'biannual', 'annual', 'one_off']

export default function Spending() {
  const { user } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    amount: '',
    category: '',
    type: 'variable',
    frequency: 'one_off',
    would_spend_again: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false })
    if (error) setError(error.message)
    else setEntries(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.category || !form.amount) return
    setSaving(true)
    setError('')
    const { error } = await supabase.from('expenses').insert({
      user_id: user.id,
      date: form.date,
      amount: Number(form.amount),
      category: form.category,
      type: form.type,
      frequency: form.frequency,
      would_spend_again: form.would_spend_again === '' ? null : form.would_spend_again === 'yes',
      notes: form.notes || null,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setForm({ ...form, category: '', amount: '', would_spend_again: '', notes: '' })
    load()
  }

  async function handleDelete(id) {
    await supabase.from('expenses').delete().eq('id', id)
    load()
  }

  const stats = useMemo(() => {
    const total = entries.reduce((sum, e) => sum + Number(e.amount), 0)
    const discretionary = entries.filter((e) => e.type === 'discretionary').reduce((sum, e) => sum + Number(e.amount), 0)
    const rated = entries.filter((e) => e.would_spend_again !== null)
    const wouldAgain = rated.filter((e) => e.would_spend_again).length
    const wouldAgainPct = rated.length ? Math.round((wouldAgain / rated.length) * 100) : null
    return { total, discretionary, wouldAgainPct }
  }, [entries])

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageGlow color="spend" />
      <h1 className="font-display text-2xl font-semibold text-text mb-1">Spending</h1>
      <p className="text-sm text-muted mb-6">Fixed vs. variable vs. discretionary, tagged by frequency, with a would-I-spend-here-again check.</p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <div className="rounded-xl border-l-4 border border-line p-4"
          style={{ borderLeftColor: 'var(--color-spend)', background: 'color-mix(in srgb, var(--color-spend) 10%, var(--color-surface))' }}>
          <div className="text-xs text-muted mb-1">Total logged</div>
          <div className="font-mono-nums text-xl text-spend font-medium">{money(stats.total)}</div>
        </div>
        <div className="rounded-xl border-l-4 border border-line p-4"
          style={{ borderLeftColor: 'var(--color-budget)', background: 'color-mix(in srgb, var(--color-budget) 10%, var(--color-surface))' }}>
          <div className="text-xs text-muted mb-1">Discretionary</div>
          <div className="font-mono-nums text-xl text-text font-medium">{money(stats.discretionary)}</div>
        </div>
        <div className="rounded-xl border-l-4 border border-line p-4 col-span-2 md:col-span-1"
          style={{ borderLeftColor: 'var(--color-income)', background: 'color-mix(in srgb, var(--color-income) 10%, var(--color-surface))' }}>
          <div className="text-xs text-muted mb-1">Would spend again</div>
          <div className="font-mono-nums text-xl text-text font-medium">{stats.wouldAgainPct === null ? '—' : `${stats.wouldAgainPct}%`}</div>
        </div>
      </div>

      <form onSubmit={handleAdd} className="rounded-xl border border-line bg-surface p-4 mb-8 grid gap-3 md:grid-cols-2">
        <div>
          <label className="block text-xs text-muted mb-1">Category</label>
          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="e.g. groceries, transport, data"
            className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-spend" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Amount (GHS)</label>
          <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-spend font-mono-nums" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Date</label>
          <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-spend" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-spend">
            <option value="fixed">Fixed</option>
            <option value="variable">Variable</option>
            <option value="discretionary">Discretionary</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Frequency</label>
          <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}
            className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-spend">
            {FREQUENCIES.map((f) => <option key={f} value={f}>{f.replace('_', '-')}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Would spend here again?</label>
          <select value={form.would_spend_again} onChange={(e) => setForm({ ...form, would_spend_again: e.target.value })}
            className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-spend">
            <option value="">Not sure yet</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-muted mb-1">Notes</label>
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-spend" />
        </div>
        {error && <p className="text-sm text-spend md:col-span-2">{error}</p>}
        <button type="submit" disabled={saving}
          className="md:col-span-2 rounded-lg bg-spend text-ink text-sm font-medium py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50">
          {saving ? 'Saving…' : 'Add expense'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted">Nothing logged yet — add your first entry above.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3">
              <div>
                <div className="text-sm text-text">{e.category}</div>
                <div className="text-xs text-muted">
                  {e.date} · {e.type} · {e.frequency.replace('_', '-')}
                  {e.would_spend_again === true && <span className="text-income"> · would spend again</span>}
                  {e.would_spend_again === false && <span className="text-spend"> · wouldn't spend again</span>}
                  {e.notes && <span> · {e.notes}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="font-mono-nums text-sm text-spend">{money(e.amount)}</div>
                <button onClick={() => handleDelete(e.id)} className="text-xs text-muted hover:text-spend transition-colors">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
