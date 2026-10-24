from __future__ import annotations

import asyncio

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from . import analyzer, config, jamendo, mixplan, sequencer
from .models import GenerateRequest, PlaylistOut, TrackOut, Transition
from .prompts import resolve_prompt

app = FastAPI(title="PromptMix")
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
