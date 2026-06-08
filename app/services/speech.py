from __future__ import annotations

import io
import math
import wave
from array import array
import speech_recognition as sr
from pydub import AudioSegment


def transcribe_audio(audio_bytes: bytes, filename: str | None = None) -> str:
    """Transcribe audio bytes using Google Speech Recognition."""
    if not audio_bytes:
        return ""

    try:
        audio_segment = AudioSegment.from_file(io.BytesIO(audio_bytes))
        wav_io = io.BytesIO()
        audio_segment.export(wav_io, format="wav")
        wav_io.seek(0)

        recognizer = sr.Recognizer()
        with sr.AudioFile(wav_io) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data)
            return text
    except Exception as e:
        print(f"Transcription error: {e}")
        return ""


def extract_audio_features(audio_bytes: bytes) -> dict[str, float]:
    """Extract WAV features for confidence/tone heuristics."""
    if not audio_bytes:
        return {}

    try:
        audio_segment = AudioSegment.from_file(io.BytesIO(audio_bytes))
        wav_io = io.BytesIO()
        audio_segment.export(wav_io, format="wav")
        wav_io.seek(0)
        with wave.open(wav_io, "rb") as wav:
            frame_count = wav.getnframes()
            sample_width = wav.getsampwidth()
            channels = wav.getnchannels()
            frame_rate = wav.getframerate()
            frames = wav.readframes(frame_count)
    except Exception:
        return {}

    if frame_count == 0 or sample_width != 2:
        return {}

    samples = array("h")
    samples.frombytes(frames)
    if not samples:
        return {}

    if channels > 1:
        samples = array("h", samples[::channels])

    rms = math.sqrt(sum(sample * sample for sample in samples) / len(samples))
    peak = max(abs(sample) for sample in samples) or 1
    silence_ratio = sum(1 for sample in samples if abs(sample) < 400) / len(samples)
    duration_seconds = frame_count / float(frame_rate)
    window_size = max(1, int(frame_rate * 0.25))
    window_energies = [
        math.sqrt(sum(sample * sample for sample in samples[index : index + window_size]) / window_size)
        / 32768.0
        for index in range(0, len(samples) - window_size + 1, window_size)
    ]
    silent_windows = [energy for energy in window_energies if energy < 0.012]
    pause_ratio = len(silent_windows) / len(window_energies) if window_energies else silence_ratio
    long_pause_count = count_long_pauses(window_energies, frame_rate, window_size)
    energy_mean = sum(window_energies) / len(window_energies) if window_energies else 0
    energy_variability = (
        math.sqrt(sum((energy - energy_mean) ** 2 for energy in window_energies) / len(window_energies))
        if window_energies
        else 0
    )

    return {
        "duration_seconds": round(duration_seconds, 2),
        "rms_volume": round(rms / 32768.0, 4),
        "peak_volume": round(peak / 32768.0, 4),
        "silence_ratio": round(silence_ratio, 4),
        "pause_ratio": round(pause_ratio, 4),
        "long_pause_count": float(long_pause_count),
        "energy_variability": round(energy_variability, 4),
    }


def count_long_pauses(window_energies: list[float], frame_rate: int, window_size: int) -> int:
    if not window_energies:
        return 0

    minimum_pause_windows = max(2, math.ceil(0.75 / (window_size / frame_rate)))
    long_pauses = 0
    current = 0
    for energy in window_energies:
        if energy < 0.012:
            current += 1
            continue
        if current >= minimum_pause_windows:
            long_pauses += 1
        current = 0

    if current >= minimum_pause_windows:
        long_pauses += 1
    return long_pauses
