"""Map a free-text user prompt onto Jamendo search parameters."""
import re
from dataclasses import dataclass, field

# Ordered: first match wins for the primary genre tag.
GENRE_KEYWORDS = {
    "lofi": ["lofi", "lo-fi", "lo fi", "chillhop", "chill hop", "study beats", "study"],
    "synthwave": ["synthwave", "retrowave", "vaporwave", "outrun", "80s", "eighties"],
    "drumnbass": ["drum and bass", "drum & bass", "dnb", "drumnbass", "jungle"],
    "dubstep": ["dubstep", "brostep"],
    "techno": ["techno", "berlin techno", "minimal techno"],
    "trance": ["trance", "psytrance", "goa"],
    "house": ["house", "deep house", "tech house", "progressive house"],
    "electronic": ["electronic", "edm", "electro", "idm", "electronica"],
    "dance": ["dance", "club", "clubbing", "party"],
    "ambient": ["ambient", "chillout", "chill out", "downtempo", "meditation", "spa", "sleep"],
    "metal": ["metal", "heavy metal", "death metal", "thrash"],
    "punk": ["punk", "hardcore", "pop punk"],
    "indie": ["indie", "indie rock", "indie pop", "alternative"],
    "rock": ["rock", "classic rock", "hard rock", "rock n roll", "rock'n'roll"],
    "jazz": ["jazz", "swing", "bebop", "smooth jazz", "lounge jazz"],
    "hiphop": ["hip hop", "hip-hop", "hiphop", "rap", "trap", "boom bap", "beats"],
    "funk": ["funk", "disco", "groove", "funky"],
    "soul": ["soul", "rnb", "r&b", "neo soul", "motown"],
    "reggae": ["reggae", "dub", "ska", "dancehall"],
    "classical": ["classical", "orchestral", "symphony", "piano sonata", "baroque"],
    "folk": ["folk", "acoustic", "singer-songwriter", "singer songwriter", "americana", "country"],
    "blues": ["blues", "delta blues"],
    "world": ["world", "latin", "afrobeat", "afro", "reggaeton", "bossa nova", "samba", "bhangra"],
    "pop": ["pop", "synthpop", "synth pop", "chart", "top 40", "kpop", "k-pop"],
    "soundtrack": ["soundtrack", "cinematic", "film score", "epic", "movie music", "score"],
    "experimental": ["experimental", "avant garde", "avant-garde", "noise"],
}

# Jamendo tracks endpoint supports these as direct filters.
SPEED_KEYWORDS = {
    "verylow": ["very slow", "sleep", "meditation"],
    "low": ["slow", "calm", "relaxing", "relaxed", "chill", "mellow", "downtempo", "ambient"],
    "medium": [],
    "high": ["fast", "energetic", "upbeat", "workout", "gym", "running", "hype", "pump"],
    "veryhigh": ["very fast", "intense", "hardcore", "extreme", "rave"],
}

MOOD_TAGS = {
    "happy": ["happy", "feel good", "feelgood", "sunshine", "uplifting", "joyful"],
    "sad": ["sad", "melancholy", "heartbreak", "cry", "emo", "blue"],
    "calm": ["relax", "chill", "calm", "peaceful", "unwind"],
    "energetic": ["aggressive", "angry", "rage", "intense", "brutal"],
    "party": ["party", "celebration", "friday night", "dancefloor"],
}


@dataclass
class ResolvedPrompt:
    tags: list[str] = field(default_factory=list)
    params: dict = field(default_factory=dict)
    raw_search: str = ""


def resolve_prompt(prompt: str) -> ResolvedPrompt:
    text = " " + re.sub(r"[^a-z0-9&' ]", " ", prompt.lower()) + " "
    resolved = ResolvedPrompt()

    for tag, words in GENRE_KEYWORDS.items():
        if any(f" {w} " in text or f" {w}s " in text for w in words):
            resolved.tags.append(tag)
        if len(resolved.tags) >= 2:
            break

    for speed, words in SPEED_KEYWORDS.items():
        if any(f" {w} " in text for w in words):
            resolved.params["speed"] = speed
            break

    # Moods go in as fuzzytags — Jamendo's mood* params filter on sparse
    # metadata and routinely return 0 results.
    for tag, words in MOOD_TAGS.items():
        if any(f" {w} " in text for w in words):
            resolved.tags.append(tag)
            break
    resolved.tags = resolved.tags[:3]

    # Activities imply a genre even when no genre word was said.
    ACTIVITY_GENRE = {
        "electronic": ["workout", "gym", "running", "coding", "gaming"],
        "lofi": ["study", "studying", "homework", "focus", "reading"],
        "ambient": ["sleep", "meditation", "yoga", "spa"],
        "dance": ["party", "club", "dancing", "pre-game", "pregame"],
        "rock": ["road trip", "driving", "drive"],
        "jazz": ["dinner", "cooking", "wine", "date night"],
        "classical": ["concentration", "writing", "deep work"],
    }
    if not resolved.tags:
        for tag, words in ACTIVITY_GENRE.items():
            if any(f" {w} " in text for w in words):
                resolved.tags.append(tag)
                break

    if not resolved.tags:
        resolved.raw_search = prompt.strip()
    return resolved
