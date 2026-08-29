// One soft, slowly-pulsing color blob per page, tinted to that page's stage
// or business color. This is the thing that keeps the dark base from
// reading as flat/boring — every tab gets its own color mood.
export default function PageGlow({ color }) {
  return (
    <div
      className="pointer-events-none absolute -top-16 -right-16 w-80 h-80 rounded-full blur-3xl page-glow-pulse"
      style={{ background: `var(--color-${color})` }}
      aria-hidden="true"
    />
  )
}
