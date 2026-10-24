import { useState, type FormEvent } from 'react'
import { login, signup } from '../api'

interface Props {
  onAuthenticated: () => void
}

export function AuthForm({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
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
      <button type="submit" disabled={busy}>
        {busy ? '…' : mode === 'login' ? 'Log in' : 'Sign up'}
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
