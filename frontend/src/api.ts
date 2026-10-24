export interface Track {
  id: string
  name: string
  artist: string
  album_image: string | null
  duration: number
  audio_url: string
  genres: string[]
  bpm: number
  key: string | null
  camelot: string | null
  energy: number
  rate: number
  start_offset: number
  waveform: number[]
}

export interface Transition {
  from_track: number
  to_track: number
  exit_time: number
  enter_time: number
  fade_beats: number
  fade_seconds: number
}

export interface Playlist {
  prompt: string
  resolved_tags: string[]
  tracks: Track[]
  transitions: Transition[]
}

export async function generatePlaylist(prompt: string, count = 8): Promise<Playlist> {
  const resp = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, count }),
  })
  if (!resp.ok) {
    let detail = resp.statusText
    try {
      detail = (await resp.json()).detail ?? detail
    } catch { /* non-json error */ }
    throw new Error(detail)
  }
  return resp.json()
}
