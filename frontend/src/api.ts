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

export interface User {
  id: number
  email: string
  created_at: string
}

export interface Token {
  access_token: string
  token_type: string
}

export interface SavedMix extends Playlist {
  id: number
  created_at: string
}

const TOKEN_KEY = 'promptmix_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init: RequestInit = {}, auth = false): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (auth) {
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  const resp = await fetch(path, { ...init, headers })
  if (!resp.ok) {
    let detail = resp.statusText
    try {
      const body = await resp.json()
      if (typeof body.detail === 'string') detail = body.detail
      else if (Array.isArray(body.detail) && body.detail[0]?.msg) detail = body.detail[0].msg
    } catch { /* non-json error */ }
    throw new ApiError(resp.status, detail)
  }
  if (resp.status === 204) return undefined as T
  return resp.json()
}

export function generatePlaylist(prompt: string, count = 8): Promise<Playlist> {
  return request<Playlist>('/api/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt, count }),
  })
}

async function authenticate(path: string, email: string, password: string): Promise<Token> {
  const token = await request<Token>(path, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setToken(token.access_token)
  return token
}

export function signup(email: string, password: string): Promise<Token> {
  return authenticate('/api/auth/signup', email, password)
}

export function login(email: string, password: string): Promise<Token> {
  return authenticate('/api/auth/login', email, password)
}

export function logout() {
  setToken(null)
}

export function getMe(): Promise<User> {
  return request<User>('/api/me', {}, true)
}

export function saveMix(mix: Playlist): Promise<SavedMix> {
  return request<SavedMix>('/api/mixes', { method: 'POST', body: JSON.stringify({ mix }) }, true)
}

export function listMixes(): Promise<SavedMix[]> {
  return request<SavedMix[]>('/api/mixes', {}, true)
}

export function getMix(id: number): Promise<SavedMix> {
  return request<SavedMix>(`/api/mixes/${id}`, {}, true)
}

export function deleteMix(id: number): Promise<void> {
  return request<void>(`/api/mixes/${id}`, { method: 'DELETE' }, true)
}
