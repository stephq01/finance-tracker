import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import * as Icons from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import PageGlow from '../components/PageGlow'
import OrderBusinessDetail from './ordermgmt/OrderBusinessDetail'
import { StockTab, SalesTab, DeliveriesTab } from './SimpleBusinessTabs'

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

      {business.module === 'order_management' ? (
        <OrderBusinessDetail business={business} userId={user.id} />
      ) : (
        <SimpleBusinessBody
          id={id}
          user={user}
          business={business}
          alerts={alerts}
          tab={tab}
          setTab={setTab}
          products={products}
          sales={sales}
          deliveries={deliveries}
          restocks={restocks}
          productStats={productStats}
          loadAll={loadAll}
        />
      )}
    </motion.div>
  )
}

function SimpleBusinessBody({ id, user, business, alerts, tab, setTab, products, sales, deliveries, restocks, productStats, loadAll }) {
  return (
    <>
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
        <StockTab businessId={id} userId={user.id} color={business.color} productStats={productStats} restocks={restocks} onChange={loadAll} />
      )}
      {tab === 'sales' && (
        <SalesTab businessId={id} userId={user.id} color={business.color} products={products} sales={sales} onChange={loadAll} />
      )}
      {tab === 'deliveries' && (
        <DeliveriesTab businessId={id} userId={user.id} color={business.color} deliveries={deliveries} onChange={loadAll} />
      )}
    </>
  )
}
