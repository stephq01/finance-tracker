import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../lib/AuthContext'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    const { error } =
      mode === 'signin' ? await signIn(email, password) : await signUp(email, password)
    setBusy(false)
    if (error) {
      setError(error.message)
    } else if (mode === 'signup') {
      setNotice('Account created. Check your email to confirm, then sign in.')
      setMode('signin')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-sm"
      >
        <div className="mb-8 text-center">
          <div className="font-display text-3xl font-semibold tracking-tight text-text">
            Current
          </div>
          <p className="mt-1 text-sm text-muted">Where your money actually goes.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-line bg-surface p-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-text text-sm outline-none focus:border-worth transition-colors"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-surface-2 border border-line px-3 py-2 text-text text-sm outline-none focus:border-worth transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-spend">{error}</p>}
          {notice && <p className="text-sm text-income">{notice}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-worth text-ink font-medium text-sm py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError('')
            setNotice('')
          }}
          className="mt-4 w-full text-center text-xs text-muted hover:text-text transition-colors"
        >
          {mode === 'signin' ? "No account yet? Create one" : 'Already have an account? Sign in'}
        </button>
      </motion.div>
    </div>
  )
}
