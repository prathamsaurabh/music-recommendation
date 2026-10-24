import type { SavedMix } from '../api'

interface Props {
  mixes: SavedMix[]
  loading: boolean
  disabled: boolean
  onOpen: (id: number) => void
  onDelete: (id: number) => void
}

export function MyMixes({ mixes, loading, disabled, onOpen, onDelete }: Props) {
  return (
    <section className="my-mixes">
      <div className="eyebrow">Your library</div>
      <h2>My Mixes</h2>
      {loading && <div className="my-mixes-empty">Loading…</div>}
      {!loading && mixes.length === 0 && (
        <div className="my-mixes-empty">No saved mixes yet — generate one and hit “Save mix”.</div>
      )}
      {mixes.map((m) => (
        <div key={m.id} className="saved-mix">
          <button className="saved-mix-open" onClick={() => onOpen(m.id)} disabled={disabled}>
            <span className="saved-mix-prompt">“{m.prompt}”</span>
            <span className="saved-mix-meta">
              {m.tracks.length} tracks · {new Date(m.created_at).toLocaleString()}
            </span>
          </button>
          <button className="saved-mix-delete" onClick={() => onDelete(m.id)} title="Delete mix">
            ✕
          </button>
        </div>
      ))}
    </section>
  )
}
