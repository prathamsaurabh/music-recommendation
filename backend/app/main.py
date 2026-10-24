from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import analyzer, config, db_models, jamendo, mixplan, sequencer
from .auth import create_access_token, get_current_user, get_password_hash, verify_password
from .db import Base, engine, get_db
from .models import (
    GenerateRequest,
    PlaylistOut,
    SavedMixIn,
    SavedMixOut,
    Token,
    TrackOut,
    Transition,
    UserCreate,
    UserOut,
)
from .prompts import resolve_prompt


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="PromptMix", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"ok": True, "jamendo_configured": bool(config.JAMENDO_CLIENT_ID)}


@app.get("/api/audio/{track_id}")
def audio(track_id: str):
    path = jamendo.audio_path(track_id)
    if not path.exists():
        raise HTTPException(404, "audio not cached")
    return FileResponse(path, media_type="audio/mpeg")


def _analyze(track: dict) -> dict | None:
    cached = jamendo.load_cached_analysis(track["id"])
    if cached:
        return cached
    path = jamendo.audio_path(track["id"])
    if not path.exists():
        return None
    try:
        analysis = analyzer.analyze_track(path)
    except Exception:
        return None
    jamendo.save_cached_analysis(track["id"], analysis)
    return analysis


@app.post("/api/generate", response_model=PlaylistOut)
async def generate(req: GenerateRequest):
    count = max(2, min(req.count, config.MAX_TRACK_COUNT))
    resolved = resolve_prompt(req.prompt)

    try:
        candidates = await jamendo.search_tracks(resolved, limit=min(count * 3, 60))
    except jamendo.JamendoError as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        raise HTTPException(502, f"Jamendo request failed: {e}")
    if not candidates:
        raise HTTPException(404, "No tracks matched that prompt — try different wording.")

    downloads = await jamendo.download_all(candidates[: count * 2])
    usable = [t for t in candidates[: count * 2] if not isinstance(downloads.get(t["id"]), Exception)][:count]
    if len(usable) < 2:
        raise HTTPException(502, "Track downloads failed — check network/API key.")

    analyses = await asyncio.gather(*(asyncio.to_thread(_analyze, t) for t in usable))
    analyzed = [{**t, **a} for t, a in zip(usable, analyses) if a]
    if len(analyzed) < 2:
        raise HTTPException(502, "Audio analysis failed for all tracks.")

    ordered = sequencer.sequence(analyzed)
    playback, transitions = mixplan.build_mixplan(ordered)

    tracks = [
        TrackOut(
            id=t["id"], name=t["name"], artist=t["artist"],
            album_image=t["album_image"], duration=t["duration"],
            audio_url=f"/api/audio/{t['id']}", genres=t["genres"],
            bpm=t["bpm"], key=t["key"], camelot=t["camelot"], energy=t["energy"],
            rate=playback[i]["rate"], start_offset=playback[i]["start_offset"],
            waveform=t["waveform"],
        )
        for i, t in enumerate(ordered)
    ]
    return PlaylistOut(
        prompt=req.prompt,
        resolved_tags=resolved.tags or ([resolved.raw_search] if resolved.raw_search else []),
        tracks=tracks,
        transitions=[Transition(**tr) for tr in transitions],
    )


@app.post("/api/auth/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
def signup(body: UserCreate, db: Session = Depends(get_db)):
    if db.query(db_models.User).filter(db_models.User.email == body.email).first():
        raise HTTPException(409, "An account with that email already exists.")
    user = db_models.User(email=body.email, hashed_password=get_password_hash(body.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "An account with that email already exists.")
    db.refresh(user)
    return Token(access_token=create_access_token(user.id))


@app.post("/api/auth/login", response_model=Token)
def login(body: UserCreate, db: Session = Depends(get_db)):
    user = db.query(db_models.User).filter(db_models.User.email == body.email).first()
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(401, "Incorrect email or password.", headers={"WWW-Authenticate": "Bearer"})
    return Token(access_token=create_access_token(user.id))


@app.get("/api/me", response_model=UserOut)
def me(user: db_models.User = Depends(get_current_user)):
    return user


def _get_owned_mix(mix_id: int, user: db_models.User, db: Session) -> db_models.SavedMix:
    mix = db.get(db_models.SavedMix, mix_id)
    if mix is None or mix.user_id != user.id:
        raise HTTPException(404, "Mix not found.")
    return mix


@app.post("/api/mixes", response_model=SavedMixOut, status_code=status.HTTP_201_CREATED)
def save_mix(
    body: SavedMixIn,
    user: db_models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    payload = body.mix.model_dump()
    mix = db_models.SavedMix(user_id=user.id, **payload)
    db.add(mix)
    db.commit()
    db.refresh(mix)
    return mix


@app.get("/api/mixes", response_model=list[SavedMixOut])
def list_mixes(user: db_models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return (
        db.query(db_models.SavedMix)
        .filter(db_models.SavedMix.user_id == user.id)
        .order_by(db_models.SavedMix.created_at.desc(), db_models.SavedMix.id.desc())
        .all()
    )


@app.get("/api/mixes/{mix_id}", response_model=SavedMixOut)
def get_mix(mix_id: int, user: db_models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _get_owned_mix(mix_id, user, db)


@app.delete("/api/mixes/{mix_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mix(mix_id: int, user: db_models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(_get_owned_mix(mix_id, user, db))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
