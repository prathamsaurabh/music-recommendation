# PromptMix

Prompt a vibe, get a beat-matched, crossfaded DJ set — no DJ required.

Type any description ("high energy workout techno", "chill lofi for a rainy
day") and PromptMix:

1. resolves your prompt to genre/mood tags,
2. pulls full-length Creative Commons tracks from **Jamendo**,
3. analyzes each track with **librosa** — BPM & beat grid (onset
   autocorrelation), FFT-based energy curve (intro/outro detection), and
   Krumhansl-Schmuckler key estimation,
4. sequences the set for smooth BPM drift + harmonically compatible keys
   (Camelot wheel), then computes a tempo curve and bar-aligned mix points,
5. plays it back in the browser with a two-deck Web Audio engine that
   tempo-matches each track and applies equal-power crossfades — like a DJ
   blend.

## Setup

```bash
# 1. Backend
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env        # then put your Jamendo client id in .env
.venv/bin/python -m uvicorn app.main:app --port 8000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173 (proxies /api -> :8000)
```

Get a free Jamendo client id at https://devportal.jamendo.com (sign up → create an
application → copy the client id). Without it, `/api/generate` returns a 503 telling
you the key is missing.

Other settings in `backend/.env`:

- `DATABASE_URL` — SQLAlchemy URL for user accounts and saved mixes. Defaults to
  `sqlite:///./promptmix.db` (relative to where uvicorn is started); the file and
  tables are created automatically on first run.
- `JWT_SECRET` — secret used to sign login tokens. The built-in default is for local
  development only; set a long random value anywhere else.

## Accounts & saved mixes

`/api/generate` is open to guests. Logging in lets you save generated mixes and replay
them later (track audio is served from `backend/cache/`, so a saved mix replays as long
as its tracks are still cached).

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | — | `{email, password}` → `{access_token, token_type}` |
| POST | `/api/auth/login` | — | `{email, password}` → `{access_token, token_type}` |
| GET | `/api/me` | Bearer | Current user |
| POST | `/api/mixes` | Bearer | `{mix: <PlaylistOut>}` → saved mix |
| GET | `/api/mixes` | Bearer | List your saved mixes (newest first) |
| GET | `/api/mixes/{id}` | Bearer | Fetch one of your mixes |
| DELETE | `/api/mixes/{id}` | Bearer | Delete one of your mixes |

Authenticated requests send `Authorization: Bearer <access_token>`; the frontend
keeps the token in `localStorage`.

## How the mix works

- `backend/app/prompts.py` — prompt → Jamendo tags + speed/mood filters
- `backend/app/analyzer.py` — BPM, beat grid, energy curve, key, mix_in/mix_out
- `backend/app/sequencer.py` — greedy ordering by BPM drift + Camelot distance
- `backend/app/mixplan.py` — per-track playbackRate + per-transition
  exit/enter/fade times
- `frontend/src/audio/djEngine.ts` — schedules the whole set on the
  AudioContext clock with tempo matching and equal-power crossfades

Track audio and analyses are cached in `backend/cache/` so re-generating the
same prompt is fast.
