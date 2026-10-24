import { useRef } from 'react'
import type { EngineSnapshot } from '../audio/djEngine'
import type { Playlist } from '../api'

function fmt(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const SkipIcon = ({ flip }: { flip?: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
    <path d="M5 5h2.5v14H5zM9 12l10-7v14z" />
  </svg>
)

interface Props {
  mix: Playlist
  snap: EngineSnapshot
  loadProgress: string
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onSeek: (setSeconds: number) => void
  onNext: () => void
  onPrev: () => void
}

export function PlayerBar({ mix, snap, loadProgress, onPlay, onPause, onStop, onSeek, onNext, onPrev }: Props) {
  const barRef = useRef<HTMLDivElement>(null)
  const current = mix.tracks[snap.currentTrack]
  const playing = snap.status === 'playing'
  const paused = snap.status === 'paused'
  const loading = snap.status === 'loading'
  const pct = snap.totalDuration > 0 ? (snap.totalElapsed / snap.totalDuration) * 100 : 0
  const canNavigate = playing || paused || snap.status === 'ended'

  function handleSeek(e: React.MouseEvent) {
    if (!barRef.current || snap.totalDuration <= 0 || !canNavigate) return
    const rect = barRef.current.getBoundingClientRect()
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onSeek(frac * snap.totalDuration)
  }

  return (
    <div className="player-bar">
      <div className="player-controls">
        <button className="skip-btn" onClick={onPrev} disabled={!canNavigate} title="Previous track"><SkipIcon /></button>
        {playing ? (
          <button className="play-btn" onClick={onPause}>❚❚</button>
        ) : (
          <button className="play-btn" onClick={onPlay} disabled={loading}>
            {loading ? '…' : '▶'}
          </button>
        )}
        <button className="skip-btn" onClick={onNext} disabled={!canNavigate} title="Next track"><SkipIcon flip /></button>
        <button className="stop-btn" onClick={onStop} disabled={!playing && !paused}>■</button>
      </div>
      <div className="player-meta">
        <div className="now-playing">
          {loading
            ? `Loading audio ${loadProgress}`
            : snap.status === 'ended'
              ? 'Set finished'
              : `${current.artist} — ${current.name}`}
          {snap.blending && <span className="blend-tag">blending ↻</span>}
        </div>
        <div className="progress-track" ref={barRef} onClick={handleSeek}>
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="player-time">
        {fmt(snap.totalElapsed)} / {fmt(snap.totalDuration)}
      </div>
    </div>
  )
}
