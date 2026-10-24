import { useState } from 'react'

const SUGGESTIONS = [
  'high energy workout techno',
  'chill lofi for studying',
  'funky disco party',
  'melancholy indie rock',
  'epic cinematic soundtrack',
  'smooth jazz lounge',
]

interface Props {
  onGenerate: (prompt: string) => void
  loading: boolean
}

export function PromptInput({ onGenerate, loading }: Props) {
  const [value, setValue] = useState('')

  return (
    <div className="prompt-box">
      <div className="prompt-row">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && value.trim() && onGenerate(value.trim())}
          placeholder="Describe the mix you want — e.g. 'chill lofi for a rainy day'"
          disabled={loading}
        />
        <button onClick={() => onGenerate(value.trim())} disabled={loading || !value.trim()}>
          {loading ? 'Mixing…' : 'Generate mix'}
        </button>
      </div>
      <div className="suggestions">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="chip" onClick={() => { setValue(s); onGenerate(s) }} disabled={loading}>
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
