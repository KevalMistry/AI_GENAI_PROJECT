from __future__ import annotations

import json
import os

from fastapi import FastAPI, File, Form, UploadFile, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta

from app.models import (
    AdaptiveFollowUpRequest,
    AdaptiveFollowUpResponse,
    CandidateProfile,
    DashboardRequest,
    FactCheckReport,
    FactCheckRequest,
    InterviewReport,
    InterviewReportRequest,
    InterviewSession,
    InterviewStartRequest,
    PersonalizedQuestionRequest,
    PersonalizedQuestionSet,
    ResumeDocument,
    ResumeAnalysisResponse,
    ResumeSearchRequest,
    ResumeSearchResult,
    ResumeUploadResponse,
    RecruiterDashboard,
    SandboxCheckRequest,
    SandboxResult,
    TranscriptRequest,
    VoiceAudioChunk,
    VoiceStreamStart,
    VocalToneAnalysis,
    VoiceTurnEnd,
    VoiceTurnResult,
    CoachChatRequest,
    CoachChatResponse,
    CoachResetRequest,
)
from app.services.dashboard import build_recruiter_dashboard
from app.services.fact_check import fact_check_answer
from app.services.followups import generate_follow_up
from app.services.questions import generate_questions
from app.services.report import build_report
from app.services.resume_rag import ResumeRAGService
from app.services.resume_rag import analyze_resume
from app.services.sandbox import check_sandbox_code
from app.services.scoring import analyze_answer
from app.services.speech import extract_audio_features, transcribe_audio
from app.services.tone import analyze_vocal_tone
from app.services.voice_stream import VoiceTurnState
from app.services.character_ai import CharacterAIService
from app.services import auth
from app.services.auth import Token, User



app = FastAPI(title="AI Speech Interview Platform", version="0.1.0")

DEFAULT_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
_extra_origins = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = DEFAULT_ORIGINS + [
    origin.strip() for origin in _extra_origins.split(",") if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSIONS: dict[str, InterviewSession] = {}
REPORTS: dict[str, InterviewReport] = {}
RESUME_RAG = ResumeRAGService()
CHARACTER_AI_SERVICE = CharacterAIService()



@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# --- Authentication endpoints ---------------------------------


@app.post('/api/auth/signup')
def signup(payload: dict) -> dict:
    email = payload.get('email')
    password = payload.get('password')
    first_name = payload.get('first_name')
    last_name = payload.get('last_name')
    if not email or not password:
        raise ValueError('email and password required')
    existing = auth.get_user_by_email(email)
    if existing:
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail='User already exists')
    user = auth.create_user(email, password, first_name, last_name)
    access_token = auth.create_access_token({'sub': user.email}, expires_delta=None)
    return {'access_token': access_token, 'token_type': 'bearer', 'user': user.dict()}


@app.post('/api/auth/token', response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = auth.authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=401, detail='Incorrect username or password')
    access_token = auth.create_access_token({'sub': user.email}, expires_delta=timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES))
    return {'access_token': access_token, 'token_type': 'bearer'}


@app.post('/api/auth/logout')
def logout(current_user: User = Depends(auth.get_current_user)) -> dict:
    # Stateless JWTs: client should discard token. We simply acknowledge.
    return {'status': 'success'}


@app.get('/api/auth/me', response_model=User)
def get_me(current_user: User = Depends(auth.get_current_user)) -> User:
    return current_user



@app.post("/api/interviews", response_model=InterviewSession)
def start_interview(request: InterviewStartRequest) -> InterviewSession:
    profile = CandidateProfile(
        candidate_name=request.candidate_name,
        role=request.role,
        level=request.level,
        resume_id=request.resume_id,
    )
    try:
        questions = generate_questions(request.role, request.level, request.question_count)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    if request.resume_id:
        try:
            _, personalized_questions, _ = RESUME_RAG.generate_personalized_questions(
                request.resume_id,
                request.role,
                request.level,
                request.question_count,
            )
            if personalized_questions:
                questions = personalized_questions
        except RuntimeError:
            # Keep the AI interview available even if resume context retrieval fails.
            pass

    session = InterviewSession(
        profile=profile,
        questions=questions,
    )
    SESSIONS[session.session_id] = session
    return session


@app.post("/api/resumes", response_model=ResumeUploadResponse)
async def upload_resume(
    candidate_name: str = Form(...),
    resume: UploadFile = File(...),
) -> ResumeUploadResponse:
    file_bytes = await resume.read()
    document = RESUME_RAG.index_resume(candidate_name, resume.filename or "resume", file_bytes)
    return ResumeUploadResponse(
        resume_id=document.resume_id,
        candidate_name=document.candidate_name,
        file_name=document.file_name,
        chunk_count=len(document.chunks),
        extracted_skills=document.extracted_skills,
        summary=document.summary,
    )


@app.post("/api/resumes/analyze", response_model=ResumeAnalysisResponse)
async def analyze_resume_upload(
    candidate_name: str = Form(default="Candidate"),
    job_description: str = Form(default=""),
    resume: UploadFile = File(...),
) -> ResumeAnalysisResponse:
    file_bytes = await resume.read()
    try:
        return analyze_resume(
            candidate_name=candidate_name,
            file_name=resume.filename or "resume",
            file_bytes=file_bytes,
            job_description=job_description,
            service=RESUME_RAG,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/resumes/{resume_id}", response_model=ResumeDocument)
def get_resume(resume_id: str) -> ResumeDocument:
    from fastapi import HTTPException

    document = RESUME_RAG.get_resume(resume_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Resume not found")
    return document


@app.post("/api/resumes/{resume_id}/search", response_model=list[ResumeSearchResult])
def search_resume(resume_id: str, request: ResumeSearchRequest) -> list[ResumeSearchResult]:
    from fastapi import HTTPException

    if RESUME_RAG.get_resume(resume_id) is None:
        raise HTTPException(status_code=404, detail="Resume not found")
    return RESUME_RAG.search(resume_id, request.query, request.top_k)


@app.post("/api/resumes/{resume_id}/questions", response_model=PersonalizedQuestionSet)
def create_resume_questions(
    resume_id: str,
    request: PersonalizedQuestionRequest,
) -> PersonalizedQuestionSet:
    from fastapi import HTTPException

    document, questions, context = RESUME_RAG.generate_personalized_questions(
        resume_id,
        request.role,
        request.level,
        request.count,
    )
    if document is None:
        raise HTTPException(status_code=404, detail="Resume not found")

    return PersonalizedQuestionSet(
        resume_id=document.resume_id,
        candidate_name=document.candidate_name,
        questions=questions,
        supporting_context=context,
    )


@app.post("/api/analyze-text")
def analyze_text(request: TranscriptRequest):
    try:
        return analyze_answer(request.question, request.transcript, request.audio_features)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/follow-ups", response_model=AdaptiveFollowUpResponse)
def create_follow_up(request: AdaptiveFollowUpRequest) -> AdaptiveFollowUpResponse:
    return generate_follow_up(request, RESUME_RAG)


@app.post("/api/analyze-tone", response_model=VocalToneAnalysis)
def analyze_tone(request: TranscriptRequest) -> VocalToneAnalysis:
    return analyze_vocal_tone(request.transcript, request.audio_features)


@app.post("/api/fact-check", response_model=FactCheckReport)
def fact_check(request: FactCheckRequest) -> FactCheckReport:
    return fact_check_answer(request, RESUME_RAG)


@app.post("/api/sandbox/check", response_model=SandboxResult)
def check_sandbox(request: SandboxCheckRequest) -> SandboxResult:
    return check_sandbox_code(request)


@app.post("/api/analyze-audio")
async def analyze_audio(
    question_json: str = Form(...),
    audio: UploadFile = File(...),
):
    from app.models import InterviewQuestion

    question = InterviewQuestion.model_validate_json(question_json)
    audio_bytes = await audio.read()
    audio_features = extract_audio_features(audio_bytes)
    transcript = transcribe_audio(audio_bytes, audio.filename)
    # The user requested that recorded audio answers should also be typed into the transcript field.
    # While the frontend already shows a live transcript, we return both the analysis and the final transcript here.
    tone_analysis = analyze_vocal_tone(transcript, audio_features)
    audio_features = enrich_audio_features(audio_features, tone_analysis)
    try:
        analysis = analyze_answer(question, transcript, audio_features)
        # We append the final backend transcript to the response so the frontend can display/save it if needed.
        result = analysis.dict()
        result["final_transcript"] = transcript
        return result
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/api/reports", response_model=InterviewReport)
def create_report(request: InterviewReportRequest) -> InterviewReport:
    try:
        report = build_report(request.session, request.analyses)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    REPORTS[report.session_id] = report
    return report


@app.post("/api/dashboard", response_model=RecruiterDashboard)
def create_dashboard(request: DashboardRequest) -> RecruiterDashboard:
    reports = request.reports or list(REPORTS.values())
    return build_recruiter_dashboard(reports, RESUME_RAG, request.role)


@app.get("/api/dashboard", response_model=RecruiterDashboard)
def get_dashboard(role: str | None = None) -> RecruiterDashboard:
    return build_recruiter_dashboard(list(REPORTS.values()), RESUME_RAG, role)


@app.get("/api/coaches")
def list_coaches() -> list[dict[str, Any]]:
    from typing import Any
    return CHARACTER_AI_SERVICE.get_coaches()


@app.post("/api/coaches/{coach_id}/chat", response_model=CoachChatResponse)
async def coach_chat(coach_id: str, request: CoachChatRequest) -> CoachChatResponse:
    reply = await CHARACTER_AI_SERVICE.send_message(
        session_id=request.session_id,
        coach_id=coach_id,
        message=request.message,
    )
    return CoachChatResponse(coach_id=coach_id, reply=reply)


@app.post("/api/coaches/{coach_id}/reset")
async def reset_coach_chat(coach_id: str, request: CoachResetRequest) -> dict[str, str]:
    success = await CHARACTER_AI_SERVICE.reset_chat(
        session_id=request.session_id,
        coach_id=coach_id,
    )
    return {"status": "success" if success else "failed"}


@app.websocket("/ws/interview/{session_id}")

async def interview_socket(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    session = SESSIONS.get(session_id)
    if session is None:
        await websocket.send_json({"type": "error", "message": "Unknown session"})
        await websocket.close()
        return

    await websocket.send_json({"type": "session", "session": session.model_dump(mode="json")})
    voice_state = VoiceTurnState(session_id=session_id)

    try:
        while True:
            payload = await receive_websocket_payload(websocket)

            if payload.get("type") == "binary_audio":
                voice_state.audio_chunks.append(payload["data"])
                await websocket.send_json(
                    {
                        "type": "audio_ack",
                        "ack": {
                            "session_id": session_id,
                            "chunk_index": -1,
                            "buffered_bytes": voice_state.buffered_bytes,
                            "partial_transcript": voice_state.current_transcript() or None,
                        },
                    }
                )
                continue

            if payload.get("type") == "answer":
                request = TranscriptRequest.model_validate(payload["data"])
                try:
                    analysis = analyze_answer(request.question, request.transcript, request.audio_features)
                except RuntimeError as exc:
                    await websocket.send_json({"type": "error", "message": str(exc)})
                    continue
                await websocket.send_json({"type": "analysis", "analysis": analysis.model_dump(mode="json")})
                continue

            if payload.get("type") == "follow_up":
                request = AdaptiveFollowUpRequest.model_validate(payload["data"])
                follow_up = generate_follow_up(request, RESUME_RAG)
                await websocket.send_json(
                    {"type": "follow_up", "follow_up": follow_up.model_dump(mode="json")}
                )
                continue

            if payload.get("type") == "answer_with_follow_up":
                transcript_request = TranscriptRequest.model_validate(payload["data"])
                try:
                    analysis = analyze_answer(
                        transcript_request.question,
                        transcript_request.transcript,
                        transcript_request.audio_features,
                    )
                except RuntimeError as exc:
                    await websocket.send_json({"type": "error", "message": str(exc)})
                    continue
                follow_up_request = AdaptiveFollowUpRequest(
                    session_id=transcript_request.session_id,
                    question=transcript_request.question,
                    transcript=transcript_request.transcript,
                    role=session.profile.role,
                    level=session.profile.level,
                    resume_id=transcript_request.resume_id or session.profile.resume_id,
                )
                follow_up = generate_follow_up(follow_up_request, RESUME_RAG)
                await websocket.send_json(
                    {
                        "type": "analysis_with_follow_up",
                        "analysis": analysis.model_dump(mode="json"),
                        "follow_up": follow_up.model_dump(mode="json"),
                    }
                )
                continue

            if payload.get("type") == "fact_check":
                request = FactCheckRequest.model_validate(payload["data"])
                report = fact_check_answer(request, RESUME_RAG)
                await websocket.send_json(
                    {"type": "fact_check", "fact_check": report.model_dump(mode="json")}
                )
                continue

            if payload.get("type") == "sandbox_check":
                request = SandboxCheckRequest.model_validate(payload["data"])
                result = check_sandbox_code(request)
                await websocket.send_json(
                    {"type": "sandbox_result", "sandbox": result.model_dump(mode="json")}
                )
                continue

            if payload.get("type") == "voice_start":
                request = VoiceStreamStart.model_validate(payload["data"])
                voice_state = VoiceTurnState(
                    session_id=session_id,
                    question=request.question,
                    audio_format=request.audio_format,
                    sample_rate=request.sample_rate,
                    channels=request.channels,
                )
                await websocket.send_json(
                    {
                        "type": "voice_ready",
                        "voice": {
                            "session_id": session_id,
                            "audio_format": voice_state.audio_format,
                            "sample_rate": voice_state.sample_rate,
                            "channels": voice_state.channels,
                            "question": request.question.model_dump(mode="json"),
                        },
                    }
                )
                continue

            if payload.get("type") == "audio_chunk":
                chunk = VoiceAudioChunk.model_validate(payload["data"])
                ack = voice_state.append_chunk(chunk)
                await websocket.send_json({"type": "audio_ack", "ack": ack.model_dump(mode="json")})
                if chunk.is_final:
                    result = finalize_voice_turn(voice_state, session, VoiceTurnEnd())
                    await websocket.send_json(
                        {"type": "voice_turn_result", "result": result.model_dump(mode="json")}
                    )
                    voice_state.reset()
                continue

            if payload.get("type") == "voice_turn_end":
                request = VoiceTurnEnd.model_validate(payload.get("data") or {})
                try:
                    result = finalize_voice_turn(voice_state, session, request)
                except RuntimeError as exc:
                    await websocket.send_json({"type": "error", "message": str(exc)})
                    continue
                await websocket.send_json(
                    {"type": "voice_turn_result", "result": result.model_dump(mode="json")}
                )
                voice_state.reset()
                continue

            if payload.get("type") == "voice_cancel":
                voice_state.reset()
                await websocket.send_json({"type": "voice_cancelled", "session_id": session_id})
                continue

            if payload.get("type") != "answer":
                await websocket.send_json({"type": "error", "message": "Unsupported event"})
                continue
    except WebSocketDisconnect:
        return


async def receive_websocket_payload(websocket: WebSocket) -> dict:
    message = await websocket.receive()
    if message.get("type") == "websocket.disconnect":
        raise WebSocketDisconnect

    if message.get("bytes") is not None:
        return {"type": "binary_audio", "data": message["bytes"]}

    text = message.get("text")
    if not text:
        return {"type": "error", "data": {}}

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"type": "error", "data": {}}


def finalize_voice_turn(
    voice_state: VoiceTurnState,
    session: InterviewSession,
    request: VoiceTurnEnd,
) -> VoiceTurnResult:
    question = request.question or voice_state.question or session.questions[0]
    transcript = voice_state.finalize_transcript(request.transcript)
    if not transcript:
        transcript = "No transcript was produced for this audio turn."

    audio_features = voice_state.audio_features()
    tone_analysis = analyze_vocal_tone(transcript, audio_features)
    audio_features = enrich_audio_features(audio_features, tone_analysis)
    analysis = analyze_answer(question, transcript, audio_features)
    fact_check = fact_check_answer(
        FactCheckRequest(
            session_id=session.session_id,
            question=question,
            transcript=transcript,
            resume_id=session.profile.resume_id,
            role=session.profile.role,
        ),
        RESUME_RAG,
    )
    follow_up = None
    if request.request_follow_up:
        follow_up = generate_follow_up(
            AdaptiveFollowUpRequest(
                session_id=session.session_id,
                question=question,
                transcript=transcript,
                role=session.profile.role,
                level=session.profile.level,
                resume_id=session.profile.resume_id,
            ),
            RESUME_RAG,
        )

    return VoiceTurnResult(
        session_id=session.session_id,
        transcript=transcript,
        audio_features=audio_features,
        tone_analysis=tone_analysis,
        fact_check=fact_check,
        analysis=analysis,
        follow_up=follow_up,
    )


def enrich_audio_features(
    audio_features: dict[str, float],
    tone_analysis: VocalToneAnalysis,
) -> dict[str, float]:
    enriched = dict(audio_features)
    enriched.update(
        {
            "speech_rate_wpm": tone_analysis.speech_rate_wpm,
            "filler_word_count": float(tone_analysis.filler_word_count),
            "hesitation_count": float(tone_analysis.hesitation_count),
            "vocal_confidence_score": tone_analysis.confidence_score,
        }
    )
    return enriched