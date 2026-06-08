from __future__ import annotations

import base64
from dataclasses import dataclass, field

from app.models import InterviewQuestion, VoiceAudioChunk, VoiceStreamAck
from app.services.speech import extract_audio_features, transcribe_audio


@dataclass
class VoiceTurnState:
    session_id: str
    question: InterviewQuestion | None = None
    audio_format: str = "audio/webm"
    sample_rate: int = 48000
    channels: int = 1
    audio_chunks: list[bytes] = field(default_factory=list)
    partial_transcripts: list[str] = field(default_factory=list)

    @property
    def buffered_bytes(self) -> int:
        return sum(len(chunk) for chunk in self.audio_chunks)

    def append_chunk(self, chunk: VoiceAudioChunk) -> VoiceStreamAck:
        audio_bytes = decode_audio_chunk(chunk.audio_base64)
        if audio_bytes:
            self.audio_chunks.append(audio_bytes)
        if chunk.partial_transcript:
            self.partial_transcripts.append(chunk.partial_transcript.strip())

        return VoiceStreamAck(
            session_id=self.session_id,
            chunk_index=chunk.chunk_index,
            buffered_bytes=self.buffered_bytes,
            partial_transcript=self.current_transcript() or None,
        )

    def current_transcript(self) -> str:
        if not self.partial_transcripts:
            return ""
        return " ".join(item for item in self.partial_transcripts if item).strip()

    def audio_bytes(self) -> bytes:
        return b"".join(self.audio_chunks)

    def finalize_transcript(self, provided_transcript: str | None = None) -> str:
        if provided_transcript and provided_transcript.strip():
            return provided_transcript.strip()

        browser_transcript = self.current_transcript()
        if browser_transcript:
            return browser_transcript

        return transcribe_audio(self.audio_bytes(), self.audio_format)

    def audio_features(self) -> dict[str, float]:
        return extract_audio_features(self.audio_bytes())

    def reset(self) -> None:
        self.audio_chunks.clear()
        self.partial_transcripts.clear()


def decode_audio_chunk(audio_base64: str) -> bytes:
    if not audio_base64:
        return b""

    if "," in audio_base64:
        audio_base64 = audio_base64.split(",", 1)[1]

    try:
        return base64.b64decode(audio_base64, validate=False)
    except ValueError:
        return b""
