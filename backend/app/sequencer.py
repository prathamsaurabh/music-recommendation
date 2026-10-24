"""Order tracks for a smooth DJ-style arc: compatible keys + gradual BPM drift."""
from __future__ import annotations


def _camelot(track: dict) -> tuple[int, str] | None:
    c = track.get("camelot")
    if not c:
        return None
    try:
        return int(c[:-1]), c[-1]
    except (ValueError, IndexError):
        return None


def _key_cost(a: dict, b: dict) -> float:
    ca, cb = _camelot(a), _camelot(b)
    if ca is None or cb is None:
        return 0.15
    (na, la), (nb, lb) = ca, cb
    hour = min((nb - na) % 12, (na - nb) % 12)
    if hour == 0 and la == lb:
        return 0.0
    if hour == 0:  # relative major/minor
        return 0.1
    if hour == 1:
        return 0.15
    if hour == 2:
        return 0.3
    return 0.5


def _transition_cost(a: dict, b: dict) -> float:
    # Tempo compatibility dominates: key clashes beat-match fine, big pitch
    # shifts don't. Key compatibility only breaks ties between close tempos.
    tempo_gap = abs(b["bpm"] - a["bpm"]) / max(a["bpm"], 1e-6)
    tempo_cost = tempo_gap * 6.0
    if tempo_gap > 0.08:
        tempo_cost += (tempo_gap - 0.08) * 20.0
    energy_cost = max(0.0, a["energy"] - b["energy"]) * 2.0  # slight preference to build up
    return tempo_cost + 0.6 * _key_cost(a, b) + energy_cost


def sequence(tracks: list[dict]) -> list[dict]:
    """Greedy nearest-neighbour ordering starting near the median BPM."""
    if len(tracks) <= 2:
        return tracks
    remaining = tracks[:]
    start = min(remaining, key=lambda t: abs(t["bpm"] - sorted(x["bpm"] for x in remaining)[len(remaining) // 2]))
    remaining.remove(start)
    order = [start]
    while remaining:
        nxt = min(remaining, key=lambda t: _transition_cost(order[-1], t))
        remaining.remove(nxt)
        order.append(nxt)
    return order
