import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import PageGlow from '../components/PageGlow'

const money = (n) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'GHS' }).format(n || 0)

const cycleMonths = { monthly: 1, quarterly: 3, annual: 12 }

export default function Subscriptions() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', amount: '', billing_cycle: 'monthly', next_renewal: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('subscriptions').select('*').order('next_renewal', { ascending: true })
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function addSub(e) {
    e.preventDefault()
    if (!form.name || !form.amount) return
    setSaving(true)
    await supabase.from('subscriptions').insert({
      user_id: user.id,
      name: form.name,
      amount: Number(form.amount),
      billing_cycle: form.billing_cycle,
      next_renewal: form.next_renewal || null,
      active: true,
    })
    setSaving(false)
    setForm({ name: '', amount: '', billing_cycle: 'monthly', next_renewal: '' })
    setShowAdd(false)
    load()
  }

  async function toggleActive(row) {
    await supabase.from('subscriptions').update({ active: !row.active }).eq('id', row.id)
    load()
  }

  async function handleDelete(id) {
    await supabase.from('subscriptions').delete().eq('id', id)
    load()
  }

  const today = new Date().toISOString().slice(0, 10)
  const soonCutoff = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.active)
    const monthlyEquivalent = active.reduce((s, r) => s + Number(r.amount) / (cycleMonths[r.billing_cycle] || 1), 0)
    const renewingSoon = active.filter((r) => r.next_renewal && r.next_renewal <= soonCutoff && r.next_renewal >= today).length
    return { monthlyEquivalent, renewingSoon, activeCount: active.length }
  }, [rows, today, soonCutoff])

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageGlow color="sub" />
      <h1 className="font-display text-2xl font-semibold text-text mb-1">Subscriptions</h1>
      <p className="text-sm text-muted mb-6">Every recurring payment, audited on purpose instead of by surprise.</p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        <div className="rounded-xl border-l-4 border border-line p-4"
          style={{ borderLeftColor: 'var(--color-sub)', background: 'color-mix(in srgb, var(--color-sub) 10%, var(--color-surface))' }}>
          <div className="text-xs text-muted mb-1">Monthly-equivalent cost</div>
          <div className="font-mono-nums text-xl font-medium" style={{ color: 'var(--color-sub)' }}>{money(stats.monthlyEquivalent)}</div>
        </div>
        <div className="rounded-xl border-l-4 border border-line p-4"
          style={{ borderLeftColor: 'var(--color-worth)', background: 'color-mix(in srgb, var(--color-worth) 10%, var(--color-surface))' }}>
          <div className="text-xs text-muted mb-1">Active</div>
          <div className="font-mono-nums text-xl text-text font-medium">{stats.activeCount}</div>
        </div>
        <div className="rounded-xl border-l-4 border border-line p-4 col-span-2 md:col-span-1"
          style={{ borderLeftColor: stats.renewingSoon > 0 ? 'var(--color-spend)' : 'var(--color-line)', background: stats.renewingSoon > 0 ? 'color-mix(in srgb, var(--color-spend) 10%, var(--color-surface))' : 'var(--color-surface)' }}>
          <div className="text-xs text-muted mb-1">Renewing within 7 days</div>
          <div className="font-mono-nums text-xl text-text font-medium">{stats.renewingSoon}</div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="space-y-2 mb-6">
          {rows.map((r) => {
            const renewingSoon = r.active && r.next_renewal && r.next_renewal <= soonCutoff && r.next_renewal >= today
            return (
              <div key={r.id} className={`flex items-center justify-between rounded-lg border border-line px-4 py-3 ${r.active ? 'bg-surface' : 'bg-surface opacity-50'}`}>
                <div>
                  <div className="text-sm text-text font-medium flex items-center gap-2">
                    {r.name}
                    {renewingSoon && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full text-ink font-medium" style={{ background: 'var(--color-spend)' }}>
                        renews soon
                      </span>
                    )}
                    {!r.active && <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-line text-muted">cancelled</span>}
                  </div>
                  <div className="text-xs text-muted">
                    {r.billing_cycle}{r.next_renewal ? ` · next ${r.next_renewal}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="font-mono-nums text-sm text-text">{money(r.amount)}</div>
                  <button onClick={() => toggleActive(r)} className="text-xs text-muted hover:text-text transition-colors">
                    {r.active ? 'Cancel' : 'Reactivate'}
                  </button>
                  <button onClick={() => handleDelete(r.id)} className="text-xs text-muted hover:text-spend transition-colors">Delete</button>
                </div>
              </div>
            )
          })}
          {rows.length === 0 && <p className="text-sm text-muted">Nothing logged yet — add your first subscription below.</p>}
        </div>
      )}

      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-muted hover:text-text hover:border-sub transition-colors w-full">
          + Add a subscription
        </button>
      ) : (
        <form onSubmit={addSub} className="rounded-xl border border-line bg-surface p-4 grid gap-3 sm:grid-cols-2">
          <input placeholder="Name (e.g. Netflix, gym, domain renewal)" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none sm:col-span-2" />
          <input type="number" step="0.01" placeholder="Amount (GHS)" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none font-mono-nums" />
          <select value={form.billing_cycle} onChange={(e) => setForm({ ...form, billing_cycle: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none">
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
          </select>
          <input type="date" placeholder="Next renewal (optional)" value={form.next_renewal} onChange={(e) => setForm({ ...form, next_renewal: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none sm:col-span-2" />
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" disabled={saving} className="rounded-lg text-ink text-sm font-medium px-4 py-2 disabled:opacity-50" style={{ background: 'var(--color-sub)' }}>
              {saving ? 'Adding…' : 'Add subscription'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-line text-sm text-muted px-4 py-2">Cancel</button>
          </div>
        </form>
      )}
    </motion.div>
  )
}
