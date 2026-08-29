import { NavLink, Outlet } from 'react-router-dom'
import * as Icons from 'lucide-react'
import { stages } from '../lib/stages'
import { useAuth } from '../lib/AuthContext'
import { useBusinessAlerts } from '../lib/useBusinessAlerts'

export default function Layout() {
  const { user, signOut } = useAuth()
  const { count: alertCount } = useBusinessAlerts()

  return (
    <div className="min-h-screen flex bg-ink">
      {/* the "current" — a slow-moving gradient thread strung through every
          stage's color, in order. it's the one animated signature element;
          everything else in the shell stays still. */}
      <div className="hidden md:block w-1 shrink-0 flow-thread" aria-hidden="true" />

      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-line px-4 py-6">
        <div className="px-2 mb-8">
          <div className="font-display text-xl font-semibold text-text">Current</div>
          <div className="text-xs text-muted mt-0.5 truncate">{user?.email}</div>
        </div>

        <nav className="flex-1 space-y-1">
          {stages.map((s) => {
            const Icon = Icons[s.icon]
            return (
              <NavLink
                key={s.id}
                to={s.path}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors border-l-2 ${
                    isActive
                      ? 'bg-surface text-text'
                      : 'border-transparent text-muted hover:text-text hover:bg-surface'
                  }`
                }
                style={({ isActive }) => ({
                  borderLeftColor: isActive ? `var(--color-${s.color})` : 'transparent',
                })}
              >
                {Icon && <Icon size={16} style={{ color: `var(--color-${s.color})` }} />}
                {s.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="border-t border-line pt-3 mt-2">
          <NavLink
            to="/businesses"
            className={({ isActive }) =>
              `flex items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors border-l-2 ${
                isActive ? 'bg-surface text-text border-worth' : 'border-transparent text-muted hover:text-text hover:bg-surface'
              }`
            }
          >
            <span className="flex items-center gap-2.5">
              <Icons.Store size={16} style={{ color: 'var(--color-worth)' }} />
              Businesses
            </span>
            {alertCount > 0 && (
              <span className="text-[10px] w-4 h-4 rounded-full flex items-center justify-center text-ink font-medium" style={{ background: 'var(--color-spend)' }}>
                {alertCount}
              </span>
            )}
          </NavLink>
        </div>

        <button
          onClick={signOut}
          className="mt-4 px-3 py-2 text-xs text-muted hover:text-text text-left transition-colors"
        >
          Sign out
        </button>
      </aside>

      {/* mobile top nav — icons only, horizontally scrollable */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-10 bg-surface border-t border-line flex overflow-x-auto">
        {stages.map((s) => {
          const Icon = Icons[s.icon]
          return (
            <NavLink
              key={s.id}
              to={s.path}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-3.5 py-2.5 text-[10px] shrink-0 ${
                  isActive ? 'text-text' : 'text-muted'
                }`
              }
            >
              {Icon && <Icon size={18} style={{ color: `var(--color-${s.color})` }} />}
              {s.label.split(' ')[0]}
            </NavLink>
          )
        })}
        <NavLink
          to="/businesses"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 px-3.5 py-2.5 text-[10px] shrink-0 relative ${
              isActive ? 'text-text' : 'text-muted'
            }`
          }
        >
          <Icons.Store size={18} style={{ color: 'var(--color-worth)' }} />
          Business
          {alertCount > 0 && (
            <span className="absolute top-1 right-1.5 w-2 h-2 rounded-full" style={{ background: 'var(--color-spend)' }} />
          )}
        </NavLink>
      </nav>

      <main className="flex-1 px-5 py-6 md:px-10 md:py-10 pb-20 md:pb-10 max-w-4xl relative overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
