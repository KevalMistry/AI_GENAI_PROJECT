from __future__ import annotations

import re

from app.models import VocalToneAnalysis


FILLER_PATTERNS = (
    "um",
    "uh",
    "erm",
    "ah",
    "like",
    "you know",
    "sort of",
    "kind of",
    "basically",
    "actually",
)

HESITATION_PATTERNS = (
    "i think",
    "maybe",
    "probably",
    "not sure",
    "i guess",
    "let me think",
    "how do i say",
)


def analyze_vocal_tone(
    transcript: str,
    audio_features: dict[str, float] | None = None,
) -> VocalToneAnalysis:
    audio_features = audio_features or {}
    words = _words(transcript)
    duration = max(float(audio_features.get("duration_seconds", 0) or 0), 0)
    speech_rate = calculate_speech_rate(len(words), duration)
    filler_count = count_patterns(transcript, FILLER_PATTERNS)
    hesitation_count = count_patterns(transcript, HESITATION_PATTERNS) + int(
        audio_features.get("long_pause_count", 0) or 0
    )
    pause_ratio = _bounded(float(audio_features.get("pause_ratio", audio_features.get("silence_ratio", 0)) or 0))
    average_energy = max(float(audio_features.get("rms_volume", 0) or 0), 0)
    energy_variability = max(float(audio_features.get("energy_variability", 0) or 0), 0)

    confidence_score = score_confidence(
        speech_rate_wpm=speech_rate,
        filler_word_count=filler_count,
        hesitation_count=hesitation_count,
        pause_ratio=pause_ratio,
        average_energy=average_energy,
        energy_variability=energy_variability,
        word_count=len(words),
    )
    tone_label = label_tone(confidence_score, pause_ratio, speech_rate, average_energy)

    return VocalToneAnalysis(
        duration_seconds=round(duration, 2),
        speech_rate_wpm=round(speech_rate, 1),
        hesitation_count=hesitation_count,
        filler_word_count=filler_count,
        pause_ratio=round(pause_ratio, 4),
        average_energy=round(average_energy, 4),
        energy_variability=round(energy_variability, 4),
        confidence_score=confidence_score,
        tone_label=tone_label,
        summary=build_tone_summary(tone_label, speech_rate, filler_count, hesitation_count, pause_ratio),
    )


def calculate_speech_rate(word_count: int, duration_seconds: float) -> float:
    if word_count <= 0 or duration_seconds <= 0:
        return 0.0
    return (word_count / duration_seconds) * 60


def score_confidence(
    speech_rate_wpm: float,
    filler_word_count: int,
    hesitation_count: int,
    pause_ratio: float,
    average_energy: float,
    energy_variability: float,
    word_count: int,
) -> float:
    score = 72.0

    if word_count < 8:
        score -= 14

    if speech_rate_wpm == 0:
        score -= 18
    elif speech_rate_wpm < 95:
        score -= min(16, (95 - speech_rate_wpm) * 0.18)
    elif speech_rate_wpm > 185:
        score -= min(14, (speech_rate_wpm - 185) * 0.12)
    else:
        score += 8

    score -= min(24, filler_word_count * 4)
    score -= min(22, hesitation_count * 5)
    score -= min(24, pause_ratio * 32)

    if average_energy > 0:
        score += min(10, average_energy * 90)
    if energy_variability > 0.35:
        score -= min(10, (energy_variability - 0.35) * 20)

    return round(max(0.0, min(100.0, score)), 1)


def label_tone(
    confidence_score: float,
    pause_ratio: float,
    speech_rate_wpm: float,
    average_energy: float,
) -> str:
    if confidence_score >= 78 and pause_ratio < 0.35:
        return "confident"
    if pause_ratio >= 0.55 or speech_rate_wpm < 75:
        return "hesitant"
    if speech_rate_wpm > 190:
        return "rushed"
    if average_energy == 0 and speech_rate_wpm == 0:
        return "unknown"
    return "steady"


def build_tone_summary(
    tone_label: str,
    speech_rate_wpm: float,
    filler_word_count: int,
    hesitation_count: int,
    pause_ratio: float,
) -> str:
    if tone_label == "confident":
        return "Steady delivery with low hesitation and a strong confidence signal."
    if tone_label == "hesitant":
        return "Delivery shows pauses or uncertainty that may reduce perceived confidence."
    if tone_label == "rushed":
        return "Fast pacing may make the answer harder to follow."
    if tone_label == "unknown":
        return "Not enough audio or transcript signal to estimate vocal tone."

    return (
        f"Steady delivery at {round(speech_rate_wpm)} WPM with "
        f"{filler_word_count} filler words, {hesitation_count} hesitation signals, "
        f"and {round(pause_ratio * 100)}% pause ratio."
    )


def count_patterns(text: str, patterns: tuple[str, ...]) -> int:
    lowered = text.lower()
    return sum(len(re.findall(rf"\b{re.escape(pattern)}\b", lowered)) for pattern in patterns)


def _words(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z][a-zA-Z0-9'+-]*", text.lower())


def _bounded(value: float) -> float:
    return max(0.0, min(1.0, value))
