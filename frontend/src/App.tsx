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
import { AuthForm } from './components/AuthForm'
import { MyMixes } from './components/MyMixes'
import { PlayerBar } from './components/PlayerBar'
import { PromptInput } from './components/PromptInput'
import { TrackRow } from './components/TrackRow'
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
  const engineRef = useRef<DjEngine | null>(null)

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

  return (
    <div className="app">
      <header>
        <div className="header-row">
          <h1>PromptMix</h1>
          {user && (
            <div className="account">
              <span className="account-email">{user.email}</span>
              <button className="link-btn" onClick={onLoggedOut}>Log out</button>
            </div>
          )}
        </div>
        <p className="tagline">Prompt a vibe. Get a beat-matched DJ set.</p>
      </header>

      {!user && <AuthForm onAuthenticated={onAuthenticated} />}

      <PromptInput onGenerate={onGenerate} loading={busy} />

      {error && <div className="error">{error}</div>}
      {generating && (
        <div className="generating">
          <div className="spinner" />
          Finding tracks, analyzing BPM &amp; energy, planning transitions…
        </div>
      )}

      {mix && (
        <>
          <div className="mix-meta">
            <span className="mix-prompt">“{mix.prompt}”</span>
            {mix.resolved_tags.map((t) => (
              <span key={t} className="chip tag">{t}</span>
            ))}
            {user && (
              <button
                className="save-btn"
                onClick={onSaveMix}
                disabled={saveState !== 'idle'}
              >
                {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : 'Save mix'}
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
        </>
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
    </div>
  )
}
