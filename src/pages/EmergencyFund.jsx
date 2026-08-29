import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import PageGlow from '../components/PageGlow'

const money = (n) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'GHS' }).format(n || 0)

export default function EmergencyFund() {
  const { user } = useAuth()
  const [fund, setFund] = useState(null)
  const [txns, setTxns] = useState([])
  const [loading, setLoading] = useState(true)
  const [targetInput, setTargetInput] = useState('')
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), amount: '', kind: 'contribution', notes: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const [{ data: f }, { data: t }] = await Promise.all([
      supabase.from('emergency_fund').select('*').maybeSingle(),
      supabase.from('emergency_fund_transactions').select('*').order('date', { ascending: false }),
    ])
    setFund(f)
    setTargetInput(f?.target_amount ?? '')
    setTxns(t || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function saveTarget(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('emergency_fund').upsert(
      { user_id: user.id, target_amount: Number(targetInput || 0) },
      { onConflict: 'user_id' }
    )
    setSaving(false)
    load()
  }

  async function addTxn(e) {
    e.preventDefault()
    if (!form.amount) return
    setSaving(true)
    await supabase.from('emergency_fund_transactions').insert({
      user_id: user.id,
      date: form.date,
      amount: Number(form.amount),
      kind: form.kind,
      notes: form.notes || null,
    })
    setSaving(false)
    setForm({ ...form, amount: '', notes: '' })
    load()
  }

  const balance = useMemo(() => {
    return txns.reduce((sum, t) => sum + (t.kind === 'contribution' ? Number(t.amount) : -Number(t.amount)), 0)
  }, [txns])

  const target = fund?.target_amount || 0
  const pct = target > 0 ? Math.min(100, (balance / target) * 100) : 0

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageGlow color="emergency" />
      <h1 className="font-display text-2xl font-semibold text-text mb-1">Emergency fund</h1>
      <p className="text-sm text-muted mb-6">Kept separate from everyday savings on purpose — a target, a balance, and every top-up or withdrawal.</p>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          <div className="rounded-xl border border-line bg-surface p-5 mb-8">
            <div className="flex items-end justify-between mb-2 flex-wrap gap-2">
              <div>
                <div className="text-xs text-muted mb-1">Current balance</div>
                <div className="font-mono-nums text-2xl font-medium" style={{ color: 'var(--color-emergency)' }}>{money(balance)}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted mb-1">Target</div>
                <form onSubmit={saveTarget} className="flex items-center gap-2">
                  <input type="number" step="0.01" value={targetInput} onChange={(e) => setTargetInput(e.target.value)}
                    className="w-28 rounded-lg bg-surface-2 border border-line px-2 py-1 text-sm text-text outline-none focus:border-emergency font-mono-nums text-right" />
                  <button type="submit" disabled={saving} className="text-xs rounded-lg px-2 py-1.5 text-ink font-medium" style={{ background: 'var(--color-emergency)' }}>Set</button>
                </form>
              </div>
            </div>
            {target > 0 && (
              <>
                <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--color-emergency)' }} />
                </div>
                <div className="text-xs text-muted mt-1">{pct.toFixed(0)}% of target</div>
              </>
            )}
          </div>

          <form onSubmit={addTxn} className="rounded-xl border border-line bg-surface p-4 mb-8 grid gap-3 sm:grid-cols-2">
            <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-emergency" />
            <input type="number" step="0.01" placeholder="Amount (GHS)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-emergency font-mono-nums" />
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}
              className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-emergency">
              <option value="contribution">Contribution (top-up)</option>
              <option value="withdrawal">Withdrawal (used it)</option>
            </select>
            <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-emergency" />
            <button type="submit" disabled={saving}
              className="sm:col-span-2 rounded-lg text-ink text-sm font-medium py-2.5 disabled:opacity-50" style={{ background: 'var(--color-emergency)' }}>
              {saving ? 'Saving…' : 'Log transaction'}
            </button>
          </form>

          <div className="space-y-2">
            {txns.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3">
                <div>
                  <div className="text-sm text-text capitalize">{t.kind}</div>
                  <div className="text-xs text-muted">{t.date}{t.notes ? ` · ${t.notes}` : ''}</div>
                </div>
                <div className="font-mono-nums text-sm" style={{ color: t.kind === 'contribution' ? 'var(--color-income)' : 'var(--color-spend)' }}>
                  {t.kind === 'contribution' ? '+' : '−'}{money(t.amount)}
                </div>
              </div>
            ))}
            {txns.length === 0 && <p className="text-sm text-muted">No transactions logged yet.</p>}
          </div>
        </>
      )}
    </motion.div>
  )
}
