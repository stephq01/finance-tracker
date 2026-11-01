// Works out, for every product, which restock ("batch") each sale came out of.
//
// Rules (also explained to the user in the app):
//  1. A sale where you picked a specific restock takes from that restock first.
//  2. Every other sale takes from the OLDEST restock that still has stock left
//     (first in, first out), going on to the next restock if the oldest runs out.
//  3. Anything sold beyond what was restocked is "oversold" and has no batch.
// Nothing here is saved in the database: it is recalculated from restocks + sales
// every time, so editing or deleting a record always keeps the numbers consistent.

const num = (v) => Number(v) || 0

function cmp(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  const ac = a.created_at || ''
  const bc = b.created_at || ''
  return ac < bc ? -1 : ac > bc ? 1 : 0
}

export function allocateSales(products, restocks, sales) {
  const batches = new Map() // restock id -> batch info
  const slices = [] // one row per (sale, batch) pairing
  const oversold = new Map() // product id -> units sold beyond what was restocked

  for (const r of restocks) {
    const qty = num(r.quantity)
    const total = r.cost_amount == null ? null : num(r.cost_amount)
    batches.set(r.id, {
      ...r,
      n: 0,
      qty,
      totalCost: total,
      unitCost: total != null && qty > 0 ? total / qty : null,
      sold: 0,
      left: qty,
      revenue: 0, // charged, for the units sold out of this batch
      collected: 0,
      cost: 0, // cost of the units sold out of this batch (only when cost is known)
      slices: [],
    })
  }

  for (const p of products) {
    const pb = restocks
      .filter((r) => r.product_id === p.id)
      .sort(cmp)
      .map((r) => batches.get(r.id))
    pb.forEach((b, i) => { b.n = i + 1 })

    const ps = sales.filter((s) => s.product_id === p.id && num(s.quantity) > 0).sort(cmp)
    const need = new Map(ps.map((s) => [s.id, num(s.quantity)]))

    const take = (s, b, q) => {
      const saleQty = num(s.quantity)
      const slice = {
        saleId: s.id,
        sale: s,
        batchId: b.id,
        productId: p.id,
        date: s.date,
        qty: q,
        revenue: (num(s.amount_charged) * q) / saleQty,
        collected: (num(s.amount_paid) * q) / saleQty,
        cost: b.unitCost == null ? null : b.unitCost * q,
      }
      b.left -= q
      b.sold += q
      b.revenue += slice.revenue
      b.collected += slice.collected
      if (slice.cost != null) b.cost += slice.cost
      b.slices.push(slice)
      slices.push(slice)
      need.set(s.id, need.get(s.id) - q)
    }

    // 1) sales where a specific restock was chosen
    for (const s of ps) {
      const b = s.restock_id ? pb.find((x) => x.id === s.restock_id) : null
      if (!b) continue
      const q = Math.min(need.get(s.id), Math.max(b.left, 0))
      if (q > 0) take(s, b, q)
    }

    // 2) everything else (and anything that didn't fit in the chosen restock): oldest first
    for (const s of ps) {
      for (const b of pb) {
        const n = need.get(s.id)
        if (n <= 0) break
        if (b.left <= 0) continue
        take(s, b, Math.min(n, b.left))
      }
      const rest = need.get(s.id)
      if (rest > 0) oversold.set(p.id, (oversold.get(p.id) || 0) + rest)
    }
  }

  return { batches, slices, oversold }
}

// ---------- date helpers for the Revenue / Profit period picker ----------
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const PERIODS = [
  { id: 'all', label: 'All time' },
  { id: 'week', label: 'Last 7 days' },
  { id: 'month', label: 'This month' },
  { id: 'lastmonth', label: 'Last month' },
]

// returns [from, to] as 'YYYY-MM-DD' strings (inclusive), or null for no limit
export function periodRange(id) {
  const now = new Date()
  if (id === 'week') {
    const from = new Date(now)
    from.setDate(from.getDate() - 6)
    return [fmt(from), fmt(now)]
  }
  if (id === 'month') return [fmt(new Date(now.getFullYear(), now.getMonth(), 1)), fmt(now)]
  if (id === 'lastmonth') {
    return [fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1)), fmt(new Date(now.getFullYear(), now.getMonth(), 0))]
  }
  return [null, null]
}

export function inPeriod(date, [from, to]) {
  if (from && date < from) return false
  if (to && date > to) return false
  return true
}
