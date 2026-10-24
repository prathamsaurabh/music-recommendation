"""Audio analysis: BPM, beat grid, FFT energy profile, key, mix-in/out points."""
from __future__ import annotations

from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

from . import config

PITCHES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
MAJOR_PROFILE = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
MINOR_PROFILE = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def _load_mono(path: Path) -> tuple[np.ndarray, int]:
    y, sr = sf.read(str(path), always_2d=True)
    y = y.mean(axis=1).astype(np.float32)
    if sr != config.ANALYSIS_SR:
        y = librosa.resample(y, orig_sr=sr, target_sr=config.ANALYSIS_SR)
        sr = config.ANALYSIS_SR
    return y, sr


def _estimate_key(chroma: np.ndarray) -> tuple[str, int, str] | tuple[None, None, None]:
    """Krumhansl-Schmuckler key estimation -> (label, camelot_num, camelot_letter)."""
    c = chroma.mean(axis=1)
    if c.sum() < 1e-6:
        return None, None, None
    c = (c - c.mean()) / (c.std() + 1e-9)
    best, best_score, best_mode, best_root = None, -2.0, "major", 0
    for profile, mode in ((MAJOR_PROFILE, "major"), (MINOR_PROFILE, "minor")):
        p = (profile - profile.mean()) / (profile.std() + 1e-9)
        for root in range(12):
            score = float(np.corrcoef(c, np.roll(p, root))[0, 1])
            if score > best_score:
                best_score, best_mode, best_root = score, mode, root
    if best_mode == "major":
        fifths = (7 * best_root) % 12
        num, letter = (7 + fifths) % 12 + 1, "B"
    else:
        fifths = (7 * ((best_root + 3) % 12)) % 12
        num, letter = (7 + fifths) % 12 + 1, "A"
    return f"{PITCHES[best_root]} {best_mode}", num, letter


def _beat_grid(y: np.ndarray, sr: int) -> tuple[float, np.ndarray]:
    onset = librosa.onset.onset_strength(y=y, sr=sr)
    tempo, beat_frames = librosa.beat.beat_track(onset_envelope=onset, sr=sr)
    bpm = float(np.atleast_1d(tempo)[0]) if np.size(tempo) else 120.0
    # Fold half/double-time detections into the 90–180 range.
    while bpm < 90:
        bpm *= 2
    while bpm > 180:
        bpm /= 2
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    if len(beat_times) < 16:  # sparse grid — synthesize a steady one
        duration = len(y) / sr
        beat_times = np.arange(0.0, duration, 60.0 / bpm)
    return bpm, beat_times


def _energy_curve(y: np.ndarray, sr: int, beat_times: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """RMS energy (FFT-based STFT magnitude) sampled at each beat."""
    rms = librosa.feature.rms(y=y)[0]
    times = librosa.frames_to_time(np.arange(len(rms)), sr=sr)
    beat_energy = np.interp(beat_times, times, rms) if len(rms) else np.zeros(len(beat_times))
    return times, rms, beat_energy


def _mix_in_point(beat_times: np.ndarray, beat_energy: np.ndarray, duration: float) -> float:
    """First bar boundary where the track actually gets going."""
    if len(beat_times) < 8:
        return 0.0
    med = np.median(beat_energy) or 1e-6
    active = np.nonzero(beat_energy >= 0.45 * med)[0]
    idx = int(active[0]) if len(active) else 0
    idx = (idx // 4) * 4  # snap to bar
    return float(beat_times[min(idx, len(beat_times) - 1)])


def _mix_out_point(
    beat_times: np.ndarray, beat_energy: np.ndarray, duration: float
) -> float:
    """Where the incoming track should enter — ideally the last bar boundary
    before the outro energy drop, leaving >= 8 beats of tail for the fade."""
    n = len(beat_times)
    if n < 16:
        return max(0.0, duration - 10.0)
    med = np.median(beat_energy) or 1e-6
    tail_start = int(n * 0.55)
    drop = np.nonzero(beat_energy[tail_start:] < 0.5 * med)[0]
    target = beat_times[tail_start + drop[0]] if len(drop) else duration * 0.82
    candidates = np.nonzero(beat_times <= target)[0]
    idx = int(candidates[-1]) if len(candidates) else n - 9
    idx = (idx // 4) * 4
    idx = min(idx, n - 9)  # keep a >=8-beat tail
    return float(beat_times[max(idx, 0)])


def analyze_track(path: Path) -> dict:
    y, sr = _load_mono(path)
    duration = float(len(y) / sr)

    bpm, beat_times = _beat_grid(y, sr)
    _, rms, beat_energy = _energy_curve(y, sr, beat_times)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    key, camelot_num, camelot_letter = _estimate_key(chroma)

    return {
        "bpm": round(bpm, 1),
        "duration": duration,
        "key": key,
        "camelot": f"{camelot_num}{camelot_letter}" if camelot_num else None,
        "energy": round(float(np.mean(rms)), 4) if len(rms) else 0.0,
        "mix_in": _mix_in_point(beat_times, beat_energy, duration),
        "mix_out": _mix_out_point(beat_times, beat_energy, duration),
        "beat_times": [round(float(t), 3) for t in beat_times],
        "waveform": [round(float(v), 4) for v in rms[:: max(1, len(rms) // 160)][:160]],
    }
