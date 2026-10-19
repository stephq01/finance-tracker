import { useEffect, useMemo, useState } from 'react'
import { Trash2, Copy, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { money, paymentStatus, logAudit, formatOrderDate, buildCostLookup, insertOrderItems } from '../../lib/orderMgmt'
import StockInTab from './StockInTab'
import OrderEditForm from './OrderEditForm'

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'neworder', label: 'New order' },
  { id: 'orders', label: 'Orders' },
  { id: 'customers', label: 'Customers' },
  { id: 'products', label: 'Products' },
  { id: 'stockin', label: 'Stock in' },
  { id: 'payments', label: 'Payments' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'settings', label: 'Settings' },
]

export default function OrderBusinessDetail({ business, userId }) {
  const [tab, setTab] = useState('dashboard')
  const [loading, setLoading] = useState(true)
  const [statuses, setStatuses] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [expenseCategories, setExpenseCategories] = useState([])
  const [deliveryMethods, setDeliveryMethods] = useState([])
  const [settings, setSettings] = useState(null)
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [variants, setVariants] = useState([])
  const [orders, setOrders] = useState([])
  const [orderItems, setOrderItems] = useState([])
  const [payments, setPayments] = useState([])
  const [expenses, setExpenses] = useState([])
  const [restocks, setRestocks] = useState([])

  async function load() {
    setLoading(true)
    const bid = business.id
    const [
      { data: st }, { data: pm }, { data: ec }, { data: dm }, { data: set_ },
      { data: cu }, { data: pr }, { data: va }, { data: or_ }, { data: oi }, { data: pay }, { data: ex }, { data: rs },
    ] = await Promise.all([
      supabase.from('om_order_statuses').select('*').eq('business_id', bid).order('sort_order'),
      supabase.from('om_payment_methods').select('*').eq('business_id', bid).order('sort_order'),
      supabase.from('om_expense_categories').select('*').eq('business_id', bid).order('sort_order'),
      supabase.from('om_delivery_methods').select('*').eq('business_id', bid).order('sort_order'),
      supabase.from('om_settings').select('*').eq('business_id', bid).maybeSingle(),
      supabase.from('om_customers').select('*').eq('business_id', bid).order('name'),
      supabase.from('om_products').select('*').eq('business_id', bid).order('name'),
      supabase.from('om_product_variants').select('*').eq('business_id', bid),
      supabase.from('om_orders').select('*').eq('business_id', bid).order('created_at', { ascending: false }),
      supabase.from('om_order_items').select('*').eq('business_id', bid),
      supabase.from('om_payments').select('*').eq('business_id', bid).order('payment_date', { ascending: false }),
      supabase.from('om_expenses').select('*').eq('business_id', bid).order('expense_date', { ascending: false }),
      supabase.from('om_restocks').select('*').eq('business_id', bid).order('restock_date', { ascending: false }).order('created_at', { ascending: false }),
    ])
    setStatuses(st || [])
    setPaymentMethods(pm || [])
    setExpenseCategories(ec || [])
    setDeliveryMethods(dm || [])
    setSettings(set_ || null)
    setCustomers(cu || [])
    setProducts(pr || [])
    setVariants(va || [])
    setOrders(or_ || [])
    setOrderItems(oi || [])
    setPayments(pay || [])
    setExpenses(ex || [])
    setRestocks(rs || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business.id])

  const productsWithVariants = useMemo(
    () => products.map((p) => ({ ...p, variants: variants.filter((v) => v.product_id === p.id) })),
    [products, variants]
  )

  const ordersEnriched = useMemo(
    () =>
      orders.map((o) => ({
        ...o,
        items: orderItems.filter((i) => i.order_id === o.id),
        payments: payments.filter((p) => p.order_id === o.id),
        customer: customers.find((c) => c.id === o.customer_id) || null,
        status: statuses.find((s) => s.id === o.status_id) || null,
      })),
    [orders, orderItems, payments, customers, statuses]
  )

  const costFor = useMemo(() => buildCostLookup(restocks, products, variants), [restocks, products, variants])

  const currency = settings?.currency || 'GHS'

  if (loading) return <p className="text-sm text-muted">Loading order management…</p>

  return (
    <div>
      <div className="flex gap-1 border-b border-line mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px whitespace-nowrap transition-colors ${
              tab === t.id ? 'text-text' : 'text-muted hover:text-text'
            }`}
            style={{ borderBottomColor: tab === t.id ? `var(--color-${business.color})` : 'transparent' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <DashboardTab orders={ordersEnriched} expenses={expenses} expenseCategories={expenseCategories} payments={payments} variants={variants} restocks={restocks} costFor={costFor} currency={currency} />
      )}
      {tab === 'neworder' && (
        <NewOrderTab
          business={business}
          userId={userId}
          customers={customers}
          productsWithVariants={productsWithVariants}
          deliveryMethods={deliveryMethods}
          statuses={statuses}
          settings={settings}
          costFor={costFor}
          currency={currency}
          onDone={() => { load(); setTab('orders') }}
        />
      )}
      {tab === 'orders' && (
        <OrdersTab
          orders={ordersEnriched}
          statuses={statuses}
          variants={variants}
          customers={customers}
          productsWithVariants={productsWithVariants}
          deliveryMethods={deliveryMethods}
          costFor={costFor}
          businessId={business.id}
          userId={userId}
          currency={currency}
          onChange={load}
        />
      )}
      {tab === 'customers' && (
        <CustomersTab customers={customers} orders={ordersEnriched} businessId={business.id} userId={userId} currency={currency} onChange={load} />
      )}
      {tab === 'products' && (
        <ProductsTab productsWithVariants={productsWithVariants} businessId={business.id} userId={userId} currency={currency} onChange={load} />
      )}
      {tab === 'stockin' && (
        <StockInTab
          businessId={business.id}
          userId={userId}
          restocks={restocks}
          productsWithVariants={productsWithVariants}
          currency={currency}
          onChange={load}
        />
      )}
      {tab === 'payments' && (
        <PaymentsTab
          payments={payments}
          orders={ordersEnriched}
          paymentMethods={paymentMethods}
          businessId={business.id}
          userId={userId}
          currency={currency}
          onChange={load}
        />
      )}
      {tab === 'expenses' && (
        <ExpensesTab expenses={expenses} expenseCategories={expenseCategories} businessId={business.id} userId={userId} currency={currency} onChange={load} />
      )}
      {tab === 'settings' && (
        <SettingsTab
          business={business}
          settings={settings}
          statuses={statuses}
          paymentMethods={paymentMethods}
          expenseCategories={expenseCategories}
          deliveryMethods={deliveryMethods}
          businessId={business.id}
          userId={userId}
          onChange={load}
        />
      )}
    </div>
  )
}

// ==================== Dashboard ====================
function DashboardTab({ orders, expenses, expenseCategories, payments, variants, restocks, costFor, currency }) {
  const [range, setRange] = useState('month') // today | week | month | all

  const stats = useMemo(() => {
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10)
    const monthStart = `${now.toISOString().slice(0, 7)}-01`
    const cutoff = range === 'today' ? todayStr : range === 'week' ? weekAgo : range === 'month' ? monthStart : '0000-00-00'

    const live = (o) => !['cancelled', 'refunded'].includes((o.status?.name || '').trim().toLowerCase())
    const inRange = orders.filter((o) => o.order_date >= cutoff && live(o))
    const revenue = inRange.reduce((s, o) => s + Number(o.total), 0)
    const numOrders = inRange.length

    // Cost of goods sold: what the pieces in these orders cost you. Uses the cost saved on each
    // order line; older orders without one are estimated from your Stock in records.
    let cogs = 0
    let estimatedLines = 0
    let unknownLines = 0
    for (const o of inRange) {
      for (const it of o.items) {
        let unit = it.unit_cost_snapshot
        if (unit == null) {
          unit = it.variant_id ? costFor(it.variant_id) : null
          if (unit != null) estimatedLines += 1
        }
        if (unit == null) unknownLines += 1
        else cogs += Number(unit) * Number(it.quantity)
      }
    }
    const grossProfit = revenue - cogs
    const opexRows = expenses.filter((e) => e.expense_date >= cutoff)
    const opex = opexRows.reduce((s, e) => s + Number(e.amount), 0)
    const netProfit = grossProfit - opex
    const margin = revenue > 0 ? (grossProfit / revenue) * 100 : null

    // Supplier purchases are already counted as cost of goods through Stock in, so
    // logging them again under Expenses would count them twice.
    const dupCatIds = new Set(
      expenseCategories.filter((c) => ['product purchase', 'supplier payment'].includes(c.name.trim().toLowerCase())).map((c) => c.id)
    )
    const doubleCounted = opexRows.filter((e) => dupCatIds.has(e.category_id)).reduce((s, e) => s + Number(e.amount), 0)

    const withPayStatus = inRange.map((o) => ({ o, ps: paymentStatus(o, o.payments) }))
    const paidCount = withPayStatus.filter((x) => x.ps.label === 'Paid' || x.ps.label === 'Overpaid').length
    const pending = withPayStatus.filter((x) => x.ps.balance > 0.005)
    const pendingTotal = pending.reduce((s, x) => s + x.ps.balance, 0)
    const collected = payments.filter((p) => p.payment_date >= cutoff).reduce((s, p) => s + Number(p.amount), 0)
    const avgOrderValue = numOrders > 0 ? revenue / numOrders : 0

    const processingLike = orders.filter((o) => o.status && !['delivered', 'cancelled', 'refunded'].includes(o.status.name.trim().toLowerCase()))
    const lowStock = variants.filter((v) => v.is_active !== false && v.stock_quantity <= Number(v.low_stock_threshold ?? 3))

    return {
      revenue, numOrders, paidCount, pendingCount: pending.length, pendingTotal, collected, opex, avgOrderValue,
      cogs, grossProfit, netProfit, margin, estimatedLines, unknownLines, doubleCounted,
      processingCount: processingLike.length, lowStock,
    }
  }, [orders, expenses, expenseCategories, payments, variants, range, costFor])

  const supplierOwed = restocks.reduce((s, r) => s + Number(r.total_cost) - Number(r.amount_paid), 0)

  return (
    <div>
      <div className="flex rounded-lg border border-line overflow-hidden text-sm w-fit mb-6">
        {[['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['all', 'All time']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setRange(id)}
            className={`px-3 py-1.5 transition-colors ${range === id ? 'bg-worth text-ink' : 'text-muted hover:text-text'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-line bg-surface p-4 mb-6">
        <div className="text-sm text-text font-medium mb-3">Profit</div>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-muted">Revenue (orders placed)</span><span className="font-mono-nums text-text">{money(stats.revenue, currency)}</span></div>
          <div className="flex justify-between"><span className="text-muted">− Cost of goods sold</span><span className="font-mono-nums text-text">{money(stats.cogs, currency)}</span></div>
          <div className="flex justify-between border-t border-line pt-1.5">
            <span className="text-text">Gross profit{stats.margin !== null ? ` · ${stats.margin.toFixed(0)}% margin` : ''}</span>
            <span className="font-mono-nums font-medium" style={{ color: stats.grossProfit >= 0 ? 'var(--color-income)' : 'var(--color-spend)' }}>{money(stats.grossProfit, currency)}</span>
          </div>
          <div className="flex justify-between"><span className="text-muted">− Expenses</span><span className="font-mono-nums text-text">{money(stats.opex, currency)}</span></div>
          <div className="flex justify-between border-t border-line pt-1.5">
            <span className="text-text font-medium">Net profit</span>
            <span className="font-mono-nums text-lg font-medium" style={{ color: stats.netProfit >= 0 ? 'var(--color-income)' : 'var(--color-spend)' }}>{money(stats.netProfit, currency)}</span>
          </div>
        </div>
        <div className="mt-3 space-y-1 text-xs text-muted">
          <p>Revenue is what customers were billed (including delivery fees), whether or not they've paid yet — cash actually collected in this period is {money(stats.collected, currency)}. Cancelled and refunded orders are left out.</p>
          {stats.estimatedLines > 0 && (
            <p>{stats.estimatedLines} order line{stats.estimatedLines === 1 ? '' : 's'} had no saved cost, so their cost is estimated from your Stock in records. Open and re-save an order to lock in its cost.</p>
          )}
          {stats.unknownLines > 0 && (
            <p style={{ color: 'var(--color-spend)' }}>{stats.unknownLines} order line{stats.unknownLines === 1 ? '' : 's'} have no known cost at all and are counted as GH₵0, so profit is overstated. Log the stock in Stock in (or set a cost price on the product) to fix this.</p>
          )}
          {stats.doubleCounted > 0.005 && (
            <p style={{ color: 'var(--color-spend)' }}>{money(stats.doubleCounted, currency)} of your expenses are filed under "Product purchase" / "Supplier payment". Clothes you buy are already counted as cost of goods through Stock in, so those are being counted twice and net profit is understated. Delete them from Expenses if they're the same purchases.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Orders" value={stats.numOrders} color="worth" />
        <StatCard label="Paid orders" value={stats.paidCount} color="income" />
        <StatCard label="In progress" value={stats.processingCount} color="budget" />
        <StatCard label="Avg order value" value={money(stats.avgOrderValue, currency)} color="worth" />
        <StatCard label="Pending payments" value={`${stats.pendingCount} · ${money(stats.pendingTotal, currency)}`} color="spend" />
        <StatCard label="Cash collected" value={money(stats.collected, currency)} color="income" />
        <StatCard label="Owed to suppliers" value={money(supplierOwed, currency)} color="debt" />
        <StatCard label="Low-stock items" value={stats.lowStock.length} color="spend" />
      </div>

      {stats.lowStock.length > 0 && (
        <div className="rounded-lg border px-4 py-3" style={{ borderColor: 'var(--color-spend)', background: 'color-mix(in srgb, var(--color-spend) 10%, var(--color-surface))' }}>
          <div className="text-sm text-spend font-medium mb-1">Low stock ({stats.lowStock.length})</div>
          <div className="text-xs text-muted">
            {stats.lowStock.map((v) => `${v.size || ''}${v.size && v.color ? '/' : ''}${v.color || ''} (${v.stock_quantity} left)`).join(', ')}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div className="rounded-xl border-l-4 border border-line p-4"
      style={{ borderLeftColor: `var(--color-${color})`, background: `color-mix(in srgb, var(--color-${color}) 10%, var(--color-surface))` }}>
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className="font-mono-nums text-lg text-text font-medium">{value}</div>
    </div>
  )
}

// ==================== New Order ====================
function NewOrderTab({ business, userId, customers, productsWithVariants, deliveryMethods, statuses, settings, costFor, currency, onDone }) {
  const [customerMode, setCustomerMode] = useState('existing')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', secondary_phone: '', social_handle: '', location: '', notes: '' })
  const [lineItems, setLineItems] = useState([{ product_id: '', variant_id: '', quantity: 1 }])
  const [deliveryMethodId, setDeliveryMethodId] = useState('')
  const [deliveryFee, setDeliveryFee] = useState('0')
  const [discount, setDiscount] = useState('0')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState(null)

  function addLine() {
    setLineItems([...lineItems, { product_id: '', variant_id: '', quantity: 1 }])
  }
  function removeLine(i) {
    setLineItems(lineItems.filter((_, idx) => idx !== i))
  }
  function updateLine(i, patch) {
    setLineItems(lineItems.map((li, idx) => (idx === i ? { ...li, ...patch } : li)))
  }

  function variantFor(productId, variantId) {
    const p = productsWithVariants.find((p) => p.id === productId)
    return p?.variants.find((v) => v.id === variantId)
  }

  const subtotal = useMemo(() => {
    return lineItems.reduce((s, li) => {
      const v = variantFor(li.product_id, li.variant_id)
      return s + (v ? Number(v.price) * Number(li.quantity || 0) : 0)
    }, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineItems, productsWithVariants])

  const total = subtotal + Number(deliveryFee || 0) - Number(discount || 0)

  function handleDeliveryMethodChange(id) {
    setDeliveryMethodId(id)
    const m = deliveryMethods.find((m) => m.id === id)
    if (m) setDeliveryFee(String(m.fee))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const validLines = lineItems.filter((li) => li.product_id && li.variant_id && Number(li.quantity) > 0)
    if (validLines.length === 0) {
      setError('Add at least one product line.')
      return
    }
    if (customerMode === 'existing' && !selectedCustomerId) {
      setError('Select a customer, or switch to "New customer".')
      return
    }
    if (customerMode === 'new' && !newCustomer.name) {
      setError('Enter the new customer\'s name.')
      return
    }
    setSaving(true)
    try {
      let customerId = selectedCustomerId
      if (customerMode === 'new') {
        const { data: c, error: ce } = await supabase.from('om_customers').insert({
          business_id: business.id, user_id: userId,
          name: newCustomer.name, phone: newCustomer.phone || null,
          secondary_phone: newCustomer.secondary_phone || null,
          social_handle: newCustomer.social_handle || null,
          location: newCustomer.location || null, notes: newCustomer.notes || null,
        }).select().single()
        if (ce) throw ce
        customerId = c.id
      }

      const today = new Date().toISOString().slice(0, 10)
      const prefix = settings?.order_id_prefix || 'CC'
      const { data: orderNumber, error: rpcErr } = await supabase.rpc('om_next_order_number', {
        p_business_id: business.id, p_prefix: prefix, p_date: today,
      })
      if (rpcErr) throw rpcErr

      const defaultStatus = statuses.find((s) => s.is_default) || statuses[0]

      const { data: order, error: oe } = await supabase.from('om_orders').insert({
        business_id: business.id, user_id: userId,
        order_number: orderNumber, customer_id: customerId,
        status_id: defaultStatus?.id || null, order_date: today,
        subtotal, delivery_method_id: deliveryMethodId || null,
        delivery_fee: Number(deliveryFee || 0), discount: Number(discount || 0),
        total, notes: notes || null,
      }).select().single()
      if (oe) throw oe

      const itemsPayload = validLines.map((li) => {
        const p = productsWithVariants.find((p) => p.id === li.product_id)
        const v = variantFor(li.product_id, li.variant_id)
        return {
          order_id: order.id, business_id: business.id, user_id: userId,
          product_id: li.product_id, variant_id: li.variant_id,
          product_name_snapshot: p?.name || '', size_snapshot: v?.size || null, color_snapshot: v?.color || null,
          unit_price_snapshot: v?.price || 0, quantity: Number(li.quantity),
          line_total: Number(v?.price || 0) * Number(li.quantity),
          unit_cost_snapshot: costFor(li.variant_id),
        }
      })
      const { error: ie } = await insertOrderItems(itemsPayload)
      if (ie) throw ie

      await logAudit(business.id, userId, order.id, 'Order created', null, { order_number: order.order_number, total: order.total })

      setConfirmation({ order: { ...order, customerName: customerMode === 'new' ? newCustomer.name : customers.find((c) => c.id === customerId)?.name }, items: itemsPayload })
      setLineItems([{ product_id: '', variant_id: '', quantity: 1 }])
      setNewCustomer({ name: '', phone: '', secondary_phone: '', social_handle: '', location: '', notes: '' })
      setSelectedCustomerId('')
      setDeliveryMethodId('')
      setDeliveryFee('0')
      setDiscount('0')
      setNotes('')
      onDone()
    } catch (err) {
      setError(err.message || 'Something went wrong creating the order.')
    } finally {
      setSaving(false)
    }
  }

  if (confirmation) {
    const summary = buildConfirmationText(confirmation, currency)
    return (
      <div className="rounded-xl border border-line bg-surface p-5 max-w-md">
        <div className="text-sm text-income font-medium mb-3">Order created — {confirmation.order.order_number}</div>
        <pre className="whitespace-pre-wrap text-xs text-text bg-surface-2 rounded-lg p-3 mb-3 font-mono-nums">{summary}</pre>
        <div className="flex gap-2">
          <button
            onClick={() => navigator.clipboard?.writeText(summary)}
            className="rounded-lg bg-worth text-ink text-xs font-medium px-3 py-2 flex items-center gap-1"
          >
            <Copy size={13} /> Copy for customer
          </button>
          <button onClick={() => setConfirmation(null)} className="rounded-lg border border-line text-muted text-xs px-3 py-2">
            New order
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="flex gap-1 mb-3 text-sm">
          <button type="button" onClick={() => setCustomerMode('existing')}
            className={`px-3 py-1.5 rounded-lg ${customerMode === 'existing' ? 'bg-worth text-ink' : 'border border-line text-muted'}`}>
            Existing customer
          </button>
          <button type="button" onClick={() => setCustomerMode('new')}
            className={`px-3 py-1.5 rounded-lg ${customerMode === 'new' ? 'bg-worth text-ink' : 'border border-line text-muted'}`}>
            New customer
          </button>
        </div>
        {customerMode === 'existing' ? (
          <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth">
            <option value="">Select a customer…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>)}
          </select>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <input placeholder="Name" value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
              className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth sm:col-span-2" />
            <input placeholder="Phone" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
              className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
            <input placeholder="Secondary phone (optional)" value={newCustomer.secondary_phone} onChange={(e) => setNewCustomer({ ...newCustomer, secondary_phone: e.target.value })}
              className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
            <input placeholder="Instagram / WhatsApp (optional)" value={newCustomer.social_handle} onChange={(e) => setNewCustomer({ ...newCustomer, social_handle: e.target.value })}
              className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
            <input placeholder="Delivery location" value={newCustomer.location} onChange={(e) => setNewCustomer({ ...newCustomer, location: e.target.value })}
              className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
            <input placeholder="Notes (optional)" value={newCustomer.notes} onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
              className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth sm:col-span-2" />
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="text-sm text-text font-medium mb-3">Products</div>
        <div className="space-y-3">
          {lineItems.map((li, i) => {
            const product = productsWithVariants.find((p) => p.id === li.product_id)
            const variant = variantFor(li.product_id, li.variant_id)
            return (
              <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
                <select value={li.product_id} onChange={(e) => updateLine(i, { product_id: e.target.value, variant_id: '' })}
                  className="rounded-lg bg-surface-2 border border-line px-2 py-2 text-sm text-text outline-none focus:border-worth sm:col-span-2">
                  <option value="">Product…</option>
                  {productsWithVariants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select value={li.variant_id} onChange={(e) => updateLine(i, { variant_id: e.target.value })} disabled={!product}
                  className="rounded-lg bg-surface-2 border border-line px-2 py-2 text-sm text-text outline-none focus:border-worth sm:col-span-2 disabled:opacity-50">
                  <option value="">Size / color…</option>
                  {product?.variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {[v.size, v.color].filter(Boolean).join(' / ') || 'Default'} — {money(v.price, currency)} ({v.stock_quantity} in stock)
                    </option>
                  ))}
                </select>
                <input type="number" min="1" value={li.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })}
                  className="rounded-lg bg-surface-2 border border-line px-2 py-2 text-sm text-text outline-none focus:border-worth font-mono-nums" />
                <div className="flex items-center justify-between sm:col-span-5">
                  <div className="text-xs text-muted font-mono-nums">
                    {variant ? `${money(variant.price, currency)} × ${li.quantity || 0} = ${money(Number(variant.price) * Number(li.quantity || 0), currency)}` : ''}
                  </div>
                  {lineItems.length > 1 && (
                    <button type="button" onClick={() => removeLine(i)} className="text-xs text-muted hover:text-spend transition-colors flex items-center gap-1">
                      <Trash2 size={12} /> Remove
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <button type="button" onClick={addLine} className="mt-3 text-xs text-worth hover:opacity-80 transition-opacity">+ Add another product</button>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs text-muted mb-1">Delivery method</label>
          <select value={deliveryMethodId} onChange={(e) => handleDeliveryMethodChange(e.target.value)}
            className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth">
            <option value="">None</option>
            {deliveryMethods.map((m) => <option key={m.id} value={m.id}>{m.name} — {money(m.fee, currency)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Delivery fee (GHS)</label>
          <input type="number" step="0.01" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)}
            className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth font-mono-nums" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Discount (GHS)</label>
          <input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)}
            className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth font-mono-nums" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-muted mb-1">Notes (optional)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4 space-y-1 text-sm">
        <div className="flex justify-between text-muted"><span>Subtotal</span><span className="font-mono-nums">{money(subtotal, currency)}</span></div>
        <div className="flex justify-between text-muted"><span>Delivery</span><span className="font-mono-nums">{money(Number(deliveryFee || 0), currency)}</span></div>
        <div className="flex justify-between text-muted"><span>Discount</span><span className="font-mono-nums">-{money(Number(discount || 0), currency)}</span></div>
        <div className="flex justify-between text-text font-medium pt-1 border-t border-line"><span>Total</span><span className="font-mono-nums">{money(total, currency)}</span></div>
      </div>

      {error && <p className="text-sm text-spend">{error}</p>}
      <button type="submit" disabled={saving}
        className="w-full rounded-lg bg-worth text-ink text-sm font-medium py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50">
        {saving ? 'Creating order…' : 'Create order'}
      </button>
    </form>
  )
}

function buildConfirmationText(confirmation, currency) {
  const { order, items } = confirmation
  const lines = items.map((it) => `${it.quantity} × ${it.product_name_snapshot}${it.size_snapshot || it.color_snapshot ? ` (${[it.size_snapshot, it.color_snapshot].filter(Boolean).join('/')})` : ''} — ${money(it.unit_price_snapshot, currency)}`)
  return [
    `Order ID: ${order.order_number}`,
    '',
    'Items:',
    ...lines,
    '',
    `Subtotal: ${money(order.subtotal, currency)}`,
    `Delivery: ${money(order.delivery_fee, currency)}`,
    `Discount: ${money(order.discount, currency)}`,
    `Total: ${money(order.total, currency)}`,
    '',
    `Customer: ${order.customerName || ''}`,
    '',
    `Please keep your Order ID: ${order.order_number}`,
  ].join('\n')
}

// ==================== Orders ====================
function OrdersTab({ orders, statuses, variants, customers, productsWithVariants, deliveryMethods, costFor, businessId, userId, currency, onChange }) {
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const sorted = [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    if (!q) return sorted
    return sorted.filter((o) =>
      o.order_number.toLowerCase().includes(q) ||
      (o.customer?.name || '').toLowerCase().includes(q) ||
      (o.customer?.phone || '').toLowerCase().includes(q)
    )
  }, [orders, search])

  return (
    <div>
      <input
        placeholder="Search by order ID, customer name or phone…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-4 rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth"
      />
      {filtered.length === 0 ? (
        <p className="text-sm text-muted">No orders yet.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((o) => {
            const ps = paymentStatus(o, o.payments)
            const isOpen = expandedId === o.id
            return (
              <div key={o.id} className="rounded-lg border border-line bg-surface overflow-hidden">
                <button onClick={() => setExpandedId(isOpen ? null : o.id)} className="w-full flex items-center justify-between px-4 py-3 text-left">
                  <div className="min-w-0">
                    <div className="text-sm text-text font-medium font-mono-nums">{o.order_number}</div>
                    <div className="text-xs text-muted truncate">{o.customer?.name || 'No customer'} · {formatOrderDate(o.order_date)} · {o.status?.name || '—'}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: `var(--color-${ps.color})`, background: `color-mix(in srgb, var(--color-${ps.color}) 15%, transparent)` }}>
                      {ps.label}
                    </span>
                    <div className="font-mono-nums text-sm text-text">{money(o.total, currency)}</div>
                    {isOpen ? <ChevronUp size={15} className="text-muted" /> : <ChevronDown size={15} className="text-muted" />}
                  </div>
                </button>
                {isOpen && (
                  <OrderDetailPanel order={o} statuses={statuses} variants={variants} customers={customers} productsWithVariants={productsWithVariants} deliveryMethods={deliveryMethods} costFor={costFor} businessId={businessId} userId={userId} currency={currency} onChange={onChange} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function OrderDetailPanel({ order, statuses, variants, customers, productsWithVariants, deliveryMethods, costFor, businessId, userId, currency, onChange }) {
  const [changing, setChanging] = useState(false)
  const [editing, setEditing] = useState(false)
  const locked = ['cancelled', 'refunded'].includes((order.status?.name || '').trim().toLowerCase())
  const [audit, setAudit] = useState([])
  const ps = paymentStatus(order, order.payments)

  useEffect(() => {
    supabase.from('om_audit_log').select('*').eq('order_id', order.id).order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => setAudit(data || []))
  }, [order.id])

  async function handleStatusChange(newStatusId) {
    const newStatus = statuses.find((s) => s.id === newStatusId)
    const oldStatus = order.status
    if (!newStatus) return
    setChanging(true)
    await supabase.from('om_orders').update({ status_id: newStatusId, updated_at: new Date().toISOString() }).eq('id', order.id)

    if (newStatus.deducts_stock && !order.stock_deducted) {
      for (const item of order.items) {
        if (!item.variant_id) continue
        const v = variants.find((v) => v.id === item.variant_id)
        if (!v) continue
        const newQty = Number(v.stock_quantity) - Number(item.quantity)
        await supabase.from('om_product_variants').update({ stock_quantity: newQty }).eq('id', item.variant_id)
        await supabase.from('om_inventory_transactions').insert({
          business_id: businessId, user_id: userId, variant_id: item.variant_id, order_id: order.id,
          change_qty: -Number(item.quantity), reason: 'order_deduct',
        })
      }
      await supabase.from('om_orders').update({ stock_deducted: true }).eq('id', order.id)
    } else if (newStatus.restores_stock && order.stock_deducted) {
      for (const item of order.items) {
        if (!item.variant_id) continue
        const v = variants.find((v) => v.id === item.variant_id)
        if (!v) continue
        const newQty = Number(v.stock_quantity) + Number(item.quantity)
        await supabase.from('om_product_variants').update({ stock_quantity: newQty }).eq('id', item.variant_id)
        await supabase.from('om_inventory_transactions').insert({
          business_id: businessId, user_id: userId, variant_id: item.variant_id, order_id: order.id,
          change_qty: Number(item.quantity), reason: 'order_restore',
        })
      }
      await supabase.from('om_orders').update({ stock_deducted: false }).eq('id', order.id)
    }

    await logAudit(businessId, userId, order.id, 'Status changed', { status: oldStatus?.name }, { status: newStatus.name })
    setChanging(false)
    onChange()
  }

  return (
    <div className="border-t border-line px-4 py-4 space-y-4">
      {editing ? (
        <OrderEditForm
          order={order}
          customers={customers}
          productsWithVariants={productsWithVariants}
          deliveryMethods={deliveryMethods}
          costFor={costFor}
          businessId={businessId}
          userId={userId}
          currency={currency}
          onSaved={() => { setEditing(false); onChange() }}
          onCancel={() => setEditing(false)}
        />
      ) : (
      <>
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted">Items</div>
        {locked ? (
          <span className="text-xs text-muted">Cancelled/refunded orders can't be edited</span>
        ) : (
          <button onClick={() => setEditing(true)} className="text-xs text-worth hover:opacity-80">Edit order</button>
        )}
      </div>
      <div>
        <div className="space-y-1">
          {order.items.map((it) => (
            <div key={it.id} className="flex justify-between text-sm">
              <span className="text-text">{it.quantity} × {it.product_name_snapshot}{(it.size_snapshot || it.color_snapshot) && ` (${[it.size_snapshot, it.color_snapshot].filter(Boolean).join('/')})`}</span>
              <span className="font-mono-nums text-muted">{money(it.line_total, currency)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <div className="flex justify-between"><span className="text-muted">Subtotal</span><span className="font-mono-nums">{money(order.subtotal, currency)}</span></div>
        <div className="flex justify-between"><span className="text-muted">Delivery</span><span className="font-mono-nums">{money(order.delivery_fee, currency)}</span></div>
        <div className="flex justify-between"><span className="text-muted">Discount</span><span className="font-mono-nums">-{money(order.discount, currency)}</span></div>
        <div className="flex justify-between font-medium"><span>Total</span><span className="font-mono-nums">{money(order.total, currency)}</span></div>
      </div>

      <div className="rounded-lg px-3 py-2 text-sm" style={{ background: `color-mix(in srgb, var(--color-${ps.color}) 10%, var(--color-surface-2))` }}>
        <span style={{ color: `var(--color-${ps.color})` }} className="font-medium">{ps.label}</span>
        <span className="text-muted"> — paid {money(ps.paid, currency)}{ps.balance > 0 ? `, ${money(ps.balance, currency)} remaining` : ''}{ps.overpaid ? `, overpaid by ${money(ps.overpaid, currency)}` : ''}</span>
        {order.payments.length > 0 && (
          <div className="mt-1 text-xs text-muted space-y-0.5">
            {order.payments.map((p) => <div key={p.id}>{formatOrderDate(p.payment_date)} · {money(p.amount, currency)}{p.reference_number ? ` · ref ${p.reference_number}` : ''}</div>)}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs text-muted mb-1">Status</label>
        <select value={order.status_id || ''} disabled={changing} onChange={(e) => handleStatusChange(e.target.value)}
          className="w-full sm:w-64 rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth">
          {statuses.filter((s) => s.is_active !== false).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {order.notes && <div className="text-sm text-muted">Notes: {order.notes}</div>}
      </>
      )}

      {audit.length > 0 && (
        <div>
          <div className="text-xs text-muted mb-1">Timeline</div>
          <div className="space-y-1 text-xs text-muted">
            {audit.map((a) => (
              <div key={a.id}>{formatOrderDate(a.created_at)} — {a.action}{a.new_value?.status ? `: ${a.new_value.status}` : ''}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== Customers ====================
function CustomersTab({ customers, orders, businessId, userId, currency, onChange }) {
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', secondary_phone: '', social_handle: '', location: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState(null)

  const enriched = useMemo(() => {
    return customers.map((c) => {
      const theirOrders = orders.filter((o) => o.customer_id === c.id)
      let totalSpent = 0, outstanding = 0
      for (const o of theirOrders) {
        const ps = paymentStatus(o, o.payments)
        totalSpent += ps.paid
        outstanding += ps.balance
      }
      return { ...c, orderCount: theirOrders.length, totalSpent, outstanding, orders: theirOrders }
    })
  }, [customers, orders])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return enriched
    return enriched.filter((c) => c.name.toLowerCase().includes(q) || (c.phone || '').includes(q))
  }, [enriched, search])

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.name) return
    setSaving(true)
    await supabase.from('om_customers').insert({
      business_id: businessId, user_id: userId,
      name: form.name, phone: form.phone || null, secondary_phone: form.secondary_phone || null,
      social_handle: form.social_handle || null, location: form.location || null, notes: form.notes || null,
    })
    setSaving(false)
    setForm({ name: '', phone: '', secondary_phone: '', social_handle: '', location: '', notes: '' })
    setShowAdd(false)
    onChange()
  }

  const selected = enriched.find((c) => c.id === selectedId)

  async function saveCustomerEdit(e) {
    e.preventDefault()
    if (!editForm.name.trim()) return
    await supabase.from('om_customers').update({
      name: editForm.name.trim(), phone: editForm.phone || null, secondary_phone: editForm.secondary_phone || null,
      social_handle: editForm.social_handle || null, location: editForm.location || null, notes: editForm.notes || null,
    }).eq('id', selectedId)
    setEditing(false)
    onChange()
  }

  if (selected) {
    return (
      <div>
        <button onClick={() => { setSelectedId(null); setEditing(false) }} className="text-xs text-muted hover:text-text mb-4">← All customers</button>
        {editing ? (
          <form onSubmit={saveCustomerEdit} className="rounded-xl border border-line bg-surface p-4 grid gap-2 sm:grid-cols-2 mb-4">
            {[['name', 'Name'], ['phone', 'Phone'], ['secondary_phone', 'Secondary phone'], ['social_handle', 'Instagram / WhatsApp'], ['location', 'Location'], ['notes', 'Notes']].map(([k, ph]) => (
              <input key={k} placeholder={ph} value={editForm[k]} onChange={(e) => setEditForm({ ...editForm, [k]: e.target.value })}
                className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
            ))}
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" className="rounded-lg bg-worth text-ink text-sm font-medium px-4 py-2">Save</button>
              <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-line text-sm text-muted px-4 py-2">Cancel</button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg text-text font-medium">{selected.name}</h2>
              <button onClick={() => { setEditing(true); setEditForm({ name: selected.name, phone: selected.phone || '', secondary_phone: selected.secondary_phone || '', social_handle: selected.social_handle || '', location: selected.location || '', notes: selected.notes || '' }) }}
                className="text-xs text-muted hover:text-text">Edit</button>
            </div>
            <p className="text-xs text-muted mb-4">{[selected.phone, selected.location].filter(Boolean).join(' · ')}</p>
          </>
        )}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <StatCard label="Orders" value={selected.orderCount} color="worth" />
          <StatCard label="Total spent" value={money(selected.totalSpent, currency)} color="income" />
          <StatCard label="Outstanding" value={money(selected.outstanding, currency)} color="spend" />
        </div>
        <div className="space-y-2">
          {selected.orders.map((o) => {
            const ps = paymentStatus(o, o.payments)
            return (
              <div key={o.id} className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3 text-sm">
                <div>
                  <div className="font-mono-nums text-text">{o.order_number}</div>
                  <div className="text-xs text-muted">{formatOrderDate(o.order_date)} · {o.status?.name}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono-nums">{money(o.total, currency)}</div>
                  <div className="text-xs" style={{ color: `var(--color-${ps.color})` }}>{ps.label}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      <input placeholder="Search customers…" value={search} onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-4 rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
      <div className="space-y-2 mb-4">
        {filtered.map((c) => (
          <button key={c.id} onClick={() => setSelectedId(c.id)} className="w-full flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3 text-left hover:border-worth transition-colors">
            <div>
              <div className="text-sm text-text">{c.name}</div>
              <div className="text-xs text-muted">{c.phone} · {c.orderCount} order{c.orderCount === 1 ? '' : 's'}</div>
            </div>
            <div className="text-right text-xs">
              <div className="text-text font-mono-nums">{money(c.totalSpent, currency)} spent</div>
              {c.outstanding > 0.005 && <div className="text-spend font-mono-nums">{money(c.outstanding, currency)} owed</div>}
            </div>
          </button>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted">No customers yet.</p>}
      </div>

      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-muted hover:text-text hover:border-worth transition-colors w-full sm:w-auto">
          + Add a customer
        </button>
      ) : (
        <form onSubmit={handleAdd} className="rounded-xl border border-line bg-surface p-4 grid gap-2 sm:grid-cols-2 max-w-lg">
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth sm:col-span-2" autoFocus />
          <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
          <input placeholder="Secondary phone" value={form.secondary_phone} onChange={(e) => setForm({ ...form, secondary_phone: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
          <input placeholder="Instagram / WhatsApp" value={form.social_handle} onChange={(e) => setForm({ ...form, social_handle: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
          <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
          <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth sm:col-span-2" />
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-worth text-ink text-sm font-medium px-4 py-2 disabled:opacity-50">{saving ? 'Adding…' : 'Add customer'}</button>
            <button type="button" onClick={() => setShowAdd(false)} className="rounded-lg border border-line text-sm text-muted px-4 py-2">Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}

// ==================== Products ====================
function ProductsTab({ productsWithVariants, businessId, userId, currency, onChange }) {
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [productForm, setProductForm] = useState({ name: '', category: '', description: '', cost_price: '' })
  const [addingVariantFor, setAddingVariantFor] = useState(null)
  const [variantForm, setVariantForm] = useState({ size: '', color: '', price: '', stock_quantity: '0', low_stock_threshold: '3' })
  const [editVariant, setEditVariant] = useState({}) // id -> {size, color, price, stock_quantity, low_stock_threshold}
  const [editingProductId, setEditingProductId] = useState(null)
  const [productEdit, setProductEdit] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleAddProduct(e) {
    e.preventDefault()
    if (!productForm.name) return
    setSaving(true)
    await supabase.from('om_products').insert({
      business_id: businessId, user_id: userId,
      name: productForm.name, category: productForm.category || null,
      description: productForm.description || null,
      cost_price: productForm.cost_price ? Number(productForm.cost_price) : null,
    })
    setSaving(false)
    setProductForm({ name: '', category: '', description: '', cost_price: '' })
    setShowAddProduct(false)
    onChange()
  }

  async function saveProductEdit(id) {
    if (!productEdit.name.trim()) return
    await supabase.from('om_products').update({
      name: productEdit.name.trim(),
      category: productEdit.category || null,
      cost_price: productEdit.cost_price === '' ? null : Number(productEdit.cost_price),
    }).eq('id', id)
    setEditingProductId(null)
    onChange()
  }

  async function handleDeleteProduct(id) {
    await supabase.from('om_products').delete().eq('id', id)
    onChange()
  }

  async function handleAddVariant(e, productId) {
    e.preventDefault()
    if (!variantForm.price) return
    setSaving(true)
    await supabase.from('om_product_variants').insert({
      business_id: businessId, user_id: userId, product_id: productId,
      size: variantForm.size || null, color: variantForm.color || null,
      price: Number(variantForm.price), stock_quantity: Number(variantForm.stock_quantity || 0),
      low_stock_threshold: variantForm.low_stock_threshold ? Number(variantForm.low_stock_threshold) : null,
    })
    setSaving(false)
    setVariantForm({ size: '', color: '', price: '', stock_quantity: '0', low_stock_threshold: '3' })
    setAddingVariantFor(null)
    onChange()
  }

  async function handleDeleteVariant(id) {
    await supabase.from('om_product_variants').delete().eq('id', id)
    onChange()
  }

  async function saveVariantEdit(id) {
    const edit = editVariant[id]
    if (!edit) return
    await supabase.from('om_product_variants').update({
      size: edit.size.trim() || null, color: edit.color.trim() || null,
      price: Number(edit.price), stock_quantity: Number(edit.stock_quantity), low_stock_threshold: Number(edit.low_stock_threshold),
    }).eq('id', id)
    onChange()
  }

  return (
    <div>
      <div className="space-y-4 mb-6">
        {productsWithVariants.map((p) => (
          <div key={p.id} className="rounded-xl border border-line bg-surface p-4">
            {editingProductId === p.id ? (
              <div className="grid gap-2 sm:grid-cols-3 mb-2">
                <input value={productEdit.name} onChange={(e) => setProductEdit({ ...productEdit, name: e.target.value })} placeholder="Product name"
                  className="rounded-lg bg-surface-2 border border-line px-3 py-1.5 text-sm text-text outline-none focus:border-worth" />
                <input value={productEdit.category} onChange={(e) => setProductEdit({ ...productEdit, category: e.target.value })} placeholder="Category"
                  className="rounded-lg bg-surface-2 border border-line px-3 py-1.5 text-sm text-text outline-none focus:border-worth" />
                <input type="number" step="0.01" value={productEdit.cost_price} onChange={(e) => setProductEdit({ ...productEdit, cost_price: e.target.value })} placeholder="Cost price"
                  className="rounded-lg bg-surface-2 border border-line px-3 py-1.5 text-sm text-text outline-none focus:border-worth font-mono-nums" />
                <div className="sm:col-span-3 flex gap-2">
                  <button onClick={() => saveProductEdit(p.id)} className="rounded-lg bg-worth text-ink text-xs font-medium px-3 py-1.5">Save</button>
                  <button onClick={() => setEditingProductId(null)} className="rounded-lg border border-line text-muted text-xs px-3 py-1.5">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm text-text font-medium">{p.name}</div>
                  {p.category && <div className="text-xs text-muted">{p.category}</div>}
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => { setEditingProductId(p.id); setProductEdit({ name: p.name, category: p.category || '', cost_price: p.cost_price ?? '' }) }}
                    className="text-xs text-muted hover:text-text transition-colors">Edit</button>
                  <button onClick={() => handleDeleteProduct(p.id)} className="text-xs text-muted hover:text-spend transition-colors flex items-center gap-1">
                    <Trash2 size={12} /> Delete product
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-1">
              {p.variants.map((v) => {
                const e = editVariant[v.id] || { size: v.size || '', color: v.color || '', price: v.price, stock_quantity: v.stock_quantity, low_stock_threshold: v.low_stock_threshold ?? 3 }
                return (
                  <div key={v.id} className="grid grid-cols-2 sm:grid-cols-7 gap-2 items-center text-sm bg-surface-2 rounded-lg px-3 py-2">
                    <input value={e.size} onChange={(ev) => setEditVariant({ ...editVariant, [v.id]: { ...e, size: ev.target.value } })}
                      className="rounded-md bg-surface border border-line px-2 py-1 text-xs" placeholder="Size" />
                    <input value={e.color} onChange={(ev) => setEditVariant({ ...editVariant, [v.id]: { ...e, color: ev.target.value } })}
                      className="rounded-md bg-surface border border-line px-2 py-1 text-xs" placeholder="Color" />
                    <input type="number" step="0.01" value={e.price} onChange={(ev) => setEditVariant({ ...editVariant, [v.id]: { ...e, price: ev.target.value } })}
                      className="rounded-md bg-surface border border-line px-2 py-1 text-xs font-mono-nums" placeholder="Price" />
                    <input type="number" value={e.stock_quantity} onChange={(ev) => setEditVariant({ ...editVariant, [v.id]: { ...e, stock_quantity: ev.target.value } })}
                      className="rounded-md bg-surface border border-line px-2 py-1 text-xs font-mono-nums" placeholder="Stock" />
                    <input type="number" value={e.low_stock_threshold} onChange={(ev) => setEditVariant({ ...editVariant, [v.id]: { ...e, low_stock_threshold: ev.target.value } })}
                      className="rounded-md bg-surface border border-line px-2 py-1 text-xs font-mono-nums" placeholder="Low stock at" />
                    <button onClick={() => saveVariantEdit(v.id)} className="text-xs text-worth">Save</button>
                    <button onClick={() => handleDeleteVariant(v.id)} className="text-xs text-muted hover:text-spend">Delete</button>
                  </div>
                )
              })}
            </div>
            {addingVariantFor === p.id ? (
              <form onSubmit={(e) => handleAddVariant(e, p.id)} className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2">
                <input placeholder="Size" value={variantForm.size} onChange={(e) => setVariantForm({ ...variantForm, size: e.target.value })}
                  className="rounded-lg bg-surface-2 border border-line px-2 py-1.5 text-xs" />
                <input placeholder="Color" value={variantForm.color} onChange={(e) => setVariantForm({ ...variantForm, color: e.target.value })}
                  className="rounded-lg bg-surface-2 border border-line px-2 py-1.5 text-xs" />
                <input type="number" step="0.01" placeholder="Price" value={variantForm.price} onChange={(e) => setVariantForm({ ...variantForm, price: e.target.value })}
                  className="rounded-lg bg-surface-2 border border-line px-2 py-1.5 text-xs font-mono-nums" required />
                <input type="number" placeholder="Stock" value={variantForm.stock_quantity} onChange={(e) => setVariantForm({ ...variantForm, stock_quantity: e.target.value })}
                  className="rounded-lg bg-surface-2 border border-line px-2 py-1.5 text-xs font-mono-nums" />
                <div className="flex gap-1">
                  <button type="submit" disabled={saving} className="rounded-lg bg-worth text-ink text-xs px-2 py-1.5">Add</button>
                  <button type="button" onClick={() => setAddingVariantFor(null)} className="rounded-lg border border-line text-muted text-xs px-2 py-1.5">×</button>
                </div>
              </form>
            ) : (
              <button onClick={() => setAddingVariantFor(p.id)} className="mt-2 text-xs text-worth hover:opacity-80">+ Add size/color variant</button>
            )}
          </div>
        ))}
      </div>

      {!showAddProduct ? (
        <button onClick={() => setShowAddProduct(true)} className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-muted hover:text-text hover:border-worth transition-colors w-full sm:w-auto">
          + Add a product
        </button>
      ) : (
        <form onSubmit={handleAddProduct} className="rounded-xl border border-line bg-surface p-4 grid gap-2 sm:grid-cols-2 max-w-lg">
          <input placeholder="Product name" value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth sm:col-span-2" autoFocus />
          <input placeholder="Category" value={productForm.category} onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
          <input type="number" step="0.01" placeholder="Cost price (optional)" value={productForm.cost_price} onChange={(e) => setProductForm({ ...productForm, cost_price: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth font-mono-nums" />
          <input placeholder="Description (optional)" value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
            className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth sm:col-span-2" />
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-worth text-ink text-sm font-medium px-4 py-2 disabled:opacity-50">{saving ? 'Adding…' : 'Add product'}</button>
            <button type="button" onClick={() => setShowAddProduct(false)} className="rounded-lg border border-line text-sm text-muted px-4 py-2">Cancel</button>
          </div>
          <p className="text-xs text-muted sm:col-span-2">Add size/color variants (with their own price &amp; stock) after creating the product.</p>
        </form>
      )}
    </div>
  )
}

// ==================== Payments ====================
function PaymentsTab({ payments, orders, paymentMethods, businessId, userId, currency, onChange }) {
  const [form, setForm] = useState({ amount: '', payment_date: new Date().toISOString().slice(0, 10), method_id: '', source_account: '', reference_number: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [linkingId, setLinkingId] = useState(null)
  const [linkSearch, setLinkSearch] = useState('')

  const unmatched = useMemo(() => payments.filter((p) => !p.order_id).sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date)), [payments])
  const matched = useMemo(() => payments.filter((p) => p.order_id).sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date)).slice(0, 10), [payments])

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.amount) return
    setSaving(true)
    await supabase.from('om_payments').insert({
      business_id: businessId, user_id: userId,
      amount: Number(form.amount), payment_date: form.payment_date,
      method_id: form.method_id || null, source_account: form.source_account || null,
      reference_number: form.reference_number || null, notes: form.notes || null,
      order_id: null,
    })
    setSaving(false)
    setForm({ amount: '', payment_date: new Date().toISOString().slice(0, 10), method_id: '', source_account: '', reference_number: '', notes: '' })
    onChange()
  }

  async function linkTo(paymentId, orderId) {
    const order = orders.find((o) => o.id === orderId)
    await supabase.from('om_payments').update({ order_id: orderId }).eq('id', paymentId)
    await logAudit(businessId, userId, orderId, 'Payment linked', null, { order_number: order?.order_number })
    setLinkingId(null)
    setLinkSearch('')
    onChange()
  }

  function searchOrders(q) {
    const s = q.trim().toLowerCase()
    if (!s) return []
    return orders.filter((o) =>
      o.order_number.toLowerCase().includes(s) ||
      (o.customer?.name || '').toLowerCase().includes(s) ||
      (o.customer?.phone || '').toLowerCase().includes(s) ||
      String(o.total).includes(s)
    ).slice(0, 8)
  }

  return (
    <div>
      <form onSubmit={handleAdd} className="rounded-xl border border-line bg-surface p-4 mb-8 grid gap-2 sm:grid-cols-3">
        <input type="number" step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth font-mono-nums" />
        <input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
        <select value={form.method_id} onChange={(e) => setForm({ ...form, method_id: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth">
          <option value="">Method…</option>
          {paymentMethods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <input placeholder="Source (e.g. 024XXXXXXX)" value={form.source_account} onChange={(e) => setForm({ ...form, source_account: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
        <input placeholder="Reference (optional)" value={form.reference_number} onChange={(e) => setForm({ ...form, reference_number: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
        <input placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
        <button type="submit" disabled={saving} className="sm:col-span-3 rounded-lg bg-worth text-ink text-sm font-medium py-2.5 disabled:opacity-50">
          {saving ? 'Logging…' : 'Log a payment received'}
        </button>
      </form>

      <h2 className="text-sm font-medium text-text mb-2">Unmatched payments ({unmatched.length})</h2>
      <p className="text-xs text-muted mb-3">Money that's landed in the wallet but isn't linked to an order yet.</p>
      <div className="space-y-2 mb-8">
        {unmatched.length === 0 && <p className="text-sm text-muted">Nothing unmatched right now.</p>}
        {unmatched.map((p) => (
          <div key={p.id} className="rounded-lg border border-line bg-surface px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono-nums text-sm text-text">{money(p.amount, currency)}</div>
                <div className="text-xs text-muted">{formatOrderDate(p.payment_date)}{p.source_account ? ` · ${p.source_account}` : ''}{p.reference_number ? ` · ref ${p.reference_number}` : ''}</div>
              </div>
              <button onClick={() => setLinkingId(linkingId === p.id ? null : p.id)} className="text-xs text-worth hover:opacity-80">
                {linkingId === p.id ? 'Cancel' : 'Link to order'}
              </button>
            </div>
            {linkingId === p.id && (
              <div className="mt-3 border-t border-line pt-3">
                <input placeholder="Search order ID, customer, phone or amount…" value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)}
                  className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" autoFocus />
                <div className="mt-2 space-y-1">
                  {searchOrders(linkSearch).map((o) => (
                    <button key={o.id} onClick={() => linkTo(p.id, o.id)}
                      className="w-full flex justify-between text-left text-sm px-3 py-2 rounded-lg hover:bg-surface-2 transition-colors">
                      <span className="font-mono-nums text-text">{o.order_number} — {o.customer?.name || 'No customer'}</span>
                      <span className="font-mono-nums text-muted">{money(o.total, currency)}</span>
                    </button>
                  ))}
                  {linkSearch && searchOrders(linkSearch).length === 0 && <p className="text-xs text-muted px-3">No matching orders.</p>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {matched.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-text mb-2">Recently matched</h2>
          <div className="space-y-1">
            {matched.map((p) => {
              const o = orders.find((o) => o.id === p.order_id)
              return (
                <div key={p.id} className="flex justify-between text-xs text-muted px-1 py-1">
                  <span>{formatOrderDate(p.payment_date)} · {money(p.amount, currency)}</span>
                  <span className="font-mono-nums">{o?.order_number || '—'}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== Expenses ====================
function ExpensesTab({ expenses, expenseCategories, businessId, userId, currency, onChange }) {
  const [form, setForm] = useState({ expense_date: new Date().toISOString().slice(0, 10), category_id: '', amount: '', description: '', payment_account: '', notes: '' })
  const [saving, setSaving] = useState(false)

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.amount) return
    setSaving(true)
    await supabase.from('om_expenses').insert({
      business_id: businessId, user_id: userId,
      expense_date: form.expense_date, category_id: form.category_id || null,
      amount: Number(form.amount), description: form.description || null,
      payment_account: form.payment_account || null, notes: form.notes || null,
    })
    setSaving(false)
    setForm({ expense_date: new Date().toISOString().slice(0, 10), category_id: '', amount: '', description: '', payment_account: '', notes: '' })
    onChange()
  }

  async function handleDelete(id) {
    await supabase.from('om_expenses').delete().eq('id', id)
    onChange()
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div>
      <div className="rounded-xl border-l-4 border border-line p-4 mb-6 w-fit" style={{ borderLeftColor: 'var(--color-spend)', background: 'color-mix(in srgb, var(--color-spend) 10%, var(--color-surface))' }}>
        <div className="text-xs text-muted mb-1">Total logged</div>
        <div className="font-mono-nums text-xl text-spend font-medium">{money(total, currency)}</div>
      </div>

      <form onSubmit={handleAdd} className="rounded-xl border border-line bg-surface p-4 mb-8 grid gap-2 sm:grid-cols-3">
        <input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
        <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth">
          <option value="">Category…</option>
          {expenseCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="number" step="0.01" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth font-mono-nums" />
        <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth sm:col-span-2" />
        <input placeholder="Paid from (account)" value={form.payment_account} onChange={(e) => setForm({ ...form, payment_account: e.target.value })}
          className="rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
        <button type="submit" disabled={saving} className="sm:col-span-3 rounded-lg bg-spend text-ink text-sm font-medium py-2.5 disabled:opacity-50">
          {saving ? 'Saving…' : 'Add expense'}
        </button>
      </form>

      <div className="space-y-2">
        {expenses.map((e) => (
          <div key={e.id} className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3">
            <div>
              <div className="text-sm text-text">{expenseCategories.find((c) => c.id === e.category_id)?.name || 'Uncategorized'}</div>
              <div className="text-xs text-muted">{formatOrderDate(e.expense_date)}{e.description ? ` · ${e.description}` : ''}</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="font-mono-nums text-sm text-spend">{money(e.amount, currency)}</div>
              <button onClick={() => handleDelete(e.id)} className="text-xs text-muted hover:text-spend transition-colors">Delete</button>
            </div>
          </div>
        ))}
        {expenses.length === 0 && <p className="text-sm text-muted">Nothing logged yet.</p>}
      </div>
    </div>
  )
}

// ==================== Settings ====================
function SettingsTab({ business, settings, statuses, paymentMethods, expenseCategories, deliveryMethods, businessId, userId, onChange }) {
  const [info, setInfo] = useState({
    order_id_prefix: settings?.order_id_prefix || 'CC',
    currency: settings?.currency || 'GHS',
    business_phone: settings?.business_phone || '',
    whatsapp: settings?.whatsapp || '',
    instagram: settings?.instagram || '',
    location: settings?.location || '',
    low_stock_default_threshold: settings?.low_stock_default_threshold ?? 3,
  })
  const [savingInfo, setSavingInfo] = useState(false)

  async function saveInfo(e) {
    e.preventDefault()
    setSavingInfo(true)
    await supabase.from('om_settings').upsert({ business_id: businessId, user_id: userId, ...info, updated_at: new Date().toISOString() })
    setSavingInfo(false)
    onChange()
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <section>
        <h2 className="text-sm font-medium text-text mb-3">Business information</h2>
        <form onSubmit={saveInfo} className="rounded-xl border border-line bg-surface p-4 grid gap-2 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-muted mb-1">Order ID prefix</label>
            <input value={info.order_id_prefix} onChange={(e) => setInfo({ ...info, order_id_prefix: e.target.value.toUpperCase() })}
              className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Currency</label>
            <input value={info.currency} onChange={(e) => setInfo({ ...info, currency: e.target.value.toUpperCase() })}
              className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Phone</label>
            <input value={info.business_phone} onChange={(e) => setInfo({ ...info, business_phone: e.target.value })}
              className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">WhatsApp</label>
            <input value={info.whatsapp} onChange={(e) => setInfo({ ...info, whatsapp: e.target.value })}
              className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Instagram</label>
            <input value={info.instagram} onChange={(e) => setInfo({ ...info, instagram: e.target.value })}
              className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Location</label>
            <input value={info.location} onChange={(e) => setInfo({ ...info, location: e.target.value })}
              className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth" />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Default low-stock threshold</label>
            <input type="number" value={info.low_stock_default_threshold} onChange={(e) => setInfo({ ...info, low_stock_default_threshold: e.target.value })}
              className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth font-mono-nums" />
          </div>
          <button type="submit" disabled={savingInfo} className="sm:col-span-2 rounded-lg bg-worth text-ink text-sm font-medium py-2 disabled:opacity-50">
            {savingInfo ? 'Saving…' : 'Save business information'}
          </button>
        </form>
      </section>

      <ConfigSection
        title="Order statuses"
        table="om_order_statuses"
        businessId={businessId}
        userId={userId}
        rows={statuses}
        onChange={onChange}
        extraFields={['deducts_stock', 'restores_stock', 'is_default']}
      />
      <ConfigSection title="Payment methods" table="om_payment_methods" businessId={businessId} userId={userId} rows={paymentMethods} onChange={onChange} />
      <ConfigSection title="Expense categories" table="om_expense_categories" businessId={businessId} userId={userId} rows={expenseCategories} onChange={onChange} />
      <ConfigSection title="Delivery methods" table="om_delivery_methods" businessId={businessId} userId={userId} rows={deliveryMethods} onChange={onChange} extraFields={['fee']} />
    </div>
  )
}

// Generic editable config list used for statuses / payment methods / expense categories / delivery methods.
function ConfigSection({ title, table, businessId, userId, rows, onChange, extraFields = [] }) {
  const [newName, setNewName] = useState('')
  const [newFee, setNewFee] = useState('0')
  const [saving, setSaving] = useState(false)

  async function addRow(e) {
    e.preventDefault()
    if (!newName) return
    setSaving(true)
    const payload = { business_id: businessId, user_id: userId, name: newName, sort_order: rows.length }
    if (extraFields.includes('fee')) payload.fee = Number(newFee || 0)
    await supabase.from(table).insert(payload)
    setSaving(false)
    setNewName('')
    setNewFee('0')
    onChange()
  }

  async function toggleActive(row) {
    await supabase.from(table).update({ is_active: !row.is_active }).eq('id', row.id)
    onChange()
  }

  async function toggleFlag(row, field) {
    if (field === 'is_default') {
      // only one status can be default
      await supabase.from(table).update({ is_default: false }).eq('business_id', businessId)
    }
    await supabase.from(table).update({ [field]: !row[field] }).eq('id', row.id)
    onChange()
  }

  async function updateFee(row, value) {
    await supabase.from(table).update({ fee: Number(value || 0) }).eq('id', row.id)
    onChange()
  }

  async function deleteRow(id) {
    await supabase.from(table).delete().eq('id', id)
    onChange()
  }

  return (
    <section>
      <h2 className="text-sm font-medium text-text mb-3">{title}</h2>
      <div className="space-y-1 mb-3">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm flex-wrap">
            <span className={`text-text ${r.is_active === false ? 'opacity-40' : ''}`}>{r.name}</span>
            <div className="flex items-center gap-3 text-xs">
              {extraFields.includes('fee') && (
                <input type="number" step="0.01" value={r.fee} onChange={(e) => updateFee(r, e.target.value)}
                  className="w-20 rounded-md bg-surface-2 border border-line px-2 py-1 font-mono-nums" />
              )}
              {extraFields.includes('is_default') && (
                <label className="flex items-center gap-1 text-muted">
                  <input type="checkbox" checked={!!r.is_default} onChange={() => toggleFlag(r, 'is_default')} /> default
                </label>
              )}
              {extraFields.includes('deducts_stock') && (
                <label className="flex items-center gap-1 text-muted">
                  <input type="checkbox" checked={!!r.deducts_stock} onChange={() => toggleFlag(r, 'deducts_stock')} /> deducts stock
                </label>
              )}
              {extraFields.includes('restores_stock') && (
                <label className="flex items-center gap-1 text-muted">
                  <input type="checkbox" checked={!!r.restores_stock} onChange={() => toggleFlag(r, 'restores_stock')} /> restores stock
                </label>
              )}
              <button onClick={() => toggleActive(r)} className="text-muted hover:text-text">{r.is_active === false ? 'Enable' : 'Disable'}</button>
              <button onClick={() => deleteRow(r.id)} className="text-muted hover:text-spend">Delete</button>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={addRow} className="flex gap-2">
        <input placeholder={`Add ${title.toLowerCase().replace(/s$/, '')}…`} value={newName} onChange={(e) => setNewName(e.target.value)}
          className="flex-1 rounded-lg bg-surface-2 border border-line px-3 py-1.5 text-sm text-text outline-none focus:border-worth" />
        {extraFields.includes('fee') && (
          <input type="number" step="0.01" placeholder="Fee" value={newFee} onChange={(e) => setNewFee(e.target.value)}
            className="w-24 rounded-lg bg-surface-2 border border-line px-3 py-1.5 text-sm text-text outline-none focus:border-worth font-mono-nums" />
        )}
        <button type="submit" disabled={saving} className="rounded-lg bg-worth text-ink text-xs font-medium px-3 py-1.5 disabled:opacity-50">Add</button>
      </form>
    </section>
  )
}
