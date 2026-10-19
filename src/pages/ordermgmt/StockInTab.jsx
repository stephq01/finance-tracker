import { useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { money, formatOrderDate, adjustVariantStock } from '../../lib/orderMgmt'

const norm = (s) => (s || '').trim().toLowerCase()
const today = () => new Date().toISOString().slice(0, 10)
const inputCls = 'rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth'

export default function StockInTab({ businessId, userId, restocks, productsWithVariants, currency, onChange }) {
  const blank = () => ({
    restock_date: today(), product_name: '', size: '', color: '', quantity: '',
    unit_cost: '', selling_price: '', supplier: '', amount_paid: '', notes: '',
  })
  const [form, setForm] = useState(blank())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [view, setView] = useState('all') // all | owed | paid
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [busy, setBusy] = useState(false)

  const owedOf = (r) => Number(r.total_cost) - Number(r.amount_paid)
  const totals = useMemo(() => {
    const spent = restocks.reduce((s, r) => s + Number(r.total_cost), 0)
    const paid = restocks.reduce((s, r) => s + Number(r.amount_paid), 0)
    return { spent, paid, owed: spent - paid }
  }, [restocks])

  const owedBySupplier = useMemo(() => {
    const map = new Map()
    for (const r of restocks) {
      const o = owedOf(r)
      if (o <= 0.005) continue
      const key = norm(r.supplier) || '(no supplier named)'
      map.set(key, { name: r.supplier || '(no supplier named)', owed: (map.get(key)?.owed || 0) + o })
    }
    return [...map.values()].sort((a, b) => b.owed - a.owed)
  }, [restocks])

  const shown = useMemo(() => {
    if (view === 'owed') return restocks.filter((r) => owedOf(r) > 0.005)
    if (view === 'paid') return restocks.filter((r) => owedOf(r) <= 0.005)
    return restocks
  }, [restocks, view])

  const matchedProduct = productsWithVariants.find((p) => norm(p.name) === norm(form.product_name))
  const sizeOptions = [...new Set((matchedProduct?.variants || []).map((v) => v.size).filter(Boolean))]
  const colorOptions = [...new Set((matchedProduct?.variants || []).map((v) => v.color).filter(Boolean))]
  const liveTotal = Number(form.quantity || 0) * Number(form.unit_cost || 0)
  const liveOwed = liveTotal - Number(form.amount_paid || 0)

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    setMessage('')
    const qty = Number(form.quantity)
    if (!form.product_name.trim()) return setError('Enter the product name (e.g. Joggers).')
    if (!(qty > 0)) return setError('Enter how many pieces you bought.')
    if (Number(form.amount_paid || 0) > liveTotal + 0.005) return setError('Amount paid to supplier is more than the total cost.')

    setSaving(true)
    try {
      let product = matchedProduct
      let createdNew = false
      if (!product) {
        const { data, error: pe } = await supabase.from('om_products').insert({
          business_id: businessId, user_id: userId, name: form.product_name.trim(),
          cost_price: form.unit_cost ? Number(form.unit_cost) : null,
        }).select().single()
        if (pe) throw pe
        product = { ...data, variants: [] }
        createdNew = true
      }

      let variant = product.variants.find((v) => norm(v.size) === norm(form.size) && norm(v.color) === norm(form.color))
      if (!variant) {
        const { data, error: ve } = await supabase.from('om_product_variants').insert({
          business_id: businessId, user_id: userId, product_id: product.id,
          size: form.size.trim() || null, color: form.color.trim() || null,
          price: Number(form.selling_price || 0), stock_quantity: 0,
        }).select().single()
        if (ve) throw ve
        variant = data
        createdNew = true
      }

      const { error: re } = await supabase.from('om_restocks').insert({
        business_id: businessId, user_id: userId,
        restock_date: form.restock_date, variant_id: variant.id,
        product_name_snapshot: product.name,
        size_snapshot: variant.size, color_snapshot: variant.color,
        quantity: qty, unit_cost: Number(form.unit_cost || 0),
        supplier: form.supplier.trim() || null,
        amount_paid: Number(form.amount_paid || 0),
        notes: form.notes || null,
      })
      if (re) throw re

      await adjustVariantStock(businessId, userId, variant.id, qty, 'restock')

      setMessage(
        createdNew && !Number(variant.price)
          ? `Saved, and stock updated. This was a new product/size, so it was created with a selling price of 0 — set the real price in the Products tab before selling it.`
          : 'Saved, and stock updated.'
      )
      setForm({ ...blank(), restock_date: form.restock_date, supplier: form.supplier })
      onChange()
    } catch (err) {
      const text = err.message || 'Something went wrong.'
      setError(/om_restocks/.test(text) ? 'The stock-in table is missing. Run supabase/schema_om_restocks.sql in Supabase first.' : text)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(r) {
    setEditingId(r.id)
    setEditForm({
      restock_date: r.restock_date, quantity: r.quantity, unit_cost: r.unit_cost,
      supplier: r.supplier || '', amount_paid: r.amount_paid, notes: r.notes || '',
    })
  }

  async function saveEdit(r) {
    const newQty = Number(editForm.quantity)
    if (!(newQty > 0)) return
    await supabase.from('om_restocks').update({
      restock_date: editForm.restock_date, quantity: newQty, unit_cost: Number(editForm.unit_cost || 0),
      supplier: editForm.supplier.trim() || null, amount_paid: Number(editForm.amount_paid || 0),
      notes: editForm.notes || null,
    }).eq('id', r.id)
    await adjustVariantStock(businessId, userId, r.variant_id, newQty - Number(r.quantity), 'adjustment')
    setEditingId(null)
    onChange()
  }

  async function markPaid(r) {
    await supabase.from('om_restocks').update({ amount_paid: r.total_cost }).eq('id', r.id)
    onChange()
  }

  async function handleDelete(r) {
    setBusy(true)
    await adjustVariantStock(businessId, userId, r.variant_id, -Number(r.quantity), 'adjustment')
    await supabase.from('om_restocks').delete().eq('id', r.id)
    setBusy(false)
    setDeleteId(null)
    onChange()
  }

  const label = (r) =>
    `${r.product_name_snapshot}${r.size_snapshot || r.color_snapshot ? ` (${[r.size_snapshot, r.color_snapshot].filter(Boolean).join(' / ')})` : ''}`

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          ['Spent on stock', totals.spent, 'worth'],
          ['Paid to suppliers', totals.paid, 'income'],
          ['Still owed', totals.owed, 'spend'],
        ].map(([l, v, c]) => (
          <div key={l} className="rounded-xl border-l-4 border border-line p-3"
            style={{ borderLeftColor: `var(--color-${c})`, background: `color-mix(in srgb, var(--color-${c}) 10%, var(--color-surface))` }}>
            <div className="text-xs text-muted mb-1">{l}</div>
            <div className="font-mono-nums text-base text-text font-medium">{money(v, currency)}</div>
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="rounded-xl border border-line bg-surface p-4 mb-6 grid gap-2 sm:grid-cols-2">
        <div className="sm:col-span-2 text-sm text-text font-medium">Log clothes you bought from a supplier</div>
        <input type="date" value={form.restock_date} onChange={(e) => setForm({ ...form, restock_date: e.target.value })} className={inputCls} />
        <input placeholder="Supplier (who you bought from)" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className={inputCls} />
        <div className="sm:col-span-2">
          <input placeholder="Product (e.g. Tie-dye joggers)" list="stockin-products" value={form.product_name}
            onChange={(e) => setForm({ ...form, product_name: e.target.value })} className={`${inputCls} w-full`} />
          <datalist id="stockin-products">
            {productsWithVariants.map((p) => <option key={p.id} value={p.name} />)}
          </datalist>
        </div>
        <input placeholder="Size (e.g. M, XL)" list="stockin-sizes" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} className={inputCls} />
        <datalist id="stockin-sizes">{sizeOptions.map((s) => <option key={s} value={s} />)}</datalist>
        <input placeholder="Color" list="stockin-colors" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className={inputCls} />
        <datalist id="stockin-colors">{colorOptions.map((c) => <option key={c} value={c} />)}</datalist>
        <input type="number" min="1" placeholder="Quantity bought" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={`${inputCls} font-mono-nums`} />
        <input type="number" step="0.01" placeholder="Cost per piece (GHS)" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} className={`${inputCls} font-mono-nums`} />
        <input type="number" step="0.01" placeholder="Amount paid to supplier so far" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: e.target.value })} className={`${inputCls} font-mono-nums`} />
        <input type="number" step="0.01" placeholder="Selling price (only if new size/product)" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} className={`${inputCls} font-mono-nums`} />
        <input placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={`${inputCls} sm:col-span-2`} />
        <div className="sm:col-span-2 text-xs text-muted font-mono-nums">
          Total cost {money(liveTotal, currency)} · paid {money(Number(form.amount_paid || 0), currency)} · <span style={{ color: liveOwed > 0.005 ? 'var(--color-spend)' : 'var(--color-income)' }}>
            {liveOwed > 0.005 ? `you still owe ${money(liveOwed, currency)}` : 'fully paid'}</span>
        </div>
        {error && <p className="text-sm text-spend sm:col-span-2">{error}</p>}
        {message && <p className="text-sm sm:col-span-2" style={{ color: 'var(--color-income)' }}>{message}</p>}
        <button type="submit" disabled={saving} className="sm:col-span-2 rounded-lg bg-worth text-ink text-sm font-medium py-2.5 disabled:opacity-50">
          {saving ? 'Saving…' : 'Log stock in'}
        </button>
        <p className="text-xs text-muted sm:col-span-2">Saving adds the quantity to that size/color's stock automatically. If the product or size doesn't exist yet, it's created for you.</p>
      </form>

      <div className="flex gap-1 mb-4 text-sm flex-wrap">
        {[['all', `All (${restocks.length})`], ['owed', `Supplier unpaid (${restocks.filter((r) => owedOf(r) > 0.005).length})`], ['paid', 'Fully paid']].map(([id, text]) => (
          <button key={id} onClick={() => setView(id)}
            className={`px-3 py-1.5 rounded-lg border transition-colors ${view === id ? 'bg-worth text-ink font-medium border-transparent' : 'border-line text-muted hover:text-text'}`}>
            {text}
          </button>
        ))}
      </div>

      {view === 'owed' && owedBySupplier.length > 0 && (
        <div className="rounded-lg border border-line bg-surface px-4 py-3 mb-4 text-sm space-y-1">
          {owedBySupplier.map((s) => (
            <div key={s.name} className="flex justify-between">
              <span className="text-text">{s.name}</span>
              <span className="font-mono-nums text-spend">{money(s.owed, currency)} owed</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {shown.map((r) => {
          const owed = owedOf(r)
          if (editingId === r.id) {
            return (
              <div key={r.id} className="rounded-lg border bg-surface p-3 grid gap-2 sm:grid-cols-2" style={{ borderColor: 'var(--color-worth)' }}>
                <div className="sm:col-span-2 text-sm text-text">{label(r)}</div>
                <input type="date" value={editForm.restock_date} onChange={(e) => setEditForm({ ...editForm, restock_date: e.target.value })} className={inputCls} />
                <input placeholder="Supplier" value={editForm.supplier} onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })} className={inputCls} />
                <input type="number" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} placeholder="Quantity" className={`${inputCls} font-mono-nums`} />
                <input type="number" step="0.01" value={editForm.unit_cost} onChange={(e) => setEditForm({ ...editForm, unit_cost: e.target.value })} placeholder="Cost per piece" className={`${inputCls} font-mono-nums`} />
                <input type="number" step="0.01" value={editForm.amount_paid} onChange={(e) => setEditForm({ ...editForm, amount_paid: e.target.value })} placeholder="Paid to supplier" className={`${inputCls} font-mono-nums`} />
                <input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Notes" className={inputCls} />
                <p className="text-xs text-muted sm:col-span-2">Changing the quantity adjusts your stock by the difference. Wrong product or size? Delete this entry and log it again.</p>
                <div className="sm:col-span-2 flex gap-2">
                  <button onClick={() => saveEdit(r)} className="rounded-lg bg-worth text-ink text-xs font-medium px-3 py-1.5">Save</button>
                  <button onClick={() => setEditingId(null)} className="rounded-lg border border-line text-muted text-xs px-3 py-1.5">Cancel</button>
                </div>
              </div>
            )
          }
          return (
            <div key={r.id} className="rounded-lg border border-line bg-surface px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-text truncate">{r.quantity} × {label(r)}</div>
                  <div className="text-xs text-muted">{formatOrderDate(r.restock_date)}{r.supplier ? ` · ${r.supplier}` : ''}{r.notes ? ` · ${r.notes}` : ''}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono-nums text-sm text-text">{money(r.amount_paid, currency)} / {money(r.total_cost, currency)}</div>
                  <div className="text-xs" style={{ color: owed > 0.005 ? 'var(--color-spend)' : 'var(--color-income)' }}>
                    {owed > 0.005 ? `you owe ${money(owed, currency)}` : 'supplier paid'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs">
                {owed > 0.005 && <button onClick={() => markPaid(r)} className="font-medium" style={{ color: 'var(--color-income)' }}>Mark supplier paid</button>}
                <button onClick={() => startEdit(r)} className="text-muted hover:text-text">Edit</button>
                <button onClick={() => setDeleteId(r.id)} className="text-muted hover:text-spend">Delete</button>
              </div>
              {deleteId === r.id && (
                <div className="mt-2 rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: 'var(--color-spend)', background: 'color-mix(in srgb, var(--color-spend) 10%, var(--color-surface))' }}>
                  <div className="text-text mb-2">Delete this entry? Your stock for this item goes down by {r.quantity}.</div>
                  <div className="flex gap-2">
                    <button disabled={busy} onClick={() => handleDelete(r)} className="rounded-lg bg-spend text-ink text-xs font-medium px-3 py-1.5 disabled:opacity-50">{busy ? 'Deleting…' : 'Yes, delete'}</button>
                    <button onClick={() => setDeleteId(null)} className="rounded-lg border border-line text-muted text-xs px-3 py-1.5">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {shown.length === 0 && <p className="text-sm text-muted">Nothing here yet.</p>}
      </div>
    </div>
  )
}
