import io
import math
import wave
from array import array

from app.services.speech import extract_audio_features
from app.services.tone import analyze_vocal_tone


def make_wav(samples: list[int], frame_rate: int = 16000) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(frame_rate)
        frames = array("h", samples)
        wav.writeframes(frames.tobytes())
    return buffer.getvalue()


def sine_samples(seconds: float, frame_rate: int = 16000, amplitude: int = 6000) -> list[int]:
    count = int(seconds * frame_rate)
    return [
        int(amplitude * math.sin(2 * math.pi * 220 * index / frame_rate))
        for index in range(count)
    ]


def test_extract_audio_features_includes_pause_and_energy_metrics() -> None:
    samples = sine_samples(1.0) + [0] * 16000 + sine_samples(1.0)

    features = extract_audio_features(make_wav(samples))

    assert features["duration_seconds"] == 3.0
    assert features["rms_volume"] > 0
    assert features["pause_ratio"] > 0
    assert features["long_pause_count"] == 1.0
    assert "energy_variability" in features


def test_vocal_tone_scores_confident_delivery_above_hesitant_delivery() -> None:
    confident = analyze_vocal_tone(
        "I owned the design, compared tradeoffs, measured latency, and reduced incidents.",
        {
            "duration_seconds": 5,
            "rms_volume": 0.12,
            "pause_ratio": 0.08,
            "energy_variability": 0.04,
        },
    )
    hesitant = analyze_vocal_tone(
        "Um I think maybe I am not sure.",
        {
            "duration_seconds": 12,
            "rms_volume": 0.01,
            "pause_ratio": 0.7,
            "long_pause_count": 2,
            "energy_variability": 0.4,
        },
    )

    assert confident.confidence_score > hesitant.confidence_score
    assert confident.tone_label in {"confident", "steady"}
    assert hesitant.tone_label == "hesitant"
    assert hesitant.filler_word_count >= 1
    assert hesitant.hesitation_count >= 3
