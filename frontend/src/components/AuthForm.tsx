import { useState, type FormEvent } from 'react'
import { login, signup } from '../api'

interface Props {
  initialMode: 'login' | 'signup'
  onAuthenticated: () => void
  onCancel: () => void
}

export function AuthForm({ initialMode, onAuthenticated, onCancel }: Props) {
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await (mode === 'login' ? login : signup)(email.trim(), password)
      setPassword('')
      onAuthenticated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <div className="auth-head">
        <span className="auth-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</span>
        <button type="button" className="btn-close" onClick={onCancel} aria-label="Close">✕</button>
      </div>
      <input
        type="email"
        placeholder="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={busy}
      />
      <input
        type="password"
        placeholder="password (8+ chars)"
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={8}
        maxLength={72}
        required
        disabled={busy}
      />
      <button type="submit" className="btn btn-yellow" disabled={busy}>
        {busy ? '…' : mode === 'login' ? 'Log in' : 'Sign up for free'}
      </button>
      <button
        type="button"
        className="link-btn"
        onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
        disabled={busy}
      >
        {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
      </button>
      {error && <div className="auth-error">{error}</div>}
    </form>
  )
}
