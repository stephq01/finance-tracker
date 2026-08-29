import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import * as Icons from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import PageGlow from '../components/PageGlow'

const money = (n) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'GHS' }).format(n || 0)

const TABS = [
  { id: 'stock', label: 'Stock' },
  { id: 'sales', label: 'Sales' },
  { id: 'deliveries', label: 'Deliveries' },
]

export default function BusinessDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [business, setBusiness] = useState(null)
  const [products, setProducts] = useState([])
  const [restocks, setRestocks] = useState([])
  const [sales, setSales] = useState([])
  const [deliveries, setDeliveries] = useState([])
  const [tab, setTab] = useState('stock')
  const [loading, setLoading] = useState(true)

  async function loadAll() {
    setLoading(true)
    const [{ data: b }, { data: p }, { data: r }, { data: s }, { data: d }] = await Promise.all([
      supabase.from('businesses').select('*').eq('id', id).single(),
      supabase.from('business_products').select('*').eq('business_id', id).order('created_at'),
      supabase.from('business_restocks').select('*').eq('business_id', id).order('date', { ascending: false }),
      supabase.from('business_sales').select('*').eq('business_id', id).order('date', { ascending: false }),
      supabase.from('business_deliveries').select('*').eq('business_id', id).order('date', { ascending: false }),
    ])
    setBusiness(b)
    setProducts(p || [])
    setRestocks(r || [])
    setSales(s || [])
    setDeliveries(d || [])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const productStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return products.map((p) => {
      const rs = restocks.filter((r) => r.product_id === p.id)
      const ss = sales.filter((s) => s.product_id === p.id)
      const stock = rs.reduce((sum, r) => sum + Number(r.quantity), 0) - ss.reduce((sum, s) => sum + Number(s.quantity || 0), 0)
      const lastRestock = rs[0]?.date
      const restockDue =
        p.restock_cycle_days && lastRestock
          ? new Date(today) - new Date(lastRestock) >= p.restock_cycle_days * 86400000
          : false
      const lowStock = stock <= Number(p.low_stock_threshold)
      const unpaidSupplier = rs.some((r) => !r.supplier_paid)
      return { ...p, stock, lastRestock, restockDue, lowStock, unpaidSupplier }
    })
  }, [products, restocks, sales])

  const alerts = productStats.filter((p) => p.lowStock || p.restockDue)

  if (loading || !business) {
    return (
      <div className="relative">
        <p className="text-sm text-muted">Loading…</p>
      </div>
    )
  }

  const Icon = Icons[business.icon] || Icons.Store

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageGlow color={business.color} />

      <Link to="/businesses" className="text-xs text-muted hover:text-text transition-colors">
        ← All businesses
      </Link>

      <div className="flex items-center gap-3 mt-2 mb-1">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, var(--color-${business.color}) 22%, transparent)` }}
        >
          <Icon size={18} style={{ color: `var(--color-${business.color})` }} />
        </div>
        <h1 className="font-display text-2xl font-semibold text-text">{business.name}</h1>
      </div>
      {business.category && <p className="text-sm text-muted mb-4">{business.category}</p>}

      {alerts.length > 0 && (
        <div className="rounded-lg border px-4 py-3 mb-6 text-sm" style={{ borderColor: 'var(--color-spend)', background: 'color-mix(in srgb, var(--color-spend) 12%, var(--color-surface))' }}>
          <span className="text-spend font-medium">Needs attention: </span>
          <span className="text-text">
            {alerts.map((a, i) => (
              <span key={a.id}>
                {i > 0 && ', '}
                {a.name} {a.lowStock && `(${a.stock} left)`}
                {a.lowStock && a.restockDue && ' · '}
                {a.restockDue && 'restock overdue'}
              </span>
            ))}
          </span>
        </div>
      )}

      <div className="flex gap-1 border-b border-line mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'text-text' : 'text-muted hover:text-text'
            }`}
            style={{ borderBottomColor: tab === t.id ? `var(--color-${business.color})` : 'transparent' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'stock' && (
        <StockTab businessId={id} userId={user.id} color={business.color} productStats={productStats} onChange={loadAll} />
      )}
      {tab === 'sales' && (
        <SalesTab businessId={id} userId={user.id} color={business.color} products={products} sales={sales} onChange={loadAll} />
      )}
      {tab === 'deliveries' && (
        <DeliveriesTab businessId={id} userId={user.id} color={business.color} deliveries={deliveries} onChange={loadAll} />
      )}
    </motion.div>
  )
}

// ---------------- Stock tab ----------------
function StockTab({ businessId, userId, color, productStats, onChange }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', restock_cycle_days: '', low_stock_threshold: '3' })
  const [restockingFor, setRestockingFor] = useState(null)
  const [restockForm, setRestockForm] = useState({ date: new Date().toISOString().slice(0, 10), quantity: '', cost_amount: '', supplier_paid: false, notes: '' })
  const [saving, setSaving] = useState(false)

  async function addProduct(e) {
    e.preventDefault()
    if (!form.name) return
    setSaving(true)
    await supabase.from('business_products').insert({
      business_id: businessId,
      user_id: userId,
      name: form.name,
      restock_cycle_days: form.restock_cycle_days ? Number(form.restock_cycle_days) : null,
      low_stock_threshold: Number(form.low_stock_threshold || 3),
    })
    setSaving(false)
    setForm({ name: '', restock_cycle_days: '', low_stock_threshold: '3' })
    setShowAdd(false)
    onChange()
  }

  async function addRestock(e, productId) {
    e.preventDefault()
    if (!restockForm.quantity) return
    setSaving(true)
    await supabase.from('business_restocks').insert({
      business_id: businessId,
      product_id: productId,
      user_id: userId,
      date: restockForm.date,
      quantity: Number(restockForm.quantity),
      cost_amount: restockForm.cost_amount ? Number(restockForm.cost_amount) : null,
      supplier_paid: restockForm.supplier_paid,
      notes: restockForm.notes || null,
    })
    setSaving(false)
    setRestockForm({ date: new Date().toISOString().slice(0, 10), quantity: '', cost_amount: '', supplier_paid: false, notes: '' })
    setRestockingFor(null)
    onChange()
  }

  return (
    <div className="space-y-3">
      {productStats.map((p) => (
        <div key={p.id} className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-sm text-text font-medium flex items-center gap-2">
                {p.name}
                {p.lowStock && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full text-ink font-medium" style={{ background: 'var(--color-spend)' }}>
                    low stock
                  </span>
                )}
                {p.restockDue && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full text-ink font-medium" style={{ background: 'var(--color-budget)' }}>
                    restock due
                  </span>
                )}
                {p.unpaidSupplier && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full text-text border border-line">
                    supplier unpaid
                  </span>
                )}
              </div>
              <div className="text-xs text-muted mt-0.5">
                {p.stock} in stock
                {p.restock_cycle_days ? ` · restocks every ~${p.restock_cycle_days}d` : ''}
                {p.lastRestock ? ` · last restocked ${p.lastRestock}` : ' · never restocked'}
              </div>
            </div>
            <button
              onClick={() => setRestockingFor(restockingFor === p.id ? null : p.id)}
              className="text-xs rounded-lg px-3 py-1.5 font-medium text-ink"
              style={{ background: `var(--color-${color})` }}
            >
              + Restock
            </button>
          </div>

          {restockingFor === p.id && (
            <form onSubmit={(e) => addRestock(e, p.id)} className="mt-3 pt-3 border-t border-line grid gap-2 sm:grid-cols-2">
              <input type="date" required value={restockForm.date} onChange={(e) => setRestockForm({ ...restockForm, date: e.target.value })}
                className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none" />
              <input type="number" placeholder="Quantity" required value={restockForm.quantity} onChange={(e) => setRestockForm({ ...restockForm, quantity: e.target.value })}
                className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none font-mono-nums" />
              <input type="number" step="0.01" placeholder="Cost (optional)" value={restockForm.cost_amount} onChange={(e) => setRestockForm({ ...restockForm, cost_amount: e.target.value })}
                className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none font-mono-nums" />
              <label className="flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={restockForm.supplier_paid} onChange={(e) => setRestockForm({ ...restockForm, supplier_paid: e.target.checked })} />
                Paid supplier already
              </label>
              <input placeholder="Notes" value={restockForm.notes} onChange={(e) => setRestockForm({ ...restockForm, notes: e.target.value })}
                className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none sm:col-span-2" />
              <button type="submit" disabled={saving} className="sm:col-span-2 rounded-lg text-ink text-sm font-medium py-2 disabled:opacity-50" style={{ background: `var(--color-${color})` }}>
                {saving ? 'Saving…' : 'Log restock'}
              </button>
            </form>
          )}
        </div>
      ))}

      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-muted hover:text-text hover:border-worth transition-colors w-full">
          + Add a product
        </button>
      ) : (
        <form onSubmit={addProduct} className="rounded-xl border border-line bg-surface p-4 grid gap-2 sm:grid-cols-3">
          <input placeholder="Product name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none sm:col-span-1" />
          <input type="number" placeholder="Restocks every ~N days" value={form.restock_cycle_days} onChange={(e) => setForm({ ...form, restock_cycle_days: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none" />
          <input type="number" placeholder="Low stock threshold" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none" />
          <div className="sm:col-span-3 flex gap-2">
            <button type="submit" disabled={saving} className="rounded-lg text-ink text-sm font-medium px-4 py-2 disabled:opacity-50" style={{ background: `var(--color-${color})` }}>
              {saving ? 'Adding…' : 'Add product'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-line text-sm text-muted px-4 py-2">Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}

// ---------------- Sales tab ----------------
function SalesTab({ businessId, userId, color, products, sales, onChange }) {
  const [form, setForm] = useState({
    product_id: '', customer_name: '', customer_location: '', quantity: '',
    payment_method: 'cash', amount_charged: '', amount_paid: '', comments: '',
    date: new Date().toISOString().slice(0, 10),
  })
  const [saving, setSaving] = useState(false)

  async function addSale(e) {
    e.preventDefault()
    if (!form.customer_name) return
    setSaving(true)
    await supabase.from('business_sales').insert({
      business_id: businessId,
      user_id: userId,
      product_id: form.product_id || null,
      date: form.date,
      customer_name: form.customer_name,
      customer_location: form.customer_location || null,
      quantity: form.quantity ? Number(form.quantity) : null,
      payment_method: form.payment_method,
      amount_charged: Number(form.amount_charged || 0),
      amount_paid: Number(form.amount_paid || 0),
      comments: form.comments || null,
    })
    setSaving(false)
    setForm({ ...form, customer_name: '', customer_location: '', quantity: '', amount_charged: '', amount_paid: '', comments: '' })
    onChange()
  }

  return (
    <div>
      <form onSubmit={addSale} className="rounded-xl border border-line bg-surface p-4 grid gap-2 sm:grid-cols-2 mb-6">
        {products.length > 0 && (
          <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none sm:col-span-2">
            <option value="">No specific product</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <input placeholder="Customer name" required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none" />
        <input placeholder="Room / location" value={form.customer_location} onChange={(e) => setForm({ ...form, customer_location: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none" />
        <input type="number" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none font-mono-nums" />
        <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none">
          <option value="momo">MoMo</option>
          <option value="telecash">Telecash</option>
          <option value="cash">Physical cash</option>
          <option value="other">Other</option>
        </select>
        <input type="number" step="0.01" placeholder="Amount charged (GHS)" value={form.amount_charged} onChange={(e) => setForm({ ...form, amount_charged: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none font-mono-nums" />
        <input type="number" step="0.01" placeholder="Amount paid (GHS)" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none font-mono-nums" />
        <input placeholder="Comments" value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none sm:col-span-2" />
        <button type="submit" disabled={saving} className="sm:col-span-2 rounded-lg text-ink text-sm font-medium py-2.5 disabled:opacity-50" style={{ background: `var(--color-${color})` }}>
          {saving ? 'Saving…' : 'Log sale'}
        </button>
      </form>

      <div className="space-y-2">
        {sales.map((s) => {
          const owed = Number(s.amount_charged) - Number(s.amount_paid)
          return (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3">
              <div>
                <div className="text-sm text-text">{s.customer_name}{s.customer_location ? ` · ${s.customer_location}` : ''}</div>
                <div className="text-xs text-muted">{s.date} · {s.payment_method}{s.comments ? ` · ${s.comments}` : ''}</div>
              </div>
              <div className="text-right">
                <div className="font-mono-nums text-sm text-text">{money(s.amount_paid)} / {money(s.amount_charged)}</div>
                {owed > 0 && <div className="text-xs text-spend">owes {money(owed)}</div>}
              </div>
            </div>
          )
        })}
        {sales.length === 0 && <p className="text-sm text-muted">No sales logged yet.</p>}
      </div>
    </div>
  )
}

// ---------------- Deliveries tab ----------------
function DeliveriesTab({ businessId, userId, color, deliveries, onChange }) {
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), period: 'daily', status: 'completed', notes: '' })
  const [saving, setSaving] = useState(false)

  async function addDelivery(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('business_deliveries').insert({
      business_id: businessId, user_id: userId,
      date: form.date, period: form.period, status: form.status, notes: form.notes || null,
    })
    setSaving(false)
    setForm({ ...form, notes: '' })
    onChange()
  }

  return (
    <div>
      <form onSubmit={addDelivery} className="rounded-xl border border-line bg-surface p-4 grid gap-2 sm:grid-cols-2 mb-6">
        <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none" />
        <select value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none">
          <option value="daily">Daily round</option>
          <option value="weekly">Weekly round</option>
        </select>
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none">
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
        </select>
        <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none" />
        <button type="submit" disabled={saving} className="sm:col-span-2 rounded-lg text-ink text-sm font-medium py-2.5 disabled:opacity-50" style={{ background: `var(--color-${color})` }}>
          {saving ? 'Saving…' : 'Log delivery'}
        </button>
      </form>
      <div className="space-y-2">
        {deliveries.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3">
            <div>
              <div className="text-sm text-text capitalize">{d.period} round</div>
              <div className="text-xs text-muted">{d.date}{d.notes ? ` · ${d.notes}` : ''}</div>
            </div>
            <span className="text-[10px] px-2 py-1 rounded-full text-ink font-medium" style={{ background: d.status === 'completed' ? 'var(--color-income)' : 'var(--color-budget)' }}>
              {d.status}
            </span>
          </div>
        ))}
        {deliveries.length === 0 && <p className="text-sm text-muted">No deliveries logged yet.</p>}
      </div>
    </div>
  )
}
