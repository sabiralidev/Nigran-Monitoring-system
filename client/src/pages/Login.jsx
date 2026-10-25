import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Lock, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import SignalField from '../components/auth/SignalField'

const Login = () => {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuth()
  const [form, setForm] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(form.username.trim(), form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 overflow-hidden bg-white lg:grid-cols-[1.15fr_minmax(420px,0.85fr)]">
      {/* Animation side */}
      <div className="brand-gradient relative hidden overflow-hidden lg:block">
        <SignalField />
        {/* bottom vignette to anchor the caption */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(8,25,58,0.55) 0%, rgba(8,25,58,0.12) 38%, transparent 68%)',
          }}
        />

        {/* Brand lockup, top-left */}
        <div className="absolute left-10 top-9 z-10 flex items-center gap-3">
          <img src="/team_logo.png" alt="NIGRAN" className="h-10 w-10 shrink-0 object-contain drop-shadow-lg" />
          <div className="leading-tight">
            <div className="text-xl font-bold tracking-widest text-white">NIGRAN</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/70">
              Media Intelligence Monitoring
            </div>
          </div>
        </div>

        {/* Caption, bottom-left */}
        <div className="absolute bottom-10 left-10 right-10 z-10">
          <div className="mb-3 flex items-center gap-4 font-mono text-[11px] uppercase tracking-wider text-white/75">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Live
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Watch
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              Alert
            </span>
          </div>
          <h2 className="max-w-lg text-3xl font-bold leading-tight tracking-tight text-white">
            Every platform, watched in real time.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/80">
            NIGRAN sweeps real-time media and social activity across your monitored
            accounts, surfacing what matters the moment it moves.
          </p>
        </div>
      </div>

      {/* Form side */}
      <div className="relative flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-sm"
        >
          {/* Mobile brand lockup */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <img src="/team_logo.png" alt="NIGRAN" className="h-11 w-11 shrink-0 object-contain" />
            <div className="leading-tight">
              <p className="text-base font-bold tracking-[0.22em] text-slate-900">NIGRAN</p>
              <p className="text-xs text-slate-500">Media Intelligence Monitoring</p>
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Access your intelligence workspace.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">
                Username
              </label>
              <div className="relative">
                <User
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="username"
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="input-field pl-9"
                  required
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">
                Password
              </label>
              <div className="relative">
                <Lock
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input-field pl-9"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
              style={{
                background: 'linear-gradient(135deg, #1e3a8a 0%, #0e7490 100%)',
                borderColor: 'rgba(30, 58, 138, 0.4)',
                boxShadow: '0 6px 16px -6px rgba(30, 58, 138, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              }}
            >
              {loading ? <div className="spinner" /> : <ArrowRight size={16} />}
              {loading ? 'Signing in' : 'Sign in'}
            </button>

            <p className="text-[11px] leading-5 text-slate-400">
              Sessions are monitored and logged.
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  )
}

export default Login
