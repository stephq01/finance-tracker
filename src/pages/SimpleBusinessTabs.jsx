import { useMemo, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

const money = (n) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'GHS' }).format(n || 0)

const today = () => new Date().toISOString().slice(0, 10)
const norm = (s) => (s || '').trim().toLowerCase()

const inputCls = 'rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none'

// Small inline "are you sure?" box used before every delete.
function ConfirmBox({ message, busy, onYes, onNo }) {
  return (
    <div className="rounded-lg border px-3 py-2 text-sm"
      style={{ borderColor: 'var(--color-spend)', background: 'color-mix(in srgb, var(--color-spend) 10%, var(--color-surface))' }}>
      <div className="text-text mb-2">{message}</div>
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={onYes} className="rounded-lg bg-spend text-ink text-xs font-medium px-3 py-1.5 disabled:opacity-50">
          {busy ? 'Deleting…' : 'Yes, delete'}
        </button>
        <button type="button" onClick={onNo} className="rounded-lg border border-line text-muted text-xs px-3 py-1.5">Cancel</button>
      </div>
    </div>
  )
}

// ---------------- Stock tab ----------------
export function StockTab({ businessId, userId, color, productStats, restocks, onChange }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', restock_cycle_days: '', low_stock_threshold: '3' })
  const [restockingFor, setRestockingFor] = useState(null)
  const [restockForm, setRestockForm] = useState({ date: today(), quantity: '', cost_amount: '', supplier_paid: false, notes: '' })
  const [saving, setSaving] = useState(false)

  const [editingProductId, setEditingProductId] = useState(null)
  const [productEdit, setProductEdit] = useState(null)
  const [deleteProductId, setDeleteProductId] = useState(null)
  const [editingRestockId, setEditingRestockId] = useState(null)
  const [restockEdit, setRestockEdit] = useState(null)
  const [deleteRestockId, setDeleteRestockId] = useState(null)
  const [openHistory, setOpenHistory] = useState({})
  const [busy, setBusy] = useState(false)

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
    setRestockForm({ date: today(), quantity: '', cost_amount: '', supplier_paid: false, notes: '' })
    setRestockingFor(null)
    onChange()
  }

  function startEditProduct(p) {
    setEditingProductId(p.id)
    setProductEdit({
      name: p.name,
      restock_cycle_days: p.restock_cycle_days ?? '',
      low_stock_threshold: p.low_stock_threshold ?? 3,
    })
  }

  async function saveProductEdit(id) {
    if (!productEdit.name.trim()) return
    await supabase.from('business_products').update({
      name: productEdit.name.trim(),
      restock_cycle_days: productEdit.restock_cycle_days === '' ? null : Number(productEdit.restock_cycle_days),
      low_stock_threshold: Number(productEdit.low_stock_threshold || 3),
    }).eq('id', id)
    setEditingProductId(null)
    onChange()
  }

  async function deleteProduct(id) {
    setBusy(true)
    // restock records belong to the product, so they go with it; sales (money records) stay, just unlinked
    await supabase.from('business_restocks').delete().eq('product_id', id)
    await supabase.from('business_products').delete().eq('id', id)
    setBusy(false)
    setDeleteProductId(null)
    onChange()
  }

  function startEditRestock(r) {
    setEditingRestockId(r.id)
    setRestockEdit({
      date: r.date,
      quantity: r.quantity,
      cost_amount: r.cost_amount ?? '',
      supplier_paid: !!r.supplier_paid,
      notes: r.notes || '',
    })
  }

  async function saveRestockEdit(id) {
    await supabase.from('business_restocks').update({
      date: restockEdit.date,
      quantity: Number(restockEdit.quantity),
      cost_amount: restockEdit.cost_amount === '' ? null : Number(restockEdit.cost_amount),
      supplier_paid: restockEdit.supplier_paid,
      notes: restockEdit.notes || null,
    }).eq('id', id)
    setEditingRestockId(null)
    onChange()
  }

  async function markSupplierPaid(id) {
    await supabase.from('business_restocks').update({ supplier_paid: true }).eq('id', id)
    onChange()
  }

  async function deleteRestock(id) {
    setBusy(true)
    await supabase.from('business_restocks').delete().eq('id', id)
    setBusy(false)
    setDeleteRestockId(null)
    onChange()
  }

  return (
    <div className="space-y-3">
      {productStats.map((p) => {
        const history = restocks.filter((r) => r.product_id === p.id)
        const isEditing = editingProductId === p.id
        return (
          <div key={p.id} className="rounded-xl border border-line bg-surface p-4">
            {isEditing ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <input value={productEdit.name} onChange={(e) => setProductEdit({ ...productEdit, name: e.target.value })}
                  placeholder="Product name" className={inputCls} />
                <input type="number" value={productEdit.restock_cycle_days} onChange={(e) => setProductEdit({ ...productEdit, restock_cycle_days: e.target.value })}
                  placeholder="Restocks every ~N days" className={inputCls} />
                <input type="number" value={productEdit.low_stock_threshold} onChange={(e) => setProductEdit({ ...productEdit, low_stock_threshold: e.target.value })}
                  placeholder="Low stock threshold" className={inputCls} />
                <div className="sm:col-span-3 flex gap-2">
                  <button onClick={() => saveProductEdit(p.id)} className="rounded-lg text-ink text-xs font-medium px-3 py-1.5" style={{ background: `var(--color-${color})` }}>Save</button>
                  <button onClick={() => setEditingProductId(null)} className="rounded-lg border border-line text-muted text-xs px-3 py-1.5">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-sm text-text font-medium flex items-center gap-2 flex-wrap">
                    {p.name}
                    {p.lowStock && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full text-ink font-medium" style={{ background: 'var(--color-spend)' }}>low stock</span>
                    )}
                    {p.restockDue && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full text-ink font-medium" style={{ background: 'var(--color-budget)' }}>restock due</span>
                    )}
                    {p.unpaidSupplier && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full text-text border border-line">supplier unpaid</span>
                    )}
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {p.stock} in stock
                    {p.restock_cycle_days ? ` · restocks every ~${p.restock_cycle_days}d` : ''}
                    {p.lastRestock ? ` · last restocked ${p.lastRestock}` : ' · never restocked'}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setRestockingFor(restockingFor === p.id ? null : p.id)}
                    className="text-xs rounded-lg px-3 py-1.5 font-medium text-ink" style={{ background: `var(--color-${color})` }}>
                    + Restock
                  </button>
                  <button onClick={() => startEditProduct(p)} aria-label={`Edit ${p.name}`} className="text-muted hover:text-text transition-colors"><Pencil size={15} /></button>
                  <button onClick={() => setDeleteProductId(p.id)} aria-label={`Delete ${p.name}`} className="text-muted hover:text-spend transition-colors"><Trash2 size={15} /></button>
                </div>
              </div>
            )}

            {deleteProductId === p.id && (
              <div className="mt-3">
                <ConfirmBox
                  message={`Delete "${p.name}"? This also deletes its ${history.length} restock record${history.length === 1 ? '' : 's'}. Sales you logged stay (they're money records) but won't be tied to a product any more.`}
                  busy={busy}
                  onYes={() => deleteProduct(p.id)}
                  onNo={() => setDeleteProductId(null)}
                />
              </div>
            )}

            {restockingFor === p.id && (
              <form onSubmit={(e) => addRestock(e, p.id)} className="mt-3 pt-3 border-t border-line grid gap-2 sm:grid-cols-2">
                <input type="date" required value={restockForm.date} onChange={(e) => setRestockForm({ ...restockForm, date: e.target.value })} className={inputCls} />
                <input type="number" placeholder="Quantity" required value={restockForm.quantity} onChange={(e) => setRestockForm({ ...restockForm, quantity: e.target.value })}
                  className={`${inputCls} font-mono-nums`} />
                <input type="number" step="0.01" placeholder="Cost (optional)" value={restockForm.cost_amount} onChange={(e) => setRestockForm({ ...restockForm, cost_amount: e.target.value })}
                  className={`${inputCls} font-mono-nums`} />
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" checked={restockForm.supplier_paid} onChange={(e) => setRestockForm({ ...restockForm, supplier_paid: e.target.checked })} />
                  Paid supplier already
                </label>
                <input placeholder="Notes" value={restockForm.notes} onChange={(e) => setRestockForm({ ...restockForm, notes: e.target.value })} className={`${inputCls} sm:col-span-2`} />
                <button type="submit" disabled={saving} className="sm:col-span-2 rounded-lg text-ink text-sm font-medium py-2 disabled:opacity-50" style={{ background: `var(--color-${color})` }}>
                  {saving ? 'Saving…' : 'Log restock'}
                </button>
              </form>
            )}

            {history.length > 0 && !isEditing && (
              <div className="mt-3 pt-3 border-t border-line">
                <button onClick={() => setOpenHistory({ ...openHistory, [p.id]: !openHistory[p.id] })} className="text-xs text-muted hover:text-text">
                  {openHistory[p.id] ? 'Hide' : 'Show'} restock history ({history.length})
                </button>
                {openHistory[p.id] && (
                  <div className="mt-2 space-y-2">
                    {history.map((r) => (
                      editingRestockId === r.id ? (
                        <div key={r.id} className="grid gap-2 sm:grid-cols-2 rounded-lg border border-line p-3">
                          <input type="date" value={restockEdit.date} onChange={(e) => setRestockEdit({ ...restockEdit, date: e.target.value })} className={inputCls} />
                          <input type="number" value={restockEdit.quantity} onChange={(e) => setRestockEdit({ ...restockEdit, quantity: e.target.value })} placeholder="Quantity" className={`${inputCls} font-mono-nums`} />
                          <input type="number" step="0.01" value={restockEdit.cost_amount} onChange={(e) => setRestockEdit({ ...restockEdit, cost_amount: e.target.value })} placeholder="Cost" className={`${inputCls} font-mono-nums`} />
                          <label className="flex items-center gap-2 text-xs text-muted">
                            <input type="checkbox" checked={restockEdit.supplier_paid} onChange={(e) => setRestockEdit({ ...restockEdit, supplier_paid: e.target.checked })} /> Paid supplier
                          </label>
                          <input value={restockEdit.notes} onChange={(e) => setRestockEdit({ ...restockEdit, notes: e.target.value })} placeholder="Notes" className={`${inputCls} sm:col-span-2`} />
                          <div className="sm:col-span-2 flex gap-2">
                            <button onClick={() => saveRestockEdit(r.id)} className="rounded-lg text-ink text-xs font-medium px-3 py-1.5" style={{ background: `var(--color-${color})` }}>Save</button>
                            <button onClick={() => setEditingRestockId(null)} className="rounded-lg border border-line text-muted text-xs px-3 py-1.5">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div key={r.id}>
                          <div className="flex items-center justify-between text-xs">
                            <div className="text-muted">
                              {r.date} · +{r.quantity}{r.cost_amount != null ? ` · ${money(r.cost_amount)}` : ''}
                              {r.notes ? ` · ${r.notes}` : ''}
                              {' · '}
                              <span style={{ color: r.supplier_paid ? 'var(--color-income)' : 'var(--color-spend)' }}>
                                {r.supplier_paid ? 'supplier paid' : 'supplier unpaid'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-2">
                              {!r.supplier_paid && <button onClick={() => markSupplierPaid(r.id)} className="text-muted hover:text-text">Mark paid</button>}
                              <button onClick={() => startEditRestock(r)} className="text-muted hover:text-text">Edit</button>
                              <button onClick={() => setDeleteRestockId(r.id)} className="text-muted hover:text-spend">Delete</button>
                            </div>
                          </div>
                          {deleteRestockId === r.id && (
                            <div className="mt-2">
                              <ConfirmBox message="Delete this restock record? Your stock count for this product will go down by that quantity." busy={busy}
                                onYes={() => deleteRestock(r.id)} onNo={() => setDeleteRestockId(null)} />
                            </div>
                          )}
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {!showAdd ? (
        <button onClick={() => setShowAdd(true)} className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-muted hover:text-text hover:border-worth transition-colors w-full">
          + Add a product
        </button>
      ) : (
        <form onSubmit={addProduct} className="rounded-xl border border-line bg-surface p-4 grid gap-2 sm:grid-cols-3">
          <input placeholder="Product name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`${inputCls} sm:col-span-1`} />
          <input type="number" placeholder="Restocks every ~N days" value={form.restock_cycle_days} onChange={(e) => setForm({ ...form, restock_cycle_days: e.target.value })} className={inputCls} />
          <input type="number" placeholder="Low stock threshold" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} className={inputCls} />
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

// ---------------- Sales tab (Unpaid / Paid) ----------------
function SaleFields({ form, setForm, products }) {
  return (
    <>
      {products.length > 0 && (
        <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} className={`${inputCls} sm:col-span-2`}>
          <option value="">No specific product</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      )}
      <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls} />
      <input placeholder="Customer name" required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className={inputCls} />
      <input placeholder="Room / location" value={form.customer_location} onChange={(e) => setForm({ ...form, customer_location: e.target.value })} className={inputCls} />
      <input type="number" placeholder="Quantity" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={`${inputCls} font-mono-nums`} />
      <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })} className={inputCls}>
        <option value="momo">MoMo</option>
        <option value="telecash">Telecash</option>
        <option value="cash">Physical cash</option>
        <option value="other">Other</option>
      </select>
      <input type="number" step="0.01" placeholder="Amount charged (GHS)" value={form.amount_charged} onChange={(e) => setForm({ ...form, amount_charged: e.target.value })} className={`${inputCls} font-mono-nums`} />
      <input type="number" step="0.01" placeholder="Amount paid (GHS)" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: e.target.value })} className={`${inputCls} font-mono-nums`} />
      <input placeholder="Comments" value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} className={`${inputCls} sm:col-span-2`} />
    </>
  )
}

export function SalesTab({ businessId, userId, color, products, sales, onChange }) {
  const blank = () => ({
    product_id: '', customer_name: '', customer_location: '', quantity: '',
    payment_method: 'cash', amount_charged: '', amount_paid: '', comments: '', date: today(),
  })
  const [form, setForm] = useState(blank())
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState('unpaid') // 'unpaid' | 'paid'
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [busy, setBusy] = useState(false)

  const owedOf = (s) => Number(s.amount_charged) - Number(s.amount_paid)
  const unpaid = useMemo(() => sales.filter((s) => owedOf(s) > 0.005), [sales])
  const paid = useMemo(() => sales.filter((s) => owedOf(s) <= 0.005), [sales])
  const totalOwed = unpaid.reduce((sum, s) => sum + owedOf(s), 0)

  // Unpaid sales grouped by customer so you can see who owes you in total.
  const unpaidByCustomer = useMemo(() => {
    const map = new Map()
    for (const s of unpaid) {
      const key = norm(s.customer_name)
      if (!map.has(key)) map.set(key, { name: s.customer_name, sales: [], owed: 0 })
      const g = map.get(key)
      g.sales.push(s)
      g.owed += owedOf(s)
    }
    return [...map.values()].sort((a, b) => b.owed - a.owed)
  }, [unpaid])

  async function addSale(e) {
    e.preventDefault()
    if (!form.customer_name) return
    setSaving(true)
    await supabase.from('business_sales').insert({
      business_id: businessId,
      user_id: userId,
      product_id: form.product_id || null,
      date: form.date,
      customer_name: form.customer_name.trim(),
      customer_location: form.customer_location || null,
      quantity: form.quantity ? Number(form.quantity) : null,
      payment_method: form.payment_method,
      amount_charged: Number(form.amount_charged || 0),
      amount_paid: Number(form.amount_paid || 0),
      comments: form.comments || null,
    })
    setSaving(false)
    setForm({ ...blank(), date: form.date, payment_method: form.payment_method })
    onChange()
  }

  function startEdit(s) {
    setEditingId(s.id)
    setEditForm({
      product_id: s.product_id || '',
      customer_name: s.customer_name,
      customer_location: s.customer_location || '',
      quantity: s.quantity ?? '',
      payment_method: s.payment_method || 'cash',
      amount_charged: s.amount_charged,
      amount_paid: s.amount_paid,
      comments: s.comments || '',
      date: s.date,
    })
  }

  async function saveEdit(e, id) {
    e.preventDefault()
    await supabase.from('business_sales').update({
      product_id: editForm.product_id || null,
      date: editForm.date,
      customer_name: editForm.customer_name.trim(),
      customer_location: editForm.customer_location || null,
      quantity: editForm.quantity === '' ? null : Number(editForm.quantity),
      payment_method: editForm.payment_method,
      amount_charged: Number(editForm.amount_charged || 0),
      amount_paid: Number(editForm.amount_paid || 0),
      comments: editForm.comments || null,
    }).eq('id', id)
    setEditingId(null)
    onChange()
  }

  async function markPaid(s) {
    await supabase.from('business_sales').update({ amount_paid: s.amount_charged }).eq('id', s.id)
    onChange()
  }

  async function deleteSale(id) {
    setBusy(true)
    await supabase.from('business_sales').delete().eq('id', id)
    setBusy(false)
    setDeleteId(null)
    onChange()
  }

  // plain function (not a component) so inputs keep focus while typing in the edit form
  function renderSaleRow(s) {
    const owed = owedOf(s)
    if (editingId === s.id) {
      return (
        <form onSubmit={(e) => saveEdit(e, s.id)} className="rounded-lg border bg-surface p-3 grid gap-2 sm:grid-cols-2" style={{ borderColor: `var(--color-${color})` }}>
          <SaleFields form={editForm} setForm={setEditForm} products={products} />
          <div className="sm:col-span-2 flex gap-2">
            <button type="submit" className="rounded-lg text-ink text-xs font-medium px-3 py-1.5" style={{ background: `var(--color-${color})` }}>Save</button>
            <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-line text-muted text-xs px-3 py-1.5">Cancel</button>
          </div>
        </form>
      )
    }
    return (
      <div className="rounded-lg border border-line bg-surface px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm text-text truncate">{s.customer_name}{s.customer_location ? ` · ${s.customer_location}` : ''}</div>
            <div className="text-xs text-muted">{s.date} · {s.payment_method}{s.quantity ? ` · qty ${s.quantity}` : ''}{s.comments ? ` · ${s.comments}` : ''}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono-nums text-sm text-text">{money(s.amount_paid)} / {money(s.amount_charged)}</div>
            {owed > 0.005 && <div className="text-xs text-spend">owes {money(owed)}</div>}
          </div>
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs">
          {owed > 0.005 && <button onClick={() => markPaid(s)} className="font-medium" style={{ color: 'var(--color-income)' }}>Mark fully paid</button>}
          <button onClick={() => startEdit(s)} className="text-muted hover:text-text">Edit</button>
          <button onClick={() => setDeleteId(s.id)} className="text-muted hover:text-spend">Delete</button>
        </div>
        {deleteId === s.id && (
          <div className="mt-2">
            <ConfirmBox message="Delete this sale record? This can't be undone." busy={busy} onYes={() => deleteSale(s.id)} onNo={() => setDeleteId(null)} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <form onSubmit={addSale} className="rounded-xl border border-line bg-surface p-4 grid gap-2 sm:grid-cols-2 mb-6">
        <SaleFields form={form} setForm={setForm} products={products} />
        <button type="submit" disabled={saving} className="sm:col-span-2 rounded-lg text-ink text-sm font-medium py-2.5 disabled:opacity-50" style={{ background: `var(--color-${color})` }}>
          {saving ? 'Saving…' : 'Log sale'}
        </button>
      </form>

      <div className="flex gap-1 mb-4 text-sm">
        <button onClick={() => setView('unpaid')}
          className={`px-3 py-1.5 rounded-lg border transition-colors ${view === 'unpaid' ? 'text-ink font-medium border-transparent' : 'border-line text-muted hover:text-text'}`}
          style={view === 'unpaid' ? { background: 'var(--color-spend)' } : undefined}>
          Yet to pay ({unpaid.length})
        </button>
        <button onClick={() => setView('paid')}
          className={`px-3 py-1.5 rounded-lg border transition-colors ${view === 'paid' ? 'text-ink font-medium border-transparent' : 'border-line text-muted hover:text-text'}`}
          style={view === 'paid' ? { background: 'var(--color-income)' } : undefined}>
          Paid ({paid.length})
        </button>
      </div>

      {view === 'unpaid' ? (
        <div className="space-y-4">
          <div className="rounded-xl border-l-4 border border-line p-4 w-fit"
            style={{ borderLeftColor: 'var(--color-spend)', background: 'color-mix(in srgb, var(--color-spend) 10%, var(--color-surface))' }}>
            <div className="text-xs text-muted mb-1">Total still owed to you</div>
            <div className="font-mono-nums text-xl text-spend font-medium">{money(totalOwed)}</div>
            <div className="text-xs text-muted mt-0.5">from {unpaidByCustomer.length} customer{unpaidByCustomer.length === 1 ? '' : 's'}</div>
          </div>
          {unpaidByCustomer.map((g) => (
            <div key={norm(g.name)}>
              <div className="flex justify-between text-sm mb-1.5 px-1">
                <span className="text-text font-medium">{g.name}</span>
                <span className="font-mono-nums text-spend">{money(g.owed)} owed</span>
              </div>
              <div className="space-y-2">{g.sales.map((s) => <div key={s.id}>{renderSaleRow(s)}</div>)}</div>
            </div>
          ))}
          {unpaid.length === 0 && <p className="text-sm text-muted">Nobody owes you anything right now.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {paid.map((s) => <div key={s.id}>{renderSaleRow(s)}</div>)}
          {paid.length === 0 && <p className="text-sm text-muted">No fully-paid sales yet.</p>}
        </div>
      )}
    </div>
  )
}

// ---------------- Deliveries tab ----------------
export function DeliveriesTab({ businessId, userId, color, deliveries, onChange }) {
  const [form, setForm] = useState({ date: today(), period: 'daily', status: 'completed', notes: '' })
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [busy, setBusy] = useState(false)

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

  async function saveEdit(id) {
    await supabase.from('business_deliveries').update({
      date: editForm.date, period: editForm.period, status: editForm.status, notes: editForm.notes || null,
    }).eq('id', id)
    setEditingId(null)
    onChange()
  }

  async function deleteDelivery(id) {
    setBusy(true)
    await supabase.from('business_deliveries').delete().eq('id', id)
    setBusy(false)
    setDeleteId(null)
    onChange()
  }

  const fields = (f, setF) => (
    <>
      <input type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={inputCls} />
      <select value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })} className={inputCls}>
        <option value="daily">Daily round</option>
        <option value="weekly">Weekly round</option>
      </select>
      <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={inputCls}>
        <option value="completed">Completed</option>
        <option value="pending">Pending</option>
      </select>
      <input placeholder="Notes" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} className={inputCls} />
    </>
  )

  return (
    <div>
      <form onSubmit={addDelivery} className="rounded-xl border border-line bg-surface p-4 grid gap-2 sm:grid-cols-2 mb-6">
        {fields(form, setForm)}
        <button type="submit" disabled={saving} className="sm:col-span-2 rounded-lg text-ink text-sm font-medium py-2.5 disabled:opacity-50" style={{ background: `var(--color-${color})` }}>
          {saving ? 'Saving…' : 'Log delivery'}
        </button>
      </form>
      <div className="space-y-2">
        {deliveries.map((d) => (
          editingId === d.id ? (
            <div key={d.id} className="rounded-lg border bg-surface p-3 grid gap-2 sm:grid-cols-2" style={{ borderColor: `var(--color-${color})` }}>
              {fields(editForm, setEditForm)}
              <div className="sm:col-span-2 flex gap-2">
                <button onClick={() => saveEdit(d.id)} className="rounded-lg text-ink text-xs font-medium px-3 py-1.5" style={{ background: `var(--color-${color})` }}>Save</button>
                <button onClick={() => setEditingId(null)} className="rounded-lg border border-line text-muted text-xs px-3 py-1.5">Cancel</button>
              </div>
            </div>
          ) : (
            <div key={d.id} className="rounded-lg border border-line bg-surface px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-text capitalize">{d.period} round</div>
                  <div className="text-xs text-muted">{d.date}{d.notes ? ` · ${d.notes}` : ''}</div>
                </div>
                <span className="text-[10px] px-2 py-1 rounded-full text-ink font-medium" style={{ background: d.status === 'completed' ? 'var(--color-income)' : 'var(--color-budget)' }}>
                  {d.status}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs">
                <button onClick={() => { setEditingId(d.id); setEditForm({ date: d.date, period: d.period, status: d.status, notes: d.notes || '' }) }} className="text-muted hover:text-text">Edit</button>
                <button onClick={() => setDeleteId(d.id)} className="text-muted hover:text-spend">Delete</button>
              </div>
              {deleteId === d.id && (
                <div className="mt-2">
                  <ConfirmBox message="Delete this delivery record?" busy={busy} onYes={() => deleteDelivery(d.id)} onNo={() => setDeleteId(null)} />
                </div>
              )}
            </div>
          )
        ))}
        {deliveries.length === 0 && <p className="text-sm text-muted">No deliveries logged yet.</p>}
      </div>
    </div>
  )
}
