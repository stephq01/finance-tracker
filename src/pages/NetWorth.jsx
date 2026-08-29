import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import PageGlow from '../components/PageGlow'

const money = (n) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'GHS' }).format(n || 0)

export default function NetWorth() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), total_assets: '', total_liabilities: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('net_worth_snapshots').select('*').order('date', { ascending: true })
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function addSnapshot(e) {
    e.preventDefault()
    if (!form.total_assets) return
    setSaving(true)
    await supabase.from('net_worth_snapshots').insert({
      user_id: user.id,
      date: form.date,
      total_assets: Number(form.total_assets),
      total_liabilities: Number(form.total_liabilities || 0),
    })
    setSaving(false)
    setForm({ ...form, total_assets: '', total_liabilities: '' })
    load()
  }

  async function handleDelete(id) {
    await supabase.from('net_worth_snapshots').delete().eq('id', id)
    load()
  }

  const chartData = useMemo(
    () => rows.map((r) => ({ date: r.date, netWorth: Number(r.total_assets) - Number(r.total_liabilities) })),
    [rows]
  )

  const latest = rows[rows.length - 1]
  const previous = rows[rows.length - 2]
  const latestNet = latest ? Number(latest.total_assets) - Number(latest.total_liabilities) : null
  const change = latest && previous ? latestNet - (Number(previous.total_assets) - Number(previous.total_liabilities)) : null

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageGlow color="worth" />
      <h1 className="font-display text-2xl font-semibold text-text mb-1">Net worth</h1>
      <p className="text-sm text-muted mb-6">Assets minus liabilities, snapshotted over time — the one number that summarizes everything else.</p>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-xl border-l-4 border border-line p-4"
          style={{ borderLeftColor: 'var(--color-worth)', background: 'color-mix(in srgb, var(--color-worth) 10%, var(--color-surface))' }}>
          <div className="text-xs text-muted mb-1">Latest net worth</div>
          <div className="font-mono-nums text-xl font-medium" style={{ color: 'var(--color-worth)' }}>
            {latestNet === null ? '—' : money(latestNet)}
          </div>
        </div>
        <div className="rounded-xl border-l-4 border border-line p-4"
          style={{ borderLeftColor: change >= 0 ? 'var(--color-income)' : 'var(--color-spend)', background: `color-mix(in srgb, var(--color-${change >= 0 ? 'income' : 'spend'}) 10%, var(--color-surface))` }}>
          <div className="text-xs text-muted mb-1">Change since last snapshot</div>
          <div className="font-mono-nums text-xl text-text font-medium">
            {change === null ? '—' : `${change >= 0 ? '+' : ''}${money(change)}`}
          </div>
        </div>
      </div>

      {chartData.length >= 2 && (
        <div className="rounded-xl border border-line bg-surface p-4 mb-8" style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--color-muted)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--color-muted)', fontSize: 11 }} width={70}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-line)', borderRadius: 8, fontSize: 12 }}
                formatter={(v) => money(v)}
              />
              <Line type="monotone" dataKey="netWorth" stroke="var(--color-worth)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <form onSubmit={addSnapshot} className="rounded-xl border border-line bg-surface p-4 mb-8 grid gap-3 sm:grid-cols-3">
        <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
        <input type="number" step="0.01" placeholder="Total assets (GHS)" required value={form.total_assets} onChange={(e) => setForm({ ...form, total_assets: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth font-mono-nums" />
        <input type="number" step="0.01" placeholder="Total liabilities (GHS)" value={form.total_liabilities} onChange={(e) => setForm({ ...form, total_liabilities: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth font-mono-nums" />
        <button type="submit" disabled={saving}
          className="sm:col-span-3 rounded-lg text-ink text-sm font-medium py-2.5 disabled:opacity-50" style={{ background: 'var(--color-worth)' }}>
          {saving ? 'Saving…' : 'Log a snapshot'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="space-y-2">
          {[...rows].reverse().map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3">
              <div>
                <div className="text-sm text-text">{r.date}</div>
                <div className="text-xs text-muted">assets {money(r.total_assets)} · liabilities {money(r.total_liabilities)}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="font-mono-nums text-sm text-text">{money(Number(r.total_assets) - Number(r.total_liabilities))}</div>
                <button onClick={() => handleDelete(r.id)} className="text-xs text-muted hover:text-spend transition-colors">Delete</button>
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="text-sm text-muted">No snapshots yet — log your first above.</p>}
        </div>
      )}
    </motion.div>
  )
}
