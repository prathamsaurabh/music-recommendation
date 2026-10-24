from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


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


class UserCreate(BaseModel):
    email: str = Field(max_length=320)
    password: str = Field(min_length=8, max_length=72)

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or v.startswith("@") or v.endswith("@"):
            raise ValueError("invalid email address")
        return v


def _assume_utc(v: datetime) -> datetime:
    # SQLite drops tzinfo; stored timestamps are always UTC.
    return v.replace(tzinfo=timezone.utc) if v.tzinfo is None else v


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    created_at: datetime

    _utc_created_at = field_validator("created_at")(_assume_utc)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SavedMixIn(BaseModel):
    mix: PlaylistOut


class SavedMixOut(PlaylistOut):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime

    _utc_created_at = field_validator("created_at")(_assume_utc)
