import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import PageGlow from '../components/PageGlow'

const money = (n) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'GHS' }).format(n || 0)
const pct = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

const allocColors = ['income', 'spend', 'budget', 'emergency', 'save', 'debt', 'sub', 'worth']

export default function Investments() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', asset_type: '', contributed_amount: '', current_value: '', contribution_date: new Date().toISOString().slice(0, 10) })
  const [editingValue, setEditingValue] = useState(null)
  const [valueInput, setValueInput] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('investments').select('*').order('contribution_date', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function addInvestment(e) {
    e.preventDefault()
    if (!form.name || !form.contributed_amount) return
    setSaving(true)
    await supabase.from('investments').insert({
      user_id: user.id,
      name: form.name,
      asset_type: form.asset_type || 'Other',
      contributed_amount: Number(form.contributed_amount),
      current_value: form.current_value ? Number(form.current_value) : Number(form.contributed_amount),
      contribution_date: form.contribution_date,
    })
    setSaving(false)
    setForm({ name: '', asset_type: '', contributed_amount: '', current_value: '', contribution_date: form.contribution_date })
    setShowAdd(false)
    load()
  }

  async function updateValue(e, row) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('investments').update({ current_value: Number(valueInput) }).eq('id', row.id)
    setSaving(false)
    setEditingValue(null)
    load()
  }

  async function toggleClosed(row) {
    await supabase.from('investments').update({ is_closed: !row.is_closed }).eq('id', row.id)
    load()
  }

  async function handleDelete(id) {
    await supabase.from('investments').delete().eq('id', id)
    load()
  }

  const stats = useMemo(() => {
    const contributed = rows.reduce((s, r) => s + Number(r.contributed_amount), 0)
    const current = rows.reduce((s, r) => s + Number(r.current_value ?? r.contributed_amount), 0)
    const realized = rows.filter((r) => r.is_closed).reduce((s, r) => s + (Number(r.current_value ?? 0) - Number(r.contributed_amount)), 0)
    const unrealized = rows.filter((r) => !r.is_closed).reduce((s, r) => s + (Number(r.current_value ?? r.contributed_amount) - Number(r.contributed_amount)), 0)
    const roi = contributed > 0 ? ((current - contributed) / contributed) * 100 : 0

    const byType = {}
    for (const r of rows) {
      const t = r.asset_type || 'Other'
      byType[t] = (byType[t] || 0) + Number(r.current_value ?? r.contributed_amount)
    }
    const allocation = Object.entries(byType).map(([type, amount]) => ({
      type, amount, pct: current > 0 ? (amount / current) * 100 : 0,
    })).sort((a, b) => b.amount - a.amount)

    return { contributed, current, realized, unrealized, roi, allocation }
  }, [rows])

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageGlow color="invest" />
      <h1 className="font-display text-2xl font-semibold text-text mb-1">Investments &amp; ROI</h1>
      <p className="text-sm text-muted mb-6">Contributions, current value, realized vs. unrealized gains, and where it's allocated.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border-l-4 border border-line p-4"
          style={{ borderLeftColor: 'var(--color-invest)', background: 'color-mix(in srgb, var(--color-invest) 10%, var(--color-surface))' }}>
          <div className="text-xs text-muted mb-1">Contributed</div>
          <div className="font-mono-nums text-lg text-text font-medium">{money(stats.contributed)}</div>
        </div>
        <div className="rounded-xl border-l-4 border border-line p-4"
          style={{ borderLeftColor: 'var(--color-worth)', background: 'color-mix(in srgb, var(--color-worth) 10%, var(--color-surface))' }}>
          <div className="text-xs text-muted mb-1">Current value</div>
          <div className="font-mono-nums text-lg text-text font-medium">{money(stats.current)}</div>
        </div>
        <div className="rounded-xl border-l-4 border border-line p-4"
          style={{ borderLeftColor: stats.roi >= 0 ? 'var(--color-income)' : 'var(--color-spend)', background: `color-mix(in srgb, var(--color-${stats.roi >= 0 ? 'income' : 'spend'}) 10%, var(--color-surface))` }}>
          <div className="text-xs text-muted mb-1">Overall ROI</div>
          <div className="font-mono-nums text-lg font-medium" style={{ color: stats.roi >= 0 ? 'var(--color-income)' : 'var(--color-spend)' }}>{pct(stats.roi)}</div>
        </div>
        <div className="rounded-xl border-l-4 border border-line p-4"
          style={{ borderLeftColor: 'var(--color-budget)', background: 'color-mix(in srgb, var(--color-budget) 10%, var(--color-surface))' }}>
          <div className="text-xs text-muted mb-1">Realized / Unrealized</div>
          <div className="font-mono-nums text-sm text-text font-medium">{money(stats.realized)} / {money(stats.unrealized)}</div>
        </div>
      </div>

      {stats.allocation.length > 0 && (
        <div className="rounded-xl border border-line bg-surface p-4 mb-8">
          <div className="text-xs text-muted mb-3">Allocation by asset type</div>
          <div className="space-y-2">
            {stats.allocation.map((a, i) => (
              <div key={a.type}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-text">{a.type}</span>
                  <span className="text-muted font-mono-nums">{money(a.amount)} · {a.pct.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${a.pct}%`, background: `var(--color-${allocColors[i % allocColors.length]})` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="space-y-2 mb-6">
          {rows.map((r) => {
            const gain = Number(r.current_value ?? r.contributed_amount) - Number(r.contributed_amount)
            const gainPct = Number(r.contributed_amount) > 0 ? (gain / Number(r.contributed_amount)) * 100 : 0
            return (
              <div key={r.id} className="rounded-lg border border-line bg-surface px-4 py-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-sm text-text font-medium flex items-center gap-2">
                      {r.name}
                      {r.is_closed && <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-line text-muted">closed</span>}
                    </div>
                    <div className="text-xs text-muted">{r.asset_type} · since {r.contribution_date}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-mono-nums text-sm text-text">{money(r.current_value ?? r.contributed_amount)}</div>
                      <div className="font-mono-nums text-xs" style={{ color: gain >= 0 ? 'var(--color-income)' : 'var(--color-spend)' }}>{pct(gainPct)}</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-line">
                  {editingValue === r.id ? (
                    <form onSubmit={(e) => updateValue(e, r)} className="flex gap-2 flex-1">
                      <input type="number" step="0.01" autoFocus placeholder="New current value" value={valueInput} onChange={(e) => setValueInput(e.target.value)}
                        className="flex-1 rounded-lg bg-surface-2 border border-line px-3 py-1.5 text-sm text-text outline-none font-mono-nums" />
                      <button type="submit" disabled={saving} className="text-xs rounded-lg px-3 py-1.5 font-medium text-ink" style={{ background: 'var(--color-invest)' }}>Save</button>
                    </form>
                  ) : (
                    <button onClick={() => { setEditingValue(r.id); setValueInput(r.current_value ?? r.contributed_amount) }}
                      className="text-xs text-muted hover:text-text transition-colors">Update value</button>
                  )}
                  <button onClick={() => toggleClosed(r)} className="text-xs text-muted hover:text-text transition-colors">
                    {r.is_closed ? 'Reopen' : 'Mark sold/closed'}
                  </button>
                  <button onClick={() => handleDelete(r.id)} className="text-xs text-muted hover:text-spend transition-colors ml-auto">Delete</button>
                </div>
              </div>
            )
          })}
          {rows.length === 0 && <p className="text-sm text-muted">No investments logged yet.</p>}
        </div>
      )}

      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-muted hover:text-text hover:border-invest transition-colors w-full">
          + Add an investment
        </button>
      ) : (
        <form onSubmit={addInvestment} className="rounded-xl border border-line bg-surface p-4 grid gap-3 sm:grid-cols-2">
          <input placeholder="Name (e.g. MTN shares, T-bill)" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none sm:col-span-2" />
          <input placeholder="Asset type (e.g. Stocks, T-bills, Crypto)" value={form.asset_type} onChange={(e) => setForm({ ...form, asset_type: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none" />
          <input type="date" required value={form.contribution_date} onChange={(e) => setForm({ ...form, contribution_date: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none" />
          <input type="number" step="0.01" placeholder="Contributed (GHS)" required value={form.contributed_amount} onChange={(e) => setForm({ ...form, contributed_amount: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none font-mono-nums" />
          <input type="number" step="0.01" placeholder="Current value (optional, defaults to contributed)" value={form.current_value} onChange={(e) => setForm({ ...form, current_value: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none font-mono-nums" />
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" disabled={saving} className="rounded-lg text-ink text-sm font-medium px-4 py-2 disabled:opacity-50" style={{ background: 'var(--color-invest)' }}>
              {saving ? 'Adding…' : 'Add investment'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-line text-sm text-muted px-4 py-2">Cancel</button>
          </div>
        </form>
      )}
    </motion.div>
  )
}
