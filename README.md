# AI Interview Based on Candidate Speech

An MVP for a speech-based AI interview platform. Candidates answer interview questions verbally, responses are transcribed, analyzed, scored, and summarized in an end-of-session report.

## Features

- FastAPI backend with REST and WebSocket endpoints
- Streamlit candidate interface
- Resume RAG upload, chunking, local embeddings, semantic search, and resume-grounded questions
- Adaptive follow-up generation based on candidate answers, missing evidence, and resume context
- Vocal tone and confidence analysis for speech rate, hesitations, pauses, and delivery confidence
- Live fact-checking for technical and resume-grounded claims
- Technical sandbox diagnostics for live coding interviews
- Recruiter dashboard rankings, radar metrics, and candidate similarity scoring
- Question bank with role-aware defaults
- Speech-to-text service abstraction with a lightweight fallback
- LLM-ready scoring pipeline with deterministic local scoring fallback
- Report generation with scores, feedback, and visual insights

## Quick Start

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Start the backend:

```bash
uvicorn app.main:app --reload --port 8000
```

Start the React frontend (Vite):

```bash
cd frontend
npm install
npm run dev
```

## Resume RAG Endpoints

- `POST /api/resumes` uploads a resume file with `candidate_name` form data.
- `GET /api/resumes/{resume_id}` returns extracted text, chunks, skills, and summary.
- `POST /api/resumes/{resume_id}/search` retrieves the most relevant resume chunks for a query.
- `POST /api/resumes/{resume_id}/questions` generates resume-grounded interview questions.
- `POST /api/interviews` accepts an optional `resume_id` to seed the interview with personalized questions.

## Adaptive Follow-Up Endpoint

- `POST /api/follow-ups` returns a targeted follow-up question for the latest answer.
- The WebSocket interview channel also supports `follow_up` and `answer_with_follow_up` events.

## WebSocket Voice Protocol

Connect to `ws://localhost:8000/ws/interview/{session_id}` after creating an interview.

- `voice_start` initializes a streaming answer turn with the active question and audio metadata.
- `audio_chunk` sends base64 audio plus an optional browser-generated `partial_transcript`.
- Binary WebSocket frames are accepted as raw audio chunks for provider integrations.
- `voice_turn_end` finalizes transcription, scoring, audio feature extraction, and adaptive follow-up generation.
- `voice_cancel` clears the buffered audio for the current turn.

## Vocal Tone Endpoint

- `POST /api/analyze-tone` scores transcript plus audio features for speech rate, fillers, hesitations, pause ratio, vocal confidence, and tone label.
- WebSocket `voice_turn_result` includes `tone_analysis` and enriches `audio_features` with `vocal_confidence_score`.

## Live Fact-Checking

- `POST /api/fact-check` extracts checkable claims and returns supported, questionable, or contradicted statuses.
- Resume-backed interviews use RAG evidence to support or question candidate claims.
- The WebSocket channel supports a `fact_check` event, and `voice_turn_result` includes `fact_check`.

## Technical Sandbox

- `POST /api/sandbox/check` returns Monaco-ready diagnostics with line, column, severity, message, and rule.
- Supported languages: `python`, `javascript`, and `typescript`.
- The sandbox performs syntax and safety diagnostics only; arbitrary code execution is disabled by default.
- The WebSocket channel supports a `sandbox_check` event and returns `sandbox_result`.

## Recruiter Dashboard

- `GET /api/dashboard` builds a dashboard from reports generated during the current backend process.
- `GET /api/dashboard?role=Backend` filters the dashboard by role text.
- `POST /api/dashboard` accepts explicit `reports` and returns ranked candidates, radar metrics, average score, top candidates, and pairwise similarity.
- Similarity scoring uses local embeddings over interview summaries, transcripts, strengths, and improvement areas.

## Notes

- The MVP is designed to run without paid APIs.
- Resume retrieval currently uses deterministic local embeddings so it works offline. Replace `app/services/resume_rag.py` with Chroma or Pinecone persistence when you are ready to scale beyond process memory.
- If OpenAI or another LLM provider is added later, plug it into `app/services/scoring.py`.
- For production speech-to-text, connect a HuggingFace ASR model, Deepgram, or another streaming provider in `app/services/speech.py`.
