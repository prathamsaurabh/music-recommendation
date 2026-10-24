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
