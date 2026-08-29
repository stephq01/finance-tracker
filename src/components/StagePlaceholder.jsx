import { motion } from 'framer-motion'
import * as Icons from 'lucide-react'
import PageGlow from './PageGlow'

// Shown for stages we haven't wired up to Supabase yet. Keeps the whole
// nav feeling alive and previews exactly what each tab will do, instead of
// a blank 404-shaped hole. Swapped out for a real page one stage at a time.
export default function StagePlaceholder({ stage }) {
  const Icon = Icons[stage.icon]
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <PageGlow color={stage.color} />
      <div className="flex items-center gap-3 mb-2">
        {Icon && (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: `color-mix(in srgb, var(--color-${stage.color}) 18%, transparent)` }}
          >
            <Icon size={18} style={{ color: `var(--color-${stage.color})` }} />
          </div>
        )}
        <h1 className="font-display text-2xl font-semibold text-text">{stage.label}</h1>
      </div>
      <p className="text-sm text-muted max-w-md mb-6">{stage.blurb}</p>
      <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
        <p className="text-sm text-muted">
          Not built yet — this is next in line.
        </p>
      </div>
    </motion.div>
  )
}
