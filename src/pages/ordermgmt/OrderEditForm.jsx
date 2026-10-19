import { useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { money, logAudit, adjustVariantStock, insertOrderItems } from '../../lib/orderMgmt'

const inputCls = 'rounded-lg bg-surface-2 border border-line px-2 py-2 text-sm text-text outline-none focus:border-worth'

// Updates one order item. If the optional profit column isn't in the database yet,
// retries without it so editing never breaks.
async function updateItem(id, fields) {
  const res = await supabase.from('om_order_items').update(fields).eq('id', id)
  if (res.error && /unit_cost_snapshot/.test(res.error.message || '')) {
    const { unit_cost_snapshot: _drop, ...rest } = fields
    return supabase.from('om_order_items').update(rest).eq('id', id)
  }
  return res
}

export default function OrderEditForm({
  order, customers, productsWithVariants, deliveryMethods, costFor, businessId, userId, currency, onSaved, onCancel,
}) {
  const [customerId, setCustomerId] = useState(order.customer_id || '')
  const [deliveryMethodId, setDeliveryMethodId] = useState(order.delivery_method_id || '')
  const [deliveryFee, setDeliveryFee] = useState(String(order.delivery_fee ?? 0))
  const [discount, setDiscount] = useState(String(order.discount ?? 0))
  const [notes, setNotes] = useState(order.notes || '')
  const [lines, setLines] = useState(
    order.items.map((it) => ({
      id: it.id,
      orphan: !it.variant_id, // the product/size it was bought under has since been deleted
      product_id: it.product_id || '',
      variant_id: it.variant_id || '',
      quantity: it.quantity,
      unit_price: it.unit_price_snapshot,
      name: it.product_name_snapshot,
      size: it.size_snapshot,
      color: it.color_snapshot,
      unit_cost: it.unit_cost_snapshot ?? null,
    }))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + Number(l.unit_price || 0) * Number(l.quantity || 0), 0),
    [lines]
  )
  const total = subtotal + Number(deliveryFee || 0) - Number(discount || 0)

  const patchLine = (i, patch) => setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  function chooseProduct(i, productId) {
    const p = productsWithVariants.find((x) => x.id === productId)
    patchLine(i, { product_id: productId, variant_id: '', name: p?.name || '', size: null, color: null })
  }

  function chooseVariant(i, variantId) {
    const p = productsWithVariants.find((x) => x.id === lines[i].product_id)
    const v = p?.variants.find((x) => x.id === variantId)
    if (!v) return patchLine(i, { variant_id: '' })
    patchLine(i, {
      variant_id: variantId, name: p.name, size: v.size, color: v.color,
      unit_price: v.price, unit_cost: costFor(variantId),
    })
  }

  function handleDeliveryMethod(id) {
    setDeliveryMethodId(id)
    const m = deliveryMethods.find((x) => x.id === id)
    if (m) setDeliveryFee(String(m.fee))
  }

  async function handleSave() {
    setError('')
    if (lines.length === 0) return setError('An order needs at least one item. To remove the whole order, cancel it instead.')
    for (const l of lines) {
      if (!l.orphan && !l.variant_id) return setError('Pick a product and size/color for every line, or remove the line.')
      if (!(Number(l.quantity) > 0)) return setError('Every line needs a quantity of at least 1.')
      if (Number(l.unit_price) < 0) return setError('Prices cannot be negative.')
    }
    if (total < 0) return setError('The discount is bigger than the order.')

    setSaving(true)
    try {
      const keptIds = new Set(lines.filter((l) => l.id).map((l) => l.id))
      for (const it of order.items) {
        if (!keptIds.has(it.id)) {
          const { error: de } = await supabase.from('om_order_items').delete().eq('id', it.id)
          if (de) throw de
        }
      }

      const newRows = []
      for (const l of lines) {
        const fields = {
          product_id: l.product_id || null,
          variant_id: l.variant_id || null,
          product_name_snapshot: l.name,
          size_snapshot: l.size || null,
          color_snapshot: l.color || null,
          unit_price_snapshot: Number(l.unit_price),
          quantity: Number(l.quantity),
          line_total: Number(l.unit_price) * Number(l.quantity),
          unit_cost_snapshot: l.unit_cost,
        }
        if (l.id) {
          const { error: ue } = await updateItem(l.id, fields)
          if (ue) throw ue
        } else {
          newRows.push({ order_id: order.id, business_id: businessId, user_id: userId, ...fields })
        }
      }
      if (newRows.length) {
        const { error: ie } = await insertOrderItems(newRows)
        if (ie) throw ie
      }

      // If stock was already taken off the shelf for this order, keep it in step with the edit.
      if (order.stock_deducted) {
        const oldQty = new Map()
        for (const it of order.items) if (it.variant_id) oldQty.set(it.variant_id, (oldQty.get(it.variant_id) || 0) + Number(it.quantity))
        const newQty = new Map()
        for (const l of lines) if (l.variant_id) newQty.set(l.variant_id, (newQty.get(l.variant_id) || 0) + Number(l.quantity))
        for (const vid of new Set([...oldQty.keys(), ...newQty.keys()])) {
          const delta = (newQty.get(vid) || 0) - (oldQty.get(vid) || 0)
          if (delta !== 0) await adjustVariantStock(businessId, userId, vid, -delta, 'order_edit', order.id)
        }
      }

      const { error: oe } = await supabase.from('om_orders').update({
        customer_id: customerId || null,
        delivery_method_id: deliveryMethodId || null,
        delivery_fee: Number(deliveryFee || 0),
        discount: Number(discount || 0),
        notes: notes || null,
        subtotal,
        total,
        updated_at: new Date().toISOString(),
      }).eq('id', order.id)
      if (oe) throw oe

      await logAudit(
        businessId, userId, order.id, 'Order edited',
        { total: Number(order.total), subtotal: Number(order.subtotal), items: order.items.length },
        { total, subtotal, items: lines.length }
      )
      onSaved()
    } catch (err) {
      setError(err.message || 'Something went wrong saving the changes.')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-text font-medium">Editing {order.order_number}</div>
      <p className="text-xs text-muted">
        Lines you don't touch keep the price they were sold at, even if the product's price has changed since. Changing a line's size/color re-prices that line at today's price (you can still type a different price).
        {order.stock_deducted ? ' Stock has already been deducted for this order, so changing quantities will adjust your stock to match.' : ''}
      </p>

      <div>
        <label className="block text-xs text-muted mb-1">Customer</label>
        <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={`${inputCls} w-full`}>
          <option value="">No customer</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>)}
        </select>
      </div>

      <div className="space-y-3">
        {lines.map((l, i) => {
          const product = productsWithVariants.find((p) => p.id === l.product_id)
          return (
            <div key={l.id || `new-${i}`} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end rounded-lg border border-line p-2">
              {l.orphan ? (
                <div className="col-span-2 sm:col-span-3 text-sm text-muted self-center">
                  {l.name}{(l.size || l.color) ? ` (${[l.size, l.color].filter(Boolean).join('/')})` : ''}
                  <span className="text-xs"> — no longer in your product list</span>
                </div>
              ) : (
                <>
                  <select value={l.product_id} onChange={(e) => chooseProduct(i, e.target.value)} className={`${inputCls} sm:col-span-2`}>
                    <option value="">Product…</option>
                    {productsWithVariants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <select value={l.variant_id} onChange={(e) => chooseVariant(i, e.target.value)} disabled={!product} className={`${inputCls} sm:col-span-1 disabled:opacity-50`}>
                    <option value="">Size / color…</option>
                    {product?.variants.map((v) => (
                      <option key={v.id} value={v.id}>{[v.size, v.color].filter(Boolean).join(' / ') || 'Default'} ({v.stock_quantity} in stock)</option>
                    ))}
                  </select>
                </>
              )}
              <input type="number" min="1" value={l.quantity} onChange={(e) => patchLine(i, { quantity: e.target.value })} className={`${inputCls} font-mono-nums`} placeholder="Qty" />
              <input type="number" step="0.01" value={l.unit_price} onChange={(e) => patchLine(i, { unit_price: e.target.value })} className={`${inputCls} font-mono-nums`} placeholder="Unit price" />
              <div className="col-span-2 sm:col-span-6 flex items-center justify-between">
                <span className="text-xs text-muted font-mono-nums">= {money(Number(l.unit_price || 0) * Number(l.quantity || 0), currency)}</span>
                <button type="button" onClick={() => setLines(lines.filter((_, idx) => idx !== i))} className="text-xs text-muted hover:text-spend flex items-center gap-1">
                  <Trash2 size={12} /> Remove
                </button>
              </div>
            </div>
          )
        })}
        <button type="button"
          onClick={() => setLines([...lines, { id: null, orphan: false, product_id: '', variant_id: '', quantity: 1, unit_price: 0, name: '', size: null, color: null, unit_cost: null }])}
          className="text-xs text-worth hover:opacity-80">
          + Add another product
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <label className="block text-xs text-muted mb-1">Delivery method</label>
          <select value={deliveryMethodId} onChange={(e) => handleDeliveryMethod(e.target.value)} className={`${inputCls} w-full`}>
            <option value="">None</option>
            {deliveryMethods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Delivery fee</label>
          <input type="number" step="0.01" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} className={`${inputCls} w-full font-mono-nums`} />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Discount</label>
          <input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className={`${inputCls} w-full font-mono-nums`} />
        </div>
        <div className="sm:col-span-3">
          <label className="block text-xs text-muted mb-1">Notes</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} w-full`} />
        </div>
      </div>

      <div className="rounded-lg bg-surface-2 px-3 py-2 text-sm space-y-0.5">
        <div className="flex justify-between text-muted"><span>New subtotal</span><span className="font-mono-nums">{money(subtotal, currency)}</span></div>
        <div className="flex justify-between text-text font-medium"><span>New total</span><span className="font-mono-nums">{money(total, currency)}</span></div>
        {Math.abs(total - Number(order.total)) > 0.005 && (
          <div className="text-xs text-muted">Was {money(order.total, currency)}. Payments already linked to this order stay as they are, so its balance will update automatically.</div>
        )}
      </div>

      {error && <p className="text-sm text-spend">{error}</p>}
      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving} className="rounded-lg bg-worth text-ink text-sm font-medium px-4 py-2 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button onClick={onCancel} disabled={saving} className="rounded-lg border border-line text-sm text-muted px-4 py-2">Cancel</button>
      </div>
    </div>
  )
}
