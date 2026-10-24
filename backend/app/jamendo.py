"""Jamendo API client — search CC-licensed tracks and fetch their audio."""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

import httpx

from . import config
from .prompts import ResolvedPrompt

BASE_URL = "https://api.jamendo.com/v3.0"
_http: httpx.AsyncClient | None = None


def _client() -> httpx.AsyncClient:
    global _http
    if _http is None:
        _http = httpx.AsyncClient(timeout=httpx.Timeout(45.0))
    return _http


class JamendoError(Exception):
    pass


def normalize_track(raw: dict) -> dict:
    tags = (raw.get("musicinfo") or {}).get("tags") or {}
    genres = tags.get("genres") or []
    return {
        "id": str(raw["id"]),
        "name": raw.get("name", "Unknown"),
        "artist": raw.get("artist_name", "Unknown artist"),
        "album_image": raw.get("album_image") or raw.get("image"),
        "duration": float(raw.get("duration") or 0),
        "audio_url": raw.get("audio") or raw.get("audiodownload"),
        "genres": genres,
    }


async def search_tracks(resolved: ResolvedPrompt, limit: int) -> list[dict]:
    if not config.JAMENDO_CLIENT_ID:
        raise JamendoError("JAMENDO_CLIENT_ID is not set — see backend/.env.example")

    base = {
        "client_id": config.JAMENDO_CLIENT_ID,
        "format": "json",
        "limit": limit,
        "include": "musicinfo",
        "audioformat": "mp32",
        "boost": "popularity_month",
        "imagesize": "200",
        "durationbetween": "60_400",
    }
    # Jamendo's `+` fuzzytags is an AND — strict multi-tag queries often come
    # back empty, so fall back from most-specific to broadest.
    attempts = []
    if resolved.tags:
        attempts.append({"fuzzytags": "+".join(resolved.tags), **resolved.params})
        attempts.append({"fuzzytags": resolved.tags[0], **resolved.params})
        attempts.append({"fuzzytags": resolved.tags[0]})
    if resolved.raw_search:
        attempts.append({"search": resolved.raw_search, **resolved.params})
        attempts.append({"search": resolved.raw_search})

    results = []
    for extra in attempts:
        resp = await _client().get(f"{BASE_URL}/tracks/", params={**base, **extra})
        resp.raise_for_status()
        data = resp.json()
        headers = data.get("headers") or {}
        if headers.get("status") == "failed":
            raise JamendoError(headers.get("error_message") or "Jamendo API error")
        results = [normalize_track(t) for t in data.get("results", []) if t.get("audio") or t.get("audiodownload")]
        if results:
            break
    # Dedupe by (artist, name) — Jamendo often lists the same track on several releases.
    seen, unique = set(), []
    for t in results:
        key = (t["artist"].lower(), t["name"].lower())
        if key not in seen:
            seen.add(key)
            unique.append(t)
    return unique


def audio_path(track_id: str) -> Path:
    return config.CACHE_DIR / f"{track_id}.mp3"


def analysis_path(track_id: str) -> Path:
    return config.CACHE_DIR / f"{track_id}.analysis.json"


async def ensure_audio(track: dict) -> Path:
    """Download a track's MP3 into the cache (skips if already fetched)."""
    path = audio_path(track["id"])
    if path.exists() and path.stat().st_size > 10_000:
        return path

    client = _client()
    url = track["audio_url"]
    if "client_id" not in url:
        url += ("&" if "?" in url else "?") + f"client_id={config.JAMENDO_CLIENT_ID}"
    tmp = path.with_suffix(".part")
    async with client.stream("GET", url) as resp:
        resp.raise_for_status()
        with tmp.open("wb") as f:
            async for chunk in resp.aiter_bytes(1 << 16):
                f.write(chunk)
    tmp.rename(path)
    return path


async def download_all(tracks: list[dict]) -> dict[str, Path | Exception]:
    async def one(t: dict):
        try:
            return t["id"], await ensure_audio(t)
        except Exception as e:  # keep going if one download fails
            return t["id"], e

    results = await asyncio.gather(*(one(t) for t in tracks))
    return dict(results)


def load_cached_analysis(track_id: str) -> dict | None:
    p = analysis_path(track_id)
    if p.exists():
        try:
            return json.loads(p.read_text())
        except json.JSONDecodeError:
            return None
    return None


def save_cached_analysis(track_id: str, analysis: dict) -> None:
    analysis_path(track_id).write_text(json.dumps(analysis))
