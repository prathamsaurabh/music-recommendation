# PromptMix

Prompt a vibe, get a beat-matched, crossfaded DJ set from Creative Commons tracks (Jamendo).

## Setup

```bash
# Backend
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env
.venv/bin/python -m uvicorn app.main:app --port 8000

# Frontend
cd frontend
npm install && npm run dev   # http://localhost:5173
```

`backend/.env`:

- `JAMENDO_CLIENT_ID` — free at https://devportal.jamendo.com (required for `/api/generate`)
- `DATABASE_URL` — defaults to `sqlite:///./promptmix.db` (created on first run)
- `JWT_SECRET` — signs login tokens; set a random value outside local dev

## API

- `POST /api/generate` — build a mix from a prompt (no auth)
- `POST /api/auth/signup`, `POST /api/auth/login` — `{email, password}` → `{access_token}`
- `GET /api/me` — current user
- `GET|POST /api/mixes`, `GET|DELETE /api/mixes/{id}` — saved mixes

Authenticated routes need `Authorization: Bearer <access_token>`.
