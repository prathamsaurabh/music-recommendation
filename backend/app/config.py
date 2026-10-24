import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

JAMENDO_CLIENT_ID = os.getenv("JAMENDO_CLIENT_ID", "")
CACHE_DIR = Path(os.getenv("CACHE_DIR", Path(__file__).resolve().parent.parent / "cache"))
CACHE_DIR.mkdir(parents=True, exist_ok=True)

ANALYSIS_SR = 22050
DEFAULT_TRACK_COUNT = 8
MAX_TRACK_COUNT = 20
FADE_BEATS = 8  # crossfade length in beats of the incoming track
