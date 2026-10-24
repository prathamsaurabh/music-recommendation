import { useEffect, useRef, useState } from 'react'
import { generatePlaylist, type Playlist } from './api'
import { DjEngine, type EngineSnapshot } from './audio/djEngine'
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
  const engineRef = useRef<DjEngine | null>(null)

  const engine = () => (engineRef.current ??= new DjEngine())

  useEffect(() => {
    const id = setInterval(() => {
      const e = engineRef.current
      if (e) setSnap(e.snapshot())
    }, 400)
    return () => clearInterval(id)
  }, [])

  async function onGenerate(prompt: string) {
    setError('')
    setGenerating(true)
    engine().stop()
    try {
      const result = await generatePlaylist(prompt)
      setMix(result)
      const e = engine()
      e.onProgress = (n, total) => setLoadProgress(`${n}/${total}`)
      setLoadProgress('')
      await e.load(result)
      e.play()
      setSnap(e.snapshot())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="app">
      <header>
        <h1>PromptMix</h1>
        <p className="tagline">Prompt a vibe. Get a beat-matched DJ set.</p>
      </header>

      <PromptInput onGenerate={onGenerate} loading={generating || snap.status === 'loading'} />

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
    </div>
  )
}
