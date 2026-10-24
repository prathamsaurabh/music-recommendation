from typing import Optional

from pydantic import BaseModel


class GenerateRequest(BaseModel):
    prompt: str
    count: int = 8


class TrackOut(BaseModel):
    id: str
    name: str
    artist: str
    album_image: Optional[str]
    duration: float
    audio_url: str
    genres: list[str]
    bpm: float
    key: Optional[str]
    camelot: Optional[str]
    energy: float
    rate: float
    start_offset: float
    waveform: list[float]


class Transition(BaseModel):
    from_track: int
    to_track: int
    exit_time: float
    enter_time: float
    fade_beats: int
    fade_seconds: float


class PlaylistOut(BaseModel):
    prompt: str
    resolved_tags: list[str]
    tracks: list[TrackOut]
    transitions: list[Transition]
