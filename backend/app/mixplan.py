"""Compute tempo curve + per-transition timing for the frontend DJ engine."""
from . import config

MAX_TEMPO_DRIFT = 0.06  # set tempo moves at most ±6% per track
MAX_RATE = 0.08         # never pitch-shift a single track more than ±8%


def _rate_curve(ordered: list[dict]) -> tuple[list[float], list[float]]:
    """Effective set tempo + playbackRate per track, both bounded so the
    pitch shift stays musical."""
    rates = [1.0]
    prev_tempo = ordered[0]["bpm"]
    for t in ordered[1:]:
        target = min(max(t["bpm"], prev_tempo * (1 - MAX_TEMPO_DRIFT)),
                     prev_tempo * (1 + MAX_TEMPO_DRIFT))
        rate = min(max(target / t["bpm"], 1 - MAX_RATE), 1 + MAX_RATE)
        rates.append(round(rate, 4))
        prev_tempo = t["bpm"] * rate
    tempos = [round(t["bpm"] * r, 2) for t, r in zip(ordered, rates)]
    return tempos, rates


def build_mixplan(ordered: list[dict]) -> tuple[list[dict], list[dict]]:
    """Returns (track playback params, transitions). All times are in
    buffer-seconds of the respective track; rates are playbackRate values."""
    tempos, rates = _rate_curve(ordered)

    transitions = []
    for i in range(len(ordered) - 1):
        a, b = ordered[i], ordered[i + 1]
        exit_time = a["mix_out"]
        enter_time = b["mix_in"]
        fade = config.FADE_BEATS * 60.0 / tempos[i + 1]  # wall-clock seconds

        # The outgoing track keeps playing under the fade; make sure it has tail.
        tail_needed = fade * rates[i]
        tail = a["duration"] - exit_time
        if tail < tail_needed + 0.3:
            # Pull the exit back to an earlier bar boundary if the tail is short.
            beats = a.get("beat_times", [])
            earlier = [bt for bt in beats if bt <= exit_time - (tail_needed - tail) - 0.5]
            if earlier:
                exit_time = earlier[-1]
            else:
                fade = max(0.8, (tail - 0.3) / max(rates[i], 0.1))

        transitions.append({
            "from_track": i,
            "to_track": i + 1,
            "exit_time": round(exit_time, 3),
            "enter_time": round(enter_time, 3),
            "fade_beats": config.FADE_BEATS,
            "fade_seconds": round(fade, 3),
        })

    playback = [{"rate": r, "start_offset": round(t["mix_in"], 3)} for t, r in zip(ordered, rates)]
    return playback, transitions
