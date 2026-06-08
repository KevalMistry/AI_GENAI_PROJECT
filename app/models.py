from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


InterviewLevel = Literal["entry", "mid", "senior"]
FactCheckStatus = Literal["supported", "questionable", "contradicted", "not_checkable"]
SandboxLanguage = Literal["python", "javascript", "typescript"]
SandboxSeverity = Literal["info", "warning", "error"]
VoiceStreamEventType = Literal[
    "voice_start",
    "audio_chunk",
    "voice_turn_end",
    "voice_cancel",
]


class CandidateProfile(BaseModel):
    candidate_name: str = Field(default="Candidate", min_length=1)
    role: str = Field(default="Software Engineer", min_length=1)
    level: InterviewLevel = "entry"
    resume_id: str | None = None


class InterviewQuestion(BaseModel):
    id: str
    text: str
    competency: str
    expected_keywords: list[str] = Field(default_factory=list)


class InterviewStartRequest(CandidateProfile):
    question_count: int = Field(default=5, ge=1, le=10)


class InterviewSession(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid4()))
    profile: CandidateProfile
    questions: list[InterviewQuestion]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TranscriptRequest(BaseModel):
    session_id: str | None = None
    question: InterviewQuestion
    transcript: str = Field(min_length=1)
    audio_features: dict[str, float] = Field(default_factory=dict)
    resume_id: str | None = None


class ScoreBreakdown(BaseModel):
    relevance: float = Field(ge=0, le=100)
    fluency: float = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=100)
    clarity: float = Field(ge=0, le=100)
    emotional_tone: float = Field(ge=0, le=100)


class AnswerAnalysis(BaseModel):
    question_id: str
    question: str
    transcript: str
    scores: ScoreBreakdown
    overall_score: float = Field(ge=0, le=100)
    sentiment: str
    strengths: list[str]
    improvements: list[str]
    feedback: str


class InterviewReportRequest(BaseModel):
    session: InterviewSession
    analyses: list[AnswerAnalysis]


class InterviewReport(BaseModel):
    session_id: str
    candidate_name: str
    role: str
    resume_id: str | None = None
    overall_score: float
    recommendation: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    category_scores: ScoreBreakdown
    analyses: list[AnswerAnalysis]
    summary: str


class ResumeUploadResponse(BaseModel):
    resume_id: str
    candidate_name: str
    file_name: str
    chunk_count: int
    extracted_skills: list[str] = Field(default_factory=list)
    summary: str


class ResumeScoreCard(BaseModel):
    label: str
    value: float = Field(ge=0, le=100)
    description: str


class ResumeSuggestion(BaseModel):
    type: Literal["success", "warning", "error"]
    title: str
    detail: str


class ResumeAnalysisResponse(BaseModel):
    resume_id: str
    candidate_name: str
    file_name: str
    ats_score: float = Field(ge=0, le=100)
    keyword_match_score: float = Field(ge=0, le=100)
    formatting_score: float = Field(ge=0, le=100)
    impact_score: float = Field(ge=0, le=100)
    section_score: float = Field(ge=0, le=100)
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    extracted_skills: list[str] = Field(default_factory=list)
    summary: str
    score_cards: list[ResumeScoreCard] = Field(default_factory=list)
    suggestions: list[ResumeSuggestion] = Field(default_factory=list)


class ResumeChunk(BaseModel):
    chunk_id: str
    resume_id: str
    text: str
    embedding: list[float]
    metadata: dict[str, str] = Field(default_factory=dict)


class ResumeDocument(BaseModel):
    resume_id: str = Field(default_factory=lambda: str(uuid4()))
    candidate_name: str = Field(min_length=1)
    file_name: str
    raw_text: str
    chunks: list[ResumeChunk] = Field(default_factory=list)
    extracted_skills: list[str] = Field(default_factory=list)
    summary: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ResumeSearchRequest(BaseModel):
    query: str = Field(min_length=1)
    top_k: int = Field(default=4, ge=1, le=10)


class ResumeSearchResult(BaseModel):
    chunk_id: str
    resume_id: str
    text: str
    score: float = Field(ge=0, le=1)
    metadata: dict[str, str] = Field(default_factory=dict)


class PersonalizedQuestionRequest(BaseModel):
    role: str = Field(default="Software Engineer", min_length=1)
    level: InterviewLevel = "entry"
    count: int = Field(default=5, ge=1, le=10)


class PersonalizedQuestionSet(BaseModel):
    resume_id: str
    candidate_name: str
    questions: list[InterviewQuestion]
    supporting_context: list[ResumeSearchResult] = Field(default_factory=list)


class AdaptiveFollowUpRequest(BaseModel):
    session_id: str | None = None
    question: InterviewQuestion
    transcript: str = Field(min_length=1)
    role: str = Field(default="Software Engineer", min_length=1)
    level: InterviewLevel = "entry"
    resume_id: str | None = None
    previous_turns: list[TranscriptRequest] = Field(default_factory=list)


class AdaptiveFollowUpResponse(BaseModel):
    follow_up_question: InterviewQuestion
    reason: str
    detected_gaps: list[str] = Field(default_factory=list)
    resume_context: list[ResumeSearchResult] = Field(default_factory=list)


class FactCheckRequest(BaseModel):
    session_id: str | None = None
    question: InterviewQuestion | None = None
    transcript: str = Field(min_length=1)
    resume_id: str | None = None
    role: str = Field(default="Software Engineer", min_length=1)


class FactCheckClaim(BaseModel):
    claim_id: str = Field(default_factory=lambda: str(uuid4()))
    claim_text: str
    status: FactCheckStatus
    confidence: float = Field(ge=0, le=1)
    explanation: str
    evidence: list[ResumeSearchResult] = Field(default_factory=list)


class FactCheckReport(BaseModel):
    session_id: str | None = None
    transcript: str
    claims: list[FactCheckClaim] = Field(default_factory=list)
    factual_accuracy_score: float = Field(default=100, ge=0, le=100)
    summary: str = ""


class SandboxDiagnostic(BaseModel):
    line: int = Field(ge=1)
    column: int = Field(ge=1)
    severity: SandboxSeverity
    message: str
    rule: str = "syntax"


class SandboxCheckRequest(BaseModel):
    session_id: str | None = None
    candidate_id: str | None = None
    language: SandboxLanguage = "python"
    code: str = Field(min_length=1)


class SandboxResult(BaseModel):
    submission_id: str = Field(default_factory=lambda: str(uuid4()))
    session_id: str | None = None
    language: SandboxLanguage
    syntax_valid: bool
    diagnostics: list[SandboxDiagnostic] = Field(default_factory=list)
    normalized_code: str = ""
    execution_enabled: bool = False
    runtime_output: str | None = None
    score_hint: float = Field(default=0, ge=0, le=100)
    summary: str = ""


class DashboardRequest(BaseModel):
    role: str | None = None
    reports: list[InterviewReport] = Field(default_factory=list)


class CandidateDashboardCard(BaseModel):
    session_id: str
    candidate_name: str
    role: str
    recommendation: str
    overall_score: float = Field(ge=0, le=100)
    radar_metrics: ScoreBreakdown
    factual_accuracy: float = Field(default=100, ge=0, le=100)
    resume_alignment: float = Field(default=0, ge=0, le=100)
    top_strengths: list[str] = Field(default_factory=list)
    improvement_areas: list[str] = Field(default_factory=list)


class CandidateSimilarity(BaseModel):
    left_session_id: str
    right_session_id: str
    left_candidate_name: str
    right_candidate_name: str
    similarity_score: float = Field(ge=0, le=1)
    shared_signals: list[str] = Field(default_factory=list)
    differentiators: list[str] = Field(default_factory=list)


class RecruiterDashboard(BaseModel):
    role: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    candidates: list[CandidateDashboardCard] = Field(default_factory=list)
    similarity_matrix: list[CandidateSimilarity] = Field(default_factory=list)
    top_candidates: list[str] = Field(default_factory=list)
    average_score: float = Field(default=0, ge=0, le=100)
    summary: str = ""


class VoiceStreamStart(BaseModel):
    question: InterviewQuestion
    audio_format: str = Field(default="audio/webm")
    sample_rate: int = Field(default=48000, ge=8000, le=96000)
    channels: int = Field(default=1, ge=1, le=2)


class VoiceAudioChunk(BaseModel):
    chunk_index: int = Field(ge=0)
    audio_base64: str = ""
    partial_transcript: str | None = None
    is_final: bool = False


class VoiceTurnEnd(BaseModel):
    question: InterviewQuestion | None = None
    transcript: str | None = None
    request_follow_up: bool = True


class VoiceStreamAck(BaseModel):
    session_id: str
    chunk_index: int
    buffered_bytes: int
    partial_transcript: str | None = None


class VocalToneAnalysis(BaseModel):
    duration_seconds: float = Field(default=0, ge=0)
    speech_rate_wpm: float = Field(default=0, ge=0)
    hesitation_count: int = Field(default=0, ge=0)
    filler_word_count: int = Field(default=0, ge=0)
    pause_ratio: float = Field(default=0, ge=0, le=1)
    average_energy: float = Field(default=0, ge=0)
    energy_variability: float = Field(default=0, ge=0)
    confidence_score: float = Field(default=0, ge=0, le=100)
    tone_label: str = "unknown"
    summary: str = ""


class VoiceTurnResult(BaseModel):
    session_id: str
    transcript: str
    audio_features: dict[str, float] = Field(default_factory=dict)
    tone_analysis: VocalToneAnalysis | None = None
    fact_check: FactCheckReport | None = None
    analysis: AnswerAnalysis
    follow_up: AdaptiveFollowUpResponse | None = None


class CoachChatRequest(BaseModel):
    session_id: str
    message: str


class CoachResetRequest(BaseModel):
    session_id: str


class CoachChatResponse(BaseModel):
    coach_id: str
    reply: str


