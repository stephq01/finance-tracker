import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { fireNotification, notificationPermission } from './notify'

// Counts how many products, across every business, are either at/under
// their low-stock threshold or overdue for a restock (last restock +
// restock_cycle_days has passed). Used to badge the "Businesses" nav item.
export function useBusinessAlerts() {
  const [count, setCount] = useState(0)

  async function refresh() {
    const [{ data: products }, { data: restocks }, { data: sales }] = await Promise.all([
      supabase.from('business_products').select('*'),
      supabase.from('business_restocks').select('product_id, date, quantity').order('date', { ascending: false }),
      supabase.from('business_sales').select('product_id, quantity'),
    ])
    if (!products) return
    const today = new Date().toISOString().slice(0, 10)
    let alerts = 0
    for (const p of products) {
      const restocked = (restocks || []).filter((r) => r.product_id === p.id)
      const sold = (sales || []).filter((s) => s.product_id === p.id)
      const stock =
        restocked.reduce((s, r) => s + Number(r.quantity), 0) -
        sold.reduce((s, r) => s + Number(r.quantity || 0), 0)
      const lastRestock = restocked[0]?.date
      const restockDue =
        p.restock_cycle_days && lastRestock
          ? new Date(today) - new Date(lastRestock) >= p.restock_cycle_days * 86400000
          : false
      if (stock <= Number(p.low_stock_threshold) || restockDue) alerts += 1
    }
    setCount(alerts)

    if (alerts > 0 && notificationPermission() === 'granted' && !sessionStorage.getItem('alertsNotified')) {
      fireNotification('Stock needs attention', `${alerts} item${alerts > 1 ? 's' : ''} low on stock or overdue for restock.`)
      sessionStorage.setItem('alertsNotified', '1')
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  return { count, refresh }
}
