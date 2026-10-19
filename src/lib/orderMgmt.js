// Shared helpers + defaults for the Order Management business module.
import { supabase } from './supabaseClient'

export const money = (n, currency = 'GHS') =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n || 0)

// Seeded once when a business is switched into order_management mode.
// All of this is editable afterwards from Settings — nothing here is hard-coded
// into the workflow itself, these are just sensible starting values.
export const DEFAULT_STATUSES = [
  { name: 'Draft', sort_order: 0, is_default: true },
  { name: 'Awaiting Payment', sort_order: 1 },
  { name: 'Partially Paid', sort_order: 2 },
  { name: 'Paid', sort_order: 3 },
  { name: 'Processing', sort_order: 4, deducts_stock: true },
  { name: 'Ready for Delivery', sort_order: 5 },
  { name: 'Out for Delivery', sort_order: 6 },
  { name: 'Delivered', sort_order: 7 },
  { name: 'Cancelled', sort_order: 8, restores_stock: true },
  { name: 'Refunded', sort_order: 9, restores_stock: true },
]

export const DEFAULT_PAYMENT_METHODS = ['MoMo', 'Bank Transfer', 'Cash', 'Other']

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Packaging', 'Delivery', 'Transportation', 'Advertising',
  'Content creation', 'Product purchase', 'Supplier payment',
  'Platform fees', 'Miscellaneous',
]

export async function seedOrderManagementDefaults(businessId, userId) {
  await supabase.from('om_order_statuses').insert(
    DEFAULT_STATUSES.map((s) => ({ business_id: businessId, user_id: userId, ...s }))
  )
  await supabase.from('om_payment_methods').insert(
    DEFAULT_PAYMENT_METHODS.map((name, i) => ({ business_id: businessId, user_id: userId, name, sort_order: i }))
  )
  await supabase.from('om_expense_categories').insert(
    DEFAULT_EXPENSE_CATEGORIES.map((name, i) => ({ business_id: businessId, user_id: userId, name, sort_order: i }))
  )
  await supabase.from('om_delivery_methods').insert([
    { business_id: businessId, user_id: userId, name: 'Pickup', fee: 0, sort_order: 0 },
    { business_id: businessId, user_id: userId, name: 'Standard delivery', fee: 0, sort_order: 1 },
  ])
  const prefix = 'CC'
  await supabase.from('om_settings').insert({ business_id: businessId, user_id: userId, order_id_prefix: prefix })
}

// Payment status is always computed live from linked payments vs the order
// total — never stored — so it can never drift out of sync.
export function paymentStatus(order, paymentsForOrder) {
  const paid = (paymentsForOrder || []).reduce((s, p) => s + Number(p.amount), 0)
  const total = Number(order.total || 0)
  const balance = total - paid
  if (paid <= 0) return { label: 'Unpaid', paid, balance, color: 'spend' }
  if (balance > 0.005) return { label: 'Partially Paid', paid, balance, color: 'budget' }
  if (balance < -0.005) return { label: 'Overpaid', paid, balance: 0, overpaid: -balance, color: 'invest' }
  return { label: 'Paid', paid, balance: 0, color: 'income' }
}

export async function logAudit(businessId, userId, orderId, action, previousValue, newValue) {
  await supabase.from('om_audit_log').insert({
    business_id: businessId,
    user_id: userId,
    order_id: orderId || null,
    action,
    previous_value: previousValue ?? null,
    new_value: newValue ?? null,
  })
}

export function formatOrderDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// ---------- stock + cost helpers shared by several screens ----------

// Reads the current stock from the database (not from screen state) so two quick
// changes in a row can never overwrite each other with a stale number.
export async function adjustVariantStock(businessId, userId, variantId, delta, reason, orderId = null) {
  if (!variantId || !delta) return
  const { data: v } = await supabase.from('om_product_variants').select('stock_quantity').eq('id', variantId).single()
  if (!v) return
  await supabase.from('om_product_variants').update({ stock_quantity: Number(v.stock_quantity) + delta }).eq('id', variantId)
  await supabase.from('om_inventory_transactions').insert({
    business_id: businessId, user_id: userId, variant_id: variantId, order_id: orderId, change_qty: delta, reason,
  })
}

// Best estimate of what one piece of a variant costs you: the quantity-weighted
// average of what you actually paid in Stock in, else the product's cost price,
// else null (unknown — never silently treated as a real number).
export function buildCostLookup(restocks, products, variants) {
  const byVariant = new Map()
  for (const r of restocks || []) {
    if (!r.variant_id) continue
    const a = byVariant.get(r.variant_id) || { qty: 0, cost: 0 }
    a.qty += Number(r.quantity)
    a.cost += Number(r.quantity) * Number(r.unit_cost)
    byVariant.set(r.variant_id, a)
  }
  return (variantId) => {
    const a = byVariant.get(variantId)
    if (a && a.qty > 0) return a.cost / a.qty
    const v = (variants || []).find((x) => x.id === variantId)
    const p = v && (products || []).find((x) => x.id === v.product_id)
    return p?.cost_price != null ? Number(p.cost_price) : null
  }
}

// Inserts order items. If the optional profit column hasn't been added to the
// database yet (schema_om_profit.sql not run), retries without it so ordering
// never breaks.
export async function insertOrderItems(items) {
  const res = await supabase.from('om_order_items').insert(items)
  if (res.error && /unit_cost_snapshot/.test(res.error.message || '')) {
    return supabase.from('om_order_items').insert(items.map(({ unit_cost_snapshot: _drop, ...rest }) => rest))
  }
  return res
}
