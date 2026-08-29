import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import PageGlow from '../components/PageGlow'

const money = (n) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'GHS' }).format(n || 0)

export default function Savings() {
  const { user } = useAuth()
  const [goals, setGoals] = useState([])
  const [totalIncome, setTotalIncome] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', kind: 'goal', target_amount: '', target_date: '' })
  const [contribFor, setContribFor] = useState(null)
  const [contribAmount, setContribAmount] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const [{ data: g }, { data: inc }] = await Promise.all([
      supabase.from('savings_goals').select('*').order('created_at'),
      supabase.from('income_entries').select('amount'),
    ])
    setGoals(g || [])
    setTotalIncome((inc || []).reduce((s, i) => s + Number(i.amount), 0))
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function addGoal(e) {
    e.preventDefault()
    if (!form.name) return
    setSaving(true)
    await supabase.from('savings_goals').insert({
      user_id: user.id,
      name: form.name,
      kind: form.kind,
      target_amount: form.target_amount ? Number(form.target_amount) : null,
      current_amount: 0,
      target_date: form.target_date || null,
    })
    setSaving(false)
    setForm({ name: '', kind: 'goal', target_amount: '', target_date: '' })
    setShowAdd(false)
    load()
  }

  async function addContribution(e, goal) {
    e.preventDefault()
    if (!contribAmount) return
    setSaving(true)
    await supabase.from('savings_goals').update({
      current_amount: Number(goal.current_amount) + Number(contribAmount),
    }).eq('id', goal.id)
    setSaving(false)
    setContribAmount('')
    setContribFor(null)
    load()
  }

  async function handleDelete(id) {
    await supabase.from('savings_goals').delete().eq('id', id)
    load()
  }

  const totalSaved = useMemo(() => goals.reduce((s, g) => s + Number(g.current_amount), 0), [goals])
  const savingsRate = totalIncome > 0 ? Math.round((totalSaved / totalIncome) * 100) : null

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageGlow color="save" />
      <h1 className="font-display text-2xl font-semibold text-text mb-1">Savings</h1>
      <p className="text-sm text-muted mb-6">Goal-based pots and sinking funds for the irregular annual costs — separate from your emergency fund.</p>

      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="rounded-xl border-l-4 border border-line p-4"
          style={{ borderLeftColor: 'var(--color-save)', background: 'color-mix(in srgb, var(--color-save) 10%, var(--color-surface))' }}>
          <div className="text-xs text-muted mb-1">Total saved</div>
          <div className="font-mono-nums text-xl font-medium" style={{ color: 'var(--color-save)' }}>{money(totalSaved)}</div>
        </div>
        <div className="rounded-xl border-l-4 border border-line p-4"
          style={{ borderLeftColor: 'var(--color-worth)', background: 'color-mix(in srgb, var(--color-worth) 10%, var(--color-surface))' }}>
          <div className="text-xs text-muted mb-1">Savings rate (of logged income)</div>
          <div className="font-mono-nums text-xl text-text font-medium">{savingsRate === null ? '—' : `${savingsRate}%`}</div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="space-y-3 mb-6">
          {goals.map((g) => {
            const pct = g.target_amount ? Math.min(100, (g.current_amount / g.target_amount) * 100) : null
            return (
              <div key={g.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                  <div>
                    <div className="text-sm text-text font-medium">{g.name}</div>
                    <div className="text-xs text-muted capitalize">{g.kind.replace('_', ' ')}{g.target_date ? ` · target ${g.target_date}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setContribFor(contribFor === g.id ? null : g.id)}
                      className="text-xs rounded-lg px-3 py-1.5 font-medium text-ink" style={{ background: 'var(--color-save)' }}>
                      + Add
                    </button>
                    <button onClick={() => handleDelete(g.id)} className="text-xs text-muted hover:text-spend transition-colors">Delete</button>
                  </div>
                </div>
                <div className="font-mono-nums text-sm text-text mb-1">
                  {money(g.current_amount)}{g.target_amount ? ` / ${money(g.target_amount)}` : ''}
                </div>
                {pct !== null && (
                  <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--color-save)' }} />
                  </div>
                )}
                {contribFor === g.id && (
                  <form onSubmit={(e) => addContribution(e, g)} className="mt-3 pt-3 border-t border-line flex gap-2">
                    <input type="number" step="0.01" autoFocus placeholder="Amount (GHS)" value={contribAmount} onChange={(e) => setContribAmount(e.target.value)}
                      className="flex-1 rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none font-mono-nums" />
                    <button type="submit" disabled={saving} className="rounded-lg text-ink text-sm font-medium px-4 py-2 disabled:opacity-50" style={{ background: 'var(--color-save)' }}>
                      {saving ? '…' : 'Save'}
                    </button>
                  </form>
                )}
              </div>
            )
          })}
          {goals.length === 0 && <p className="text-sm text-muted">No savings pots yet — add your first below.</p>}
        </div>
      )}

      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-muted hover:text-text hover:border-save transition-colors w-full">
          + Add a savings goal or sinking fund
        </button>
      ) : (
        <form onSubmit={addGoal} className="rounded-xl border border-line bg-surface p-4 grid gap-3 sm:grid-cols-2">
          <input placeholder="Name (e.g. New laptop, Annual rent renewal)" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none sm:col-span-2" />
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none">
            <option value="goal">Goal-based</option>
            <option value="sinking_fund">Sinking fund</option>
          </select>
          <input type="number" step="0.01" placeholder="Target amount (optional)" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none font-mono-nums" />
          <input type="date" placeholder="Target date (optional)" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none sm:col-span-2" />
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" disabled={saving} className="rounded-lg text-ink text-sm font-medium px-4 py-2 disabled:opacity-50" style={{ background: 'var(--color-save)' }}>
              {saving ? 'Adding…' : 'Add'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-line text-sm text-muted px-4 py-2">Cancel</button>
          </div>
        </form>
      )}
    </motion.div>
  )
}
