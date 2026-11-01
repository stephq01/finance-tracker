import { useMemo, useState } from 'react'
import { PERIODS, periodRange, inPeriod } from '../lib/stockBatches'

const money = (n) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'GHS' }).format(n || 0)

const num = (v) => Number(v) || 0
const owedOf = (s) => Math.max(0, num(s.amount_charged) - num(s.amount_paid))
const methodLabel = { momo: 'MoMo', telecash: 'Telecash', cash: 'Physical cash', other: 'Other' }

function Tile({ label, value, sub, tone }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-xs text-muted mb-1">{label}</div>
      <div className="font-mono-nums text-xl font-medium" style={{ color: tone ? `var(--color-${tone})` : 'var(--color-text)' }}>{value}</div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </div>
  )
}

function Notice({ children }) {
  return (
    <div className="rounded-lg border px-4 py-3 text-sm text-text"
      style={{ borderColor: 'var(--color-budget)', background: 'color-mix(in srgb, var(--color-budget) 12%, var(--color-surface))' }}>
      {children}
    </div>
  )
}

function PeriodPicker({ value, onChange, color }) {
  return (
    <div className="flex gap-1 text-sm flex-wrap">
      {PERIODS.map((p) => (
        <button key={p.id} onClick={() => onChange(p.id)}
          className={`px-3 py-1.5 rounded-lg border transition-colors ${value === p.id ? 'text-ink font-medium border-transparent' : 'border-line text-muted hover:text-text'}`}
          style={value === p.id ? { background: `var(--color-${color})` } : undefined}>
          {p.label}
        </button>
      ))}
    </div>
  )
}

function Table({ head, rows, foot }) {
  return (
    <div className="rounded-xl border border-line bg-surface overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted text-left">
            {head.map((h, i) => <th key={h} className={`px-3 py-2 font-normal ${i > 0 ? 'text-right' : ''}`}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-t border-line">
              {r.map((c, i) => <td key={i} className={`px-3 py-2 ${i > 0 ? 'text-right font-mono-nums' : 'text-text'}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot>
            <tr className="border-t border-line text-text font-medium">
              {foot.map((c, i) => <td key={i} className={`px-3 py-2 ${i > 0 ? 'text-right font-mono-nums' : ''}`}>{c}</td>)}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

// ---------------- Batches tab ----------------
export function BatchesTab({ color, products, restocks, sales, batchData }) {
  const [openSales, setOpenSales] = useState({})
  const [showFinished, setShowFinished] = useState({})

  if (products.length === 0) return <p className="text-sm text-muted">Add a product on the Stock tab first, then log a restock — each restock appears here as its own batch.</p>

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted">
        Every restock is its own batch. A sale comes out of the batch you pick when logging it; if you leave it on "automatic" it comes out of the oldest batch that still has stock.
      </p>
      {products.map((p) => {
        const mine = restocks.filter((r) => r.product_id === p.id).map((r) => batchData.batches.get(r.id)).filter(Boolean)
        const newestFirst = [...mine].sort((a, b) => b.n - a.n)
        const active = newestFirst.filter((b) => b.left > 0)
        const finished = newestFirst.filter((b) => b.left <= 0)
        const over = batchData.oversold.get(p.id) || 0
        const unlinked = sales.filter((s) => s.product_id === p.id && !(num(s.quantity) > 0)).length
        const totalLeft = mine.reduce((sum, b) => sum + b.left, 0) - over

        const card = (b) => {
          const pct = b.qty > 0 ? Math.min(100, Math.round((b.sold / b.qty) * 100)) : 0
          const profit = b.unitCost != null ? b.revenue - b.cost : null
          return (
            <div key={b.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="text-sm text-text font-medium">Batch {b.n} · restocked {b.date}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {b.totalCost != null
                      ? <>cost {money(b.totalCost)} in total{b.unitCost != null ? ` (${money(b.unitCost)} each)` : ''}</>
                      : <span style={{ color: 'var(--color-budget)' }}>no cost entered — edit this restock on the Stock tab to add it</span>}
                    {' · '}
                    <span style={{ color: b.supplier_paid ? 'var(--color-income)' : 'var(--color-spend)' }}>{b.supplier_paid ? 'supplier paid' : 'supplier unpaid'}</span>
                    {b.notes ? ` · ${b.notes}` : ''}
                  </div>
                </div>
                <span className="text-[10px] px-2 py-1 rounded-full text-ink font-medium" style={{ background: b.left > 0 ? `var(--color-${color})` : 'var(--color-muted)' }}>
                  {b.left > 0 ? `${b.left} left` : 'sold out'}
                </span>
              </div>

              <div className="mt-3 h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `var(--color-${color})` }} />
              </div>
              <div className="flex justify-between text-xs text-muted mt-1.5">
                <span>bought {b.qty}</span><span>sold {b.sold}</span><span>left {Math.max(b.left, 0)}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                <div><div className="text-muted">Revenue so far</div><div className="font-mono-nums text-text text-sm">{money(b.revenue)}</div></div>
                <div><div className="text-muted">Collected</div><div className="font-mono-nums text-sm" style={{ color: 'var(--color-income)' }}>{money(b.collected)}</div></div>
                <div><div className="text-muted">Profit so far</div>
                  <div className="font-mono-nums text-sm" style={{ color: profit == null ? 'var(--color-muted)' : profit >= 0 ? 'var(--color-income)' : 'var(--color-spend)' }}>
                    {profit == null ? 'cost unknown' : money(profit)}
                  </div>
                </div>
              </div>

              {b.slices.length > 0 && (
                <div className="mt-3 pt-3 border-t border-line">
                  <button onClick={() => setOpenSales({ ...openSales, [b.id]: !openSales[b.id] })} className="text-xs text-muted hover:text-text">
                    {openSales[b.id] ? 'Hide' : 'Show'} sales from this batch ({b.slices.length})
                  </button>
                  {openSales[b.id] && (
                    <div className="mt-2 space-y-1.5">
                      {[...b.slices].sort((x, y) => (x.date < y.date ? 1 : -1)).map((sl, i) => (
                        <div key={`${sl.saleId}-${i}`} className="flex justify-between text-xs gap-2">
                          <span className="text-muted min-w-0 truncate">{sl.date} · {sl.sale.customer_name} · qty {sl.qty}{sl.qty !== num(sl.sale.quantity) ? ` of ${sl.sale.quantity}` : ''}</span>
                          <span className="font-mono-nums text-text shrink-0">{money(sl.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        }

        return (
          <div key={p.id} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-lg text-text">{p.name}</h2>
              <span className="text-sm text-muted">{totalLeft} in stock across {active.length} active batch{active.length === 1 ? '' : 'es'}</span>
            </div>
            {over > 0 && <Notice>You've logged {over} more sold than you restocked for {p.name}. Either a restock is missing, or a sale has the wrong quantity or product.</Notice>}
            {unlinked > 0 && <Notice>{unlinked} sale{unlinked === 1 ? '' : 's'} of {p.name} {unlinked === 1 ? 'has' : 'have'} no quantity, so can't be counted against a batch. Fix on the Sales tab.</Notice>}
            {mine.length === 0 && <p className="text-sm text-muted">No restocks logged yet. Use "+ Restock" on the Stock tab.</p>}
            {active.map(card)}
            {finished.length > 0 && (
              <>
                <button onClick={() => setShowFinished({ ...showFinished, [p.id]: !showFinished[p.id] })} className="text-xs text-muted hover:text-text">
                  {showFinished[p.id] ? 'Hide' : 'Show'} finished batches ({finished.length})
                </button>
                {showFinished[p.id] && finished.map(card)}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------- Revenue tab ----------------
export function RevenueTab({ color, products, productStats, sales }) {
  const [period, setPeriod] = useState('all')
  const range = useMemo(() => periodRange(period), [period])
  const inRange = useMemo(() => sales.filter((s) => inPeriod(s.date, range)), [sales, range])

  const charged = inRange.reduce((sum, s) => sum + num(s.amount_charged), 0)
  const collected = inRange.reduce((sum, s) => sum + num(s.amount_paid), 0)
  const owed = inRange.reduce((sum, s) => sum + owedOf(s), 0)

  const byMethod = useMemo(() => {
    const m = new Map()
    for (const s of inRange) m.set(s.payment_method || 'other', (m.get(s.payment_method || 'other') || 0) + num(s.amount_paid))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [inRange])

  // average price per unit uses ALL sales so the estimate doesn't swing with the period picker
  const rows = useMemo(() => {
    const list = products.map((p) => {
      const mine = inRange.filter((s) => s.product_id === p.id)
      const allMine = sales.filter((s) => s.product_id === p.id && num(s.quantity) > 0)
      const allQty = allMine.reduce((sum, s) => sum + num(s.quantity), 0)
      const allCharged = allMine.reduce((sum, s) => sum + num(s.amount_charged), 0)
      const avg = allQty > 0 ? allCharged / allQty : null
      const stock = productStats.find((x) => x.id === p.id)?.stock ?? 0
      return {
        id: p.id, name: p.name,
        units: mine.reduce((sum, s) => sum + num(s.quantity), 0),
        charged: mine.reduce((sum, s) => sum + num(s.amount_charged), 0),
        collected: mine.reduce((sum, s) => sum + num(s.amount_paid), 0),
        avg, stock, potential: avg != null && stock > 0 ? avg * stock : 0,
      }
    })
    const none = inRange.filter((s) => !s.product_id)
    if (none.length) {
      list.push({
        id: 'none', name: 'No product chosen', units: none.reduce((sum, s) => sum + num(s.quantity), 0),
        charged: none.reduce((sum, s) => sum + num(s.amount_charged), 0),
        collected: none.reduce((sum, s) => sum + num(s.amount_paid), 0), avg: null, stock: 0, potential: 0,
      })
    }
    return list
  }, [products, inRange, sales, productStats])

  const potentialTotal = rows.reduce((sum, r) => sum + r.potential, 0)

  const byMonth = useMemo(() => {
    const m = new Map()
    for (const s of sales) {
      const k = (s.date || '').slice(0, 7)
      const a = m.get(k) || { charged: 0, collected: 0 }
      a.charged += num(s.amount_charged)
      a.collected += num(s.amount_paid)
      m.set(k, a)
    }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [sales])

  return (
    <div className="space-y-5">
      <PeriodPicker value={period} onChange={setPeriod} color={color} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Revenue (what you charged)" value={money(charged)} sub={`${inRange.length} sale${inRange.length === 1 ? '' : 's'}`} />
        <Tile label="Collected so far" value={money(collected)} tone="income" sub="money actually received" />
        <Tile label="Still owed to you" value={money(owed)} tone="spend" sub="charged but not yet paid" />
      </div>
      <p className="text-xs text-muted">Revenue is everything you charged, before taking off what the stock cost you. For profit, see the Profit tab.</p>

      <div>
        <h3 className="text-sm text-text font-medium mb-2">Received by payment method</h3>
        {byMethod.length === 0 ? <p className="text-sm text-muted">No sales in this period.</p> : (
          <Table head={['Method', 'Collected']} rows={byMethod.map(([k, v]) => [methodLabel[k] || k, money(v)])} foot={['Total', money(collected)]} />
        )}
      </div>

      <div>
        <h3 className="text-sm text-text font-medium mb-2">By product</h3>
        <Table
          head={['Product', 'Units', 'Charged', 'Collected']}
          rows={rows.map((r) => [r.name, r.units, money(r.charged), money(r.collected)])}
          foot={['Total', rows.reduce((s, r) => s + r.units, 0), money(rows.reduce((s, r) => s + r.charged, 0)), money(rows.reduce((s, r) => s + r.collected, 0))]}
        />
      </div>

      <div>
        <h3 className="text-sm text-text font-medium mb-2">Still to come from stock you have now <span className="text-xs text-muted font-normal">(estimate)</span></h3>
        <Table
          head={['Product', 'In stock', 'Avg price each', 'Estimated']}
          rows={rows.filter((r) => r.id !== 'none').map((r) => [r.name, r.stock, r.avg != null ? money(r.avg) : '—', r.avg != null ? money(r.potential) : 'no sales yet'])}
          foot={['Total', '', '', money(potentialTotal)]}
        />
        <p className="text-xs text-muted mt-1.5">Estimate only: your stock count × the average price you've charged so far for that product. Actual revenue depends on what you really sell it for.</p>
      </div>

      <div>
        <h3 className="text-sm text-text font-medium mb-2">By month <span className="text-xs text-muted font-normal">(all time)</span></h3>
        {byMonth.length === 0 ? <p className="text-sm text-muted">No sales yet.</p> : (
          <Table head={['Month', 'Charged', 'Collected']} rows={byMonth.map(([k, v]) => [k, money(v.charged), money(v.collected)])} />
        )}
      </div>
    </div>
  )
}

// ---------------- Profit tab ----------------
export function ProfitTab({ color, products, restocks, sales, batchData }) {
  const [period, setPeriod] = useState('all')
  const range = useMemo(() => periodRange(period), [period])

  const slices = useMemo(() => batchData.slices.filter((s) => inPeriod(s.date, range)), [batchData, range])
  const costed = slices.filter((s) => s.cost != null)
  const uncostedUnits = slices.filter((s) => s.cost == null).reduce((sum, s) => sum + s.qty, 0)

  const revenue = costed.reduce((sum, s) => sum + s.revenue, 0)
  const cogs = costed.reduce((sum, s) => sum + s.cost, 0)
  const profit = revenue - cogs
  const margin = revenue > 0 ? (profit / revenue) * 100 : null

  const inRange = sales.filter((s) => inPeriod(s.date, range))
  const noProduct = inRange.filter((s) => !s.product_id || !(num(s.quantity) > 0))
  const noProductAmount = noProduct.reduce((sum, s) => sum + num(s.amount_charged), 0)
  const overUnits = [...batchData.oversold.values()].reduce((a, b) => a + b, 0)

  const byProduct = products.map((p) => {
    const mine = costed.filter((s) => s.productId === p.id)
    const rev = mine.reduce((sum, s) => sum + s.revenue, 0)
    const cost = mine.reduce((sum, s) => sum + s.cost, 0)
    return { id: p.id, name: p.name, units: mine.reduce((sum, s) => sum + s.qty, 0), rev, cost, profit: rev - cost }
  }).filter((r) => r.units > 0)

  const byBatch = [...batchData.batches.values()].map((b) => {
    const mine = costed.filter((s) => s.batchId === b.id)
    const rev = mine.reduce((sum, s) => sum + s.revenue, 0)
    const cost = mine.reduce((sum, s) => sum + s.cost, 0)
    const p = products.find((x) => x.id === b.product_id)
    return { id: b.id, label: `${p?.name || 'Product'} · batch ${b.n} (${b.date})`, units: mine.reduce((sum, s) => sum + s.qty, 0), rev, cost, profit: rev - cost }
  }).filter((r) => r.units > 0).sort((a, b) => (a.label < b.label ? -1 : 1))

  // ----- cash check (always all time, ignores the period picker) -----
  const cashIn = sales.reduce((sum, s) => sum + num(s.amount_paid), 0)
  const inByMethod = new Map()
  for (const s of sales) inByMethod.set(s.payment_method || 'other', (inByMethod.get(s.payment_method || 'other') || 0) + num(s.amount_paid))
  const paidSuppliers = restocks.filter((r) => r.supplier_paid && r.cost_amount != null).reduce((sum, r) => sum + num(r.cost_amount), 0)
  const owedSuppliers = restocks.filter((r) => !r.supplier_paid && r.cost_amount != null).reduce((sum, r) => sum + num(r.cost_amount), 0)
  const noCostRestocks = restocks.filter((r) => r.cost_amount == null).length
  const owedByCustomers = sales.reduce((sum, s) => sum + owedOf(s), 0)
  const shouldHave = cashIn - paidSuppliers

  return (
    <div className="space-y-5">
      <PeriodPicker value={period} onChange={setPeriod} color={color} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Revenue (on costed sales)" value={money(revenue)} sub="what you charged" />
        <Tile label="Cost of what you sold" value={money(cogs)} tone="spend" sub="what those units cost you" />
        <Tile label="Profit" value={money(profit)} tone={profit >= 0 ? 'income' : 'spend'} sub={margin != null ? `${margin.toFixed(1)}% of revenue` : 'no costed sales yet'} />
      </div>
      <p className="text-xs text-muted">
        Profit = what you charged − what the units you sold cost you (from each restock's cost). It counts sales you haven't been paid for yet — see "Still owed" on the Revenue tab for that.
      </p>

      {noProduct.length > 0 && (
        <Notice>{noProduct.length} sale{noProduct.length === 1 ? '' : 's'} ({money(noProductAmount)}) have no product or quantity, so they're left out of profit. Fix them on the Sales tab → "Needs product".</Notice>
      )}
      {uncostedUnits > 0 && (
        <Notice>{uncostedUnits} unit{uncostedUnits === 1 ? '' : 's'} sold came from a restock with no cost entered, so {uncostedUnits === 1 ? 'it is' : 'they are'} left out of profit rather than counted as free. Add the cost on the Stock tab → restock history → Edit.</Notice>
      )}
      {overUnits > 0 && (
        <Notice>{overUnits} unit{overUnits === 1 ? '' : 's'} sold {overUnits === 1 ? 'was' : 'were'} never restocked, so {overUnits === 1 ? 'it has' : 'they have'} no cost and {overUnits === 1 ? 'is' : 'are'} left out of profit. Check the Batches tab for the product affected.</Notice>
      )}

      <div>
        <h3 className="text-sm text-text font-medium mb-2">Profit by product</h3>
        {byProduct.length === 0 ? <p className="text-sm text-muted">Nothing costed in this period.</p> : (
          <Table head={['Product', 'Units', 'Revenue', 'Cost', 'Profit']}
            rows={byProduct.map((r) => [r.name, r.units, money(r.rev), money(r.cost), money(r.profit)])}
            foot={['Total', byProduct.reduce((s, r) => s + r.units, 0), money(revenue), money(cogs), money(profit)]} />
        )}
      </div>

      <div>
        <h3 className="text-sm text-text font-medium mb-2">Profit by restock (batch)</h3>
        {byBatch.length === 0 ? <p className="text-sm text-muted">Nothing costed in this period.</p> : (
          <Table head={['Batch', 'Units', 'Revenue', 'Cost', 'Profit']}
            rows={byBatch.map((r) => [r.label, r.units, money(r.rev), money(r.cost), money(r.profit)])} />
        )}
      </div>

      <div className="rounded-xl border border-line bg-surface p-4 space-y-3">
        <div>
          <h3 className="text-sm text-text font-medium">Cash check — how much you should have right now</h3>
          <p className="text-xs text-muted mt-0.5">All time (ignores the period buttons above).</p>
        </div>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-muted">Collected from customers</span><span className="font-mono-nums text-text">{money(cashIn)}</span></div>
          {[...inByMethod.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs pl-3"><span className="text-muted">{methodLabel[k] || k}</span><span className="font-mono-nums text-muted">{money(v)}</span></div>
          ))}
          <div className="flex justify-between"><span className="text-muted">Paid to suppliers</span><span className="font-mono-nums text-spend">− {money(paidSuppliers)}</span></div>
          <div className="flex justify-between border-t border-line pt-1.5 font-medium">
            <span className="text-text">Should be in your hands</span>
            <span className="font-mono-nums" style={{ color: shouldHave >= 0 ? 'var(--color-income)' : 'var(--color-spend)' }}>{money(shouldHave)}</span>
          </div>
        </div>
        <div className="space-y-1.5 text-sm border-t border-line pt-3">
          <div className="flex justify-between"><span className="text-muted">Customers still owe you</span><span className="font-mono-nums text-text">{money(owedByCustomers)}</span></div>
          <div className="flex justify-between"><span className="text-muted">You still owe suppliers</span><span className="font-mono-nums text-text">{money(owedSuppliers)}</span></div>
        </div>
        <p className="text-xs text-muted">
          Only counts what's logged in this app. It doesn't know about money you took out for yourself, other spending, or starting capital — so compare it with what you actually hold across cash, MoMo and Telecash.
          {noCostRestocks > 0 ? ` ${noCostRestocks} restock${noCostRestocks === 1 ? ' has' : 's have'} no cost entered, so any supplier payment for ${noCostRestocks === 1 ? 'it isn\'t' : 'them isn\'t'} included.` : ''}
        </p>
      </div>
    </div>
  )
}
