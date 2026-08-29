import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import * as Icons from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { businessColors, businessIcons } from '../lib/businessMeta'
import PageGlow from '../components/PageGlow'
import { notificationPermission, notificationsSupported, requestNotificationPermission } from '../lib/notify'

export default function Businesses() {
  const { user } = useAuth()
  const [businesses, setBusinesses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', category: '', color: businessColors[0], icon: businessIcons[0] })
  const [saving, setSaving] = useState(false)
  const [permission, setPermission] = useState(notificationPermission())

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('businesses').select('*').order('created_at', { ascending: true })
    setBusinesses(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.name) return
    setSaving(true)
    await supabase.from('businesses').insert({
      user_id: user.id,
      name: form.name,
      category: form.category || null,
      color: form.color,
      icon: form.icon,
    })
    setSaving(false)
    setForm({ name: '', category: '', color: businessColors[0], icon: businessIcons[0] })
    setShowForm(false)
    load()
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageGlow color="worth" />
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl font-semibold text-text">Businesses</h1>
      </div>
      <p className="text-sm text-muted mb-6">
        Every side business, one place — stock, sales, deliveries, and restock alerts.
      </p>

      {notificationsSupported() && permission === 'default' && (
        <button
          onClick={async () => setPermission(await requestNotificationPermission())}
          className="mb-6 rounded-lg border border-dashed border-line px-4 py-2.5 text-sm text-muted hover:text-text hover:border-worth transition-colors"
        >
          🔔 Enable stock alerts on this device
        </button>
      )}
      {permission === 'denied' && (
        <p className="text-xs text-muted mb-6">
          Notifications are blocked for this site — you can still see alerts on this page and in the sidebar badge.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          {businesses.map((b) => {
            const Icon = Icons[b.icon] || Icons.Store
            return (
              <Link
                key={b.id}
                to={`/businesses/${b.id}`}
                className="rounded-xl border border-line p-4 flex items-center gap-3 hover:border-worth transition-colors"
                style={{ background: `color-mix(in srgb, var(--color-${b.color}) 8%, var(--color-surface))` }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `color-mix(in srgb, var(--color-${b.color}) 22%, transparent)` }}
                >
                  <Icon size={18} style={{ color: `var(--color-${b.color})` }} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm text-text font-medium truncate">{b.name}</div>
                  {b.category && <div className="text-xs text-muted truncate">{b.category}</div>}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg border border-dashed border-line px-4 py-3 text-sm text-muted hover:text-text hover:border-worth transition-colors w-full sm:w-auto"
        >
          + Add a business
        </button>
      ) : (
        <form onSubmit={handleAdd} className="rounded-xl border border-line bg-surface p-4 space-y-3 max-w-md">
          <div>
            <label className="block text-xs text-muted mb-1">Business name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Water resale, Joggers & dresses, Bread"
              className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Category (optional)</label>
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="e.g. Resale, Apparel, Food"
              className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-sm text-text outline-none focus:border-worth"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Color</label>
            <div className="flex gap-2 flex-wrap">
              {businessColors.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className="w-7 h-7 rounded-full border-2"
                  style={{
                    background: `var(--color-${c})`,
                    borderColor: form.color === c ? 'var(--color-text)' : 'transparent',
                  }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Icon</label>
            <div className="flex gap-2 flex-wrap">
              {businessIcons.map((iconName) => {
                const Icon = Icons[iconName]
                return (
                  <button
                    type="button"
                    key={iconName}
                    onClick={() => setForm({ ...form, icon: iconName })}
                    className="w-9 h-9 rounded-lg border flex items-center justify-center"
                    style={{
                      borderColor: form.icon === iconName ? 'var(--color-worth)' : 'var(--color-line)',
                      background: form.icon === iconName ? 'color-mix(in srgb, var(--color-worth) 15%, transparent)' : 'transparent',
                    }}
                  >
                    <Icon size={16} className="text-text" />
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-worth text-ink text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add business'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-line text-sm text-muted px-4 py-2 hover:text-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </motion.div>
  )
}
