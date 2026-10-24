import type { Track } from '../api'

function Waveform({ data, active }: { data: number[]; active: boolean }) {
  const max = Math.max(...data, 0.001)
  return (
    <div className={`waveform ${active ? 'active' : ''}`}>
      {data.map((v, i) => (
        <span key={i} style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />
      ))}
    </div>
  )
}

interface Props {
  track: Track
  index: number
  active: boolean
  ratePct: number
}

export function TrackRow({ track, index, active, ratePct }: Props) {
  return (
    <div className={`track-row ${active ? 'active' : ''}`}>
      <div className="track-num">{String(index + 1).padStart(2, '0')}</div>
      {track.album_image ? (
        <img className="album-art" src={track.album_image} alt="" />
      ) : (
        <div className="album-art placeholder" />
      )}
      <div className="track-info">
        <div className="track-name">{track.name}</div>
        <div className="track-artist">{track.artist}</div>
      </div>
      <Waveform data={track.waveform} active={active} />
      <div className="badges">
        <span className="badge">{Math.round(track.bpm * track.rate)} BPM</span>
        {track.camelot && <span className="badge camelot">{track.camelot}</span>}
        {ratePct !== 0 && (
          <span className="badge rate">{ratePct > 0 ? '+' : ''}{ratePct}%</span>
        )}
      </div>
    </div>
  )
}
