import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import * as Icons from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { stages } from '../lib/stages'

const money = (n) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'GHS' }).format(n || 0)

const norm = (s) => (s || '').trim().toLowerCase()

function daysUntilDueDay(dueDay, now) {
  if (!dueDay) return null
  const y = now.getFullYear()
  const m = now.getMonth()
  let due = new Date(y, m, Math.min(dueDay, new Date(y, m + 1, 0).getDate()))
  if (due < new Date(y, m, now.getDate())) {
    due = new Date(y, m + 1, Math.min(dueDay, new Date(y, m + 2, 0).getDate()))
  }
  return Math.round((due - new Date(y, m, now.getDate())) / 86400000)
}

export default function Home() {
  const [data, setData] = useState(null)

  useEffect(() => {
    async function load() {
      const q = (table, cols = '*') => supabase.from(table).select(cols).then((r) => r.data || [])
      const [income, expenses, budgets, fund, fundTx, goals, debts, investments, snapshots, subs, businesses, sales, omOrders, omPayments, omStatuses, omRestocks] =
        await Promise.all([
          q('income_entries'), q('expenses'), q('budgets'), q('emergency_fund'), q('emergency_fund_transactions'),
          q('savings_goals'), q('debts'), q('investments'), q('net_worth_snapshots'), q('subscriptions'),
          q('businesses'), q('business_sales', 'amount_charged, amount_paid'),
          q('om_orders', 'id, total, status_id'), q('om_payments', 'order_id, amount'),
          q('om_order_statuses', 'id, name'), q('om_restocks', 'total_cost, amount_paid'),
        ])
      setData({ income, expenses, budgets, fund, fundTx, goals, debts, investments, snapshots, subs, businesses, sales, omOrders, omPayments, omStatuses, omRestocks })
    }
    load()
  }, [])

  const s = useMemo(() => {
    if (!data) return null
    const now = new Date()
    const ym = now.toISOString().slice(0, 7)

    const monthIncome = data.income.filter((e) => e.received_date?.slice(0, 7) === ym).reduce((t, e) => t + Number(e.amount), 0)
    const monthExpenses = data.expenses.filter((e) => e.date?.slice(0, 7) === ym)
    const monthSpent = monthExpenses.reduce((t, e) => t + Number(e.amount), 0)
    const byCat = {}
    for (const e of monthExpenses) byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount)
    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0]

    const monthBudgets = data.budgets.filter((b) => b.month?.slice(0, 7) === ym)
    const budgetRows = monthBudgets.map((b) => {
      const actual = monthExpenses.filter((e) => norm(e.category) === norm(b.category)).reduce((t, e) => t + Number(e.amount), 0)
      return { category: b.category, budgeted: Number(b.budgeted_amount), actual }
    })
    const budgeted = budgetRows.reduce((t, r) => t + r.budgeted, 0)
    const budgetActual = budgetRows.reduce((t, r) => t + r.actual, 0)
    const overBudget = budgetRows.filter((r) => r.actual > r.budgeted)

    const efTarget = Number(data.fund[0]?.target_amount || 0)
    const efBalance = data.fundTx.reduce((t, x) => t + (x.kind === 'withdrawal' ? -1 : 1) * Number(x.amount), 0)
    const efPct = efTarget > 0 ? Math.min(100, (efBalance / efTarget) * 100) : null

    const saved = data.goals.reduce((t, g) => t + Number(g.current_amount || 0), 0)
    const goalTargets = data.goals.reduce((t, g) => t + Number(g.target_amount || 0), 0)

    const debtTotal = data.debts.reduce((t, d) => t + Number(d.balance), 0)
    const debtMin = data.debts.reduce((t, d) => t + Number(d.minimum_payment || 0), 0)
    const debtsDueSoon = data.debts
      .map((d) => ({ name: d.name, days: daysUntilDueDay(d.due_day, now) }))
      .filter((d) => d.days !== null && d.days <= 7)

    const invested = data.investments.reduce((t, r) => t + Number(r.contributed_amount), 0)
    const invValue = data.investments.reduce((t, r) => t + Number(r.current_value ?? r.contributed_amount), 0)
    const roi = invested > 0 ? ((invValue - invested) / invested) * 100 : null

    const snaps = [...data.snapshots].sort((a, b) => b.date.localeCompare(a.date))
    const nw = snaps[0] ? Number(snaps[0].total_assets) - Number(snaps[0].total_liabilities) : null
    const nwPrev = snaps[1] ? Number(snaps[1].total_assets) - Number(snaps[1].total_liabilities) : null

    const activeSubs = data.subs.filter((x) => x.active)
    const subMonthly = activeSubs.reduce((t, x) => t + Number(x.amount) / (x.billing_cycle === 'annual' ? 12 : x.billing_cycle === 'quarterly' ? 3 : 1), 0)
    const todayStr = now.toISOString().slice(0, 10)
    const in7 = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10)
    const subsDueSoon = activeSubs.filter((x) => x.next_renewal && x.next_renewal >= todayStr && x.next_renewal <= in7)

    const simpleOwed = data.sales.reduce((t, x) => t + Math.max(0, Number(x.amount_charged) - Number(x.amount_paid)), 0)
    const deadIds = new Set(data.omStatuses.filter((x) => ['cancelled', 'refunded'].includes(norm(x.name))).map((x) => x.id))
    const paidByOrder = {}
    for (const p of data.omPayments) if (p.order_id) paidByOrder[p.order_id] = (paidByOrder[p.order_id] || 0) + Number(p.amount)
    const omOwed = data.omOrders.filter((o) => !deadIds.has(o.status_id)).reduce((t, o) => t + Math.max(0, Number(o.total) - (paidByOrder[o.id] || 0)), 0)
    const supplierOwed = data.omRestocks.reduce((t, r) => t + Number(r.total_cost) - Number(r.amount_paid), 0)

    const attention = []
    for (const r of overBudget) attention.push({ text: `${r.category} is over budget by ${money(r.actual - r.budgeted)}`, to: '/budget', color: 'budget' })
    for (const d of debtsDueSoon) attention.push({ text: `${d.name} payment due ${d.days === 0 ? 'today' : `in ${d.days} day${d.days === 1 ? '' : 's'}`}`, to: '/debt', color: 'debt' })
    for (const x of subsDueSoon) attention.push({ text: `${x.name} renews ${x.next_renewal}`, to: '/subscriptions', color: 'sub' })
    if (efPct !== null && efPct < 25) attention.push({ text: `Emergency fund is only ${efPct.toFixed(0)}% of target`, to: '/emergency', color: 'emergency' })
    if (simpleOwed > 0.005) attention.push({ text: `Customers owe your simple businesses ${money(simpleOwed)}`, to: '/businesses', color: 'worth' })
    if (omOwed > 0.005) attention.push({ text: `Unpaid Cozy Culture orders: ${money(omOwed)}`, to: '/businesses', color: 'worth' })
    if (supplierOwed > 0.005) attention.push({ text: `You owe suppliers ${money(supplierOwed)}`, to: '/businesses', color: 'worth' })

    return {
      ym, monthIncome, monthSpent, net: monthIncome - monthSpent, topCat,
      budgeted, budgetActual, overBudgetCount: overBudget.length, budgetCount: budgetRows.length,
      efTarget, efBalance, efPct, saved, goalTargets, goalCount: data.goals.length,
      debtTotal, debtMin, debtCount: data.debts.length, invested, invValue, roi, invCount: data.investments.length,
      nw, nwChange: nw !== null && nwPrev !== null ? nw - nwPrev : null,
      subMonthly, subCount: activeSubs.length, subsDueSoon,
      businessCount: data.businesses.length, simpleOwed, omOwed, supplierOwed, attention,
    }
  }, [data])

  if (!s) return <p className="text-sm text-muted">Loading your overview…</p>

  const monthName = new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const pct = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

  const cards = {
    income: { value: money(s.monthIncome), sub: `Net cash flow ${s.net >= 0 ? '+' : ''}${money(s.net)} this month` },
    spending: { value: money(s.monthSpent), sub: s.topCat ? `Most on ${s.topCat[0]} (${money(s.topCat[1])})` : 'Nothing logged this month' },
    budget: s.budgetCount
      ? { value: `${money(s.budgetActual)} / ${money(s.budgeted)}`, sub: s.overBudgetCount ? `${s.overBudgetCount} categor${s.overBudgetCount === 1 ? 'y' : 'ies'} over budget` : 'All categories within budget' }
      : { value: '—', sub: 'No budgets set for this month' },
    emergency: s.efTarget > 0
      ? { value: money(s.efBalance), sub: `${s.efPct.toFixed(0)}% of ${money(s.efTarget)} target`, bar: s.efPct }
      : { value: money(s.efBalance), sub: 'No target set yet' },
    savings: { value: money(s.saved), sub: s.goalCount ? `${s.goalCount} pot${s.goalCount === 1 ? '' : 's'}${s.goalTargets ? ` · targets ${money(s.goalTargets)}` : ''}` : 'No savings pots yet' },
    debt: s.debtCount
      ? { value: money(s.debtTotal), sub: `Minimum payments ${money(s.debtMin)} / month` }
      : { value: money(0), sub: 'No debts recorded' },
    investments: s.invCount
      ? { value: money(s.invValue), sub: `Put in ${money(s.invested)} · ROI ${s.roi === null ? '—' : pct(s.roi)}` }
      : { value: '—', sub: 'No investments yet' },
    networth: s.nw !== null
      ? { value: money(s.nw), sub: s.nwChange === null ? 'First snapshot' : `${s.nwChange >= 0 ? '+' : ''}${money(s.nwChange)} since previous snapshot` }
      : { value: '—', sub: 'No snapshots yet' },
    subscriptions: s.subCount
      ? { value: `${money(s.subMonthly)} / mo`, sub: `${s.subCount} active${s.subsDueSoon.length ? ` · ${s.subsDueSoon.length} renewing this week` : ''}` }
      : { value: '—', sub: 'No active subscriptions' },
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <h1 className="font-display text-2xl font-semibold text-text mb-1">Overview</h1>
      <p className="text-sm text-muted mb-6">Everything at a glance — {monthName}. Tap any card to open it.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border p-4"
          style={{ borderColor: s.net >= 0 ? 'var(--color-income)' : 'var(--color-spend)', background: `color-mix(in srgb, var(--color-${s.net >= 0 ? 'income' : 'spend'}) 10%, var(--color-surface))` }}>
          <div className="text-xs text-muted mb-1">Net cash flow this month</div>
          <div className="font-mono-nums text-xl font-medium" style={{ color: s.net >= 0 ? 'var(--color-income)' : 'var(--color-spend)' }}>
            {s.net >= 0 ? '+' : ''}{money(s.net)}
          </div>
        </div>
        <div className="rounded-xl border border-line p-4" style={{ background: 'color-mix(in srgb, var(--color-worth) 10%, var(--color-surface))' }}>
          <div className="text-xs text-muted mb-1">Net worth</div>
          <div className="font-mono-nums text-xl text-text font-medium">{s.nw === null ? '—' : money(s.nw)}</div>
        </div>
        <div className="rounded-xl border border-line p-4" style={{ background: 'color-mix(in srgb, var(--color-debt) 10%, var(--color-surface))' }}>
          <div className="text-xs text-muted mb-1">Total debt</div>
          <div className="font-mono-nums text-xl text-text font-medium">{money(s.debtTotal)}</div>
        </div>
      </div>

      {s.attention.length > 0 && (
        <div className="rounded-xl border border-line bg-surface p-4 mb-6">
          <div className="text-sm text-text font-medium mb-2">Needs attention</div>
          <div className="space-y-1.5">
            {s.attention.map((a, i) => (
              <Link key={i} to={a.to} className="flex items-center gap-2 text-sm text-muted hover:text-text transition-colors">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: `var(--color-${a.color})` }} />
                {a.text}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3 mb-3">
        {stages.map((st) => {
          const Icon = Icons[st.icon]
          const c = cards[st.id]
          return (
            <Link key={st.id} to={st.path}
              className="rounded-xl border border-line p-4 hover:border-text/30 transition-colors"
              style={{ background: `color-mix(in srgb, var(--color-${st.color}) 7%, var(--color-surface))` }}>
              <div className="flex items-center gap-2 mb-2">
                {Icon && <Icon size={15} style={{ color: `var(--color-${st.color})` }} />}
                <span className="text-xs text-muted">{st.label}</span>
              </div>
              <div className="font-mono-nums text-lg text-text font-medium">{c.value}</div>
              {c.bar !== undefined && (
                <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden my-1.5">
                  <div className="h-full rounded-full" style={{ width: `${c.bar}%`, background: `var(--color-${st.color})` }} />
                </div>
              )}
              <div className="text-xs text-muted mt-0.5">{c.sub}</div>
            </Link>
          )
        })}
      </div>

      <Link to="/businesses" className="block rounded-xl border border-line p-4 hover:border-text/30 transition-colors"
        style={{ background: 'color-mix(in srgb, var(--color-worth) 7%, var(--color-surface))' }}>
        <div className="flex items-center gap-2 mb-2">
          <Icons.Store size={15} style={{ color: 'var(--color-worth)' }} />
          <span className="text-xs text-muted">Businesses</span>
        </div>
        <div className="font-mono-nums text-lg text-text font-medium">{s.businessCount} business{s.businessCount === 1 ? '' : 'es'}</div>
        <div className="text-xs text-muted mt-0.5">
          Owed to you {money(s.simpleOwed + s.omOwed)}{s.supplierOwed > 0.005 ? ` · you owe suppliers ${money(s.supplierOwed)}` : ''}
        </div>
      </Link>
    </motion.div>
  )
}
