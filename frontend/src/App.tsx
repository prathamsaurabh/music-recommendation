import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ApiError,
  deleteMix,
  generatePlaylist,
  getMe,
  getMix,
  getToken,
  listMixes,
  logout,
  saveMix,
  type Playlist,
  type SavedMix,
  type User,
} from './api'
import { DjEngine, type EngineSnapshot } from './audio/djEngine'
import { AboutUs } from './components/AboutUs'
import { AuthForm } from './components/AuthForm'
import { MyMixes } from './components/MyMixes'
import { PlayerBar } from './components/PlayerBar'
import { PromptInput } from './components/PromptInput'
import { TrackRow } from './components/TrackRow'
import { usePath } from './usePath'
import './App.css'

const IDLE_SNAP: EngineSnapshot = {
  status: 'idle',
  currentTrack: 0,
  trackElapsed: 0,
  totalElapsed: 0,
  totalDuration: 0,
  blending: false,
}

export default function App() {
  const [mix, setMix] = useState<Playlist | null>(null)
  const [snap, setSnap] = useState<EngineSnapshot>(IDLE_SNAP)
  const [generating, setGenerating] = useState(false)
  const [loadProgress, setLoadProgress] = useState('')
  const [error, setError] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [savedMixes, setSavedMixes] = useState<SavedMix[]>([])
  const [mixesLoading, setMixesLoading] = useState(() => getToken() !== null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null)
  const [path, navigate] = usePath()
  const engineRef = useRef<DjEngine | null>(null)
  const onAbout = path === '/aboutus'

  const engine = () => (engineRef.current ??= new DjEngine())

  useEffect(() => {
    const id = setInterval(() => {
      const e = engineRef.current
      if (e) setSnap(e.snapshot())
    }, 400)
    return () => clearInterval(id)
  }, [])

  const onLoggedOut = useCallback(() => {
    logout()
    setUser(null)
    setSavedMixes([])
  }, [])

  const handleAuthError = useCallback((err: unknown, fallback: string) => {
    if (err instanceof ApiError && err.status === 401) {
      onLoggedOut()
      setError('Your session expired — please log in again.')
    } else {
      setError(err instanceof Error ? err.message : fallback)
    }
  }, [onLoggedOut])

  const refreshAccount = useCallback(() => {
    if (!getToken()) return
    Promise.all([getMe(), listMixes()])
      .then(([me, mixes]) => {
        setUser(me)
        setSavedMixes(mixes)
      })
      .catch((err) => handleAuthError(err, 'Could not load your account'))
      .finally(() => setMixesLoading(false))
  }, [handleAuthError])

  useEffect(refreshAccount, [refreshAccount])

  function onAuthenticated() {
    setError('')
    setAuthMode(null)
    setMixesLoading(true)
    refreshAccount()
  }

  async function playMix(result: Playlist) {
    setMix(result)
    setSaveState('id' in result ? 'saved' : 'idle')
    const e = engine()
    e.onProgress = (n, total) => setLoadProgress(`${n}/${total}`)
    setLoadProgress('')
    await e.load(result)
    e.play()
    setSnap(e.snapshot())
  }

  async function onGenerate(prompt: string) {
    setError('')
    setGenerating(true)
    engine().stop()
    try {
      await playMix(await generatePlaylist(prompt))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function onSaveMix() {
    if (!mix) return
    setError('')
    setSaveState('saving')
    try {
      const saved = await saveMix(mix)
      setSavedMixes((prev) => [saved, ...prev])
      setSaveState('saved')
    } catch (err) {
      setSaveState('idle')
      handleAuthError(err, 'Could not save mix')
    }
  }

  async function onOpenMix(id: number) {
    setError('')
    engine().stop()
    try {
      await playMix(await getMix(id))
    } catch (err) {
      handleAuthError(err, 'Could not load mix')
    }
  }

  async function onDeleteMix(id: number) {
    setError('')
    try {
      await deleteMix(id)
      setSavedMixes((prev) => prev.filter((m) => m.id !== id))
      if (mix && 'id' in mix && mix.id === id) setSaveState('idle')
    } catch (err) {
      handleAuthError(err, 'Could not delete mix')
    }
  }

  const busy = generating || snap.status === 'loading'

  function openAuth(mode: 'login' | 'signup') {
    navigate('/')
    setAuthMode(mode)
  }

  function link(to: string, label: string) {
    return (
      <a
        href={to}
        className="nav-link"
        onClick={(e) => { e.preventDefault(); navigate(to) }}
      >
        {label}
      </a>
    )
  }

  return (
    <div className="page">
      <nav className="nav">
        <div className="nav-left">
          <a href="/" className="logo" onClick={(e) => { e.preventDefault(); navigate('/') }}>
            <span className="logo-mark">✳</span>PromptMix
          </a>
          {onAbout ? link('/', 'Home') : link('/aboutus', 'About us')}
        </div>
        <div className="nav-actions">
          {user ? (
            <>
              <span className="nav-email">{user.email}</span>
              <button className="btn btn-outline" onClick={onLoggedOut}>Log out</button>
            </>
          ) : (
            <>
              <button className="btn btn-text" onClick={() => openAuth('login')}>Log in</button>
              <button className="btn btn-yellow" onClick={() => openAuth('signup')}>Sign up for free</button>
            </>
          )}
        </div>
      </nav>

      {onAbout ? (
        <main className="card"><AboutUs /></main>
      ) : (
        <main className="card">
          <section className="hero">
            <h1>Prompt a vibe.<br />Get a beat-matched DJ set.</h1>
            <p className="subtitle">
              Describe any mood and PromptMix pulls Creative Commons tracks, matches their tempo
              and key, and blends them like a DJ — right in your browser.
            </p>

            {authMode && !user && (
              <AuthForm
                key={authMode}
                initialMode={authMode}
                onAuthenticated={onAuthenticated}
                onCancel={() => setAuthMode(null)}
              />
            )}

            <PromptInput onGenerate={onGenerate} loading={busy} />
            <div className="pill-note">✓ No account needed to generate</div>
          </section>

          {error && <div className="error">{error}</div>}
          {generating && (
            <div className="generating">
              <div className="spinner" />
              Finding tracks, analyzing BPM &amp; energy, planning transitions…
            </div>
          )}

          {mix && (
            <section className="mix">
              <div className="mix-banner">
                <div>
                  <div className="eyebrow">Now mixing</div>
                  <div className="mix-prompt">“{mix.prompt}”</div>
                  <div className="mix-tags">
                    {mix.resolved_tags.map((t) => (
                      <span key={t} className="tag">{t}</span>
                    ))}
                  </div>
                </div>
                {user ? (
                  <button
                    className="btn btn-dark"
                    onClick={onSaveMix}
                    disabled={saveState !== 'idle'}
                  >
                    {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : 'Save mix'}
                  </button>
                ) : (
                  <button className="btn btn-outline" onClick={() => setAuthMode('login')}>
                    Log in to save
                  </button>
                )}
              </div>
              <div className="track-list">
                {mix.tracks.map((t, i) => (
                  <TrackRow
                    key={t.id}
                    track={t}
                    index={i}
                    active={snap.currentTrack === i && snap.status === 'playing'}
                    ratePct={Math.round((t.rate - 1) * 100)}
                  />
                ))}
              </div>
              <PlayerBar
                mix={mix}
                snap={snap}
                loadProgress={loadProgress}
                onPlay={() => { engine().play(); setSnap(engine().snapshot()) }}
                onPause={() => { engine().pause(); setSnap(engine().snapshot()) }}
                onStop={() => { engine().stop(); setSnap(engine().snapshot()) }}
                onSeek={(s) => { engine().seekSet(s); setSnap(engine().snapshot()) }}
                onNext={() => { engine().skipNext(); setSnap(engine().snapshot()) }}
                onPrev={() => { engine().skipPrev(); setSnap(engine().snapshot()) }}
              />
            </section>
          )}

          {user && (
            <MyMixes
              mixes={savedMixes}
              loading={mixesLoading}
              disabled={busy}
              onOpen={onOpenMix}
              onDelete={onDeleteMix}
            />
          )}
        </main>
      )}
    </div>
  )
}
