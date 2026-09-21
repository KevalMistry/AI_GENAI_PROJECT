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
AI Interviewer

An MVP for a speech-based AI interview platform that conducts candidate interviews, analyzes spoken responses, and generates structured candidate insights.

The platform combines speech processing, resume-grounded RAG, adaptive questioning, technical assessment, and candidate reporting into a single interview workflow.

What Problem Does It Solve?

Traditional interview workflows require recruiters or interviewers to manually ask questions, evaluate responses, take notes, and compare candidates.

AI Interviewer explores how these steps can be assisted by an AI-powered interview system that can:

- Personalize questions using a candidate's resume
- Conduct interviews through voice interaction
- Generate adaptive follow-up questions
- Analyze candidate responses
- Check technical and resume-related claims
- Evaluate speech characteristics
- Provide structured candidate reports
- Help recruiters compare candidates

Key Features

🤖 Resume-Grounded AI Interviews

Candidates can upload their resume, which is processed into chunks and indexed using local embeddings.

The system can then retrieve relevant resume information and generate questions grounded in the candidate's background.

🎙️ Speech-Based Interviews

The platform supports voice-based interview sessions through WebSockets.

Candidate responses can be streamed to the backend, transcribed, analyzed, and used to continue the interview.

🔄 Adaptive Follow-Up Questions

Follow-up questions can be generated based on:

- The candidate's latest answer
- Missing evidence
- Resume context
- The current interview question

This allows the interview flow to respond dynamically rather than relying only on a fixed question list.

📊 Speech & Confidence Analysis

The system analyzes speech-related characteristics including:

- Speech rate
- Hesitations
- Filler words
- Pause ratio
- Vocal confidence
- Tone classification

🔎 Technical & Resume Fact-Checking

The platform can extract checkable claims from candidate responses and evaluate them against available evidence.

Resume-grounded interviews can use retrieved resume information to support or question candidate claims.

💻 Technical Interview Sandbox

The system provides diagnostics for technical coding questions.

Supported languages include:

- Python
- JavaScript
- TypeScript

The sandbox performs syntax and safety diagnostics without enabling arbitrary code execution by default.

📈 Recruiter Dashboard

The recruiter dashboard provides structured candidate insights including:

- Candidate rankings
- Interview scores
- Radar-style metrics
- Candidate summaries
- Candidate similarity analysis
- Strengths and improvement areas

📝 Interview Reports

The platform generates structured reports containing scores, feedback, and visual insights that can be used for candidate evaluation.

---

My Contribution

I designed and implemented the backend and AI-oriented components of this MVP, including:

- FastAPI REST APIs
- WebSocket interview communication
- Resume RAG pipeline
- Local embedding-based semantic search
- Resume-grounded question generation
- Adaptive follow-up logic
- Speech analysis pipeline
- Fact-checking workflow
- Technical sandbox diagnostics
- Candidate scoring and reporting
- Recruiter dashboard APIs

---

Architecture

                         ┌──────────────────────┐
                         │   Candidate / Recruiter│
                         │       Interfaces      │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      FastAPI API      │
                         │   REST + WebSockets   │
                         └──────────┬───────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
       ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
       │ Resume RAG  │       │  Interview  │       │   Speech    │
       │   Pipeline  │       │   Engine    │       │  Analysis   │
       └──────┬──────┘       └──────┬──────┘       └──────┬──────┘
              │                     │                     │
              ▼                     ▼                     ▼
       ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
       │ Embeddings  │       │ Follow-ups  │       │  Transcript │
       │ + Semantic  │       │ + Scoring   │       │   Analysis  │
       │   Search    │       │             │       │             │
       └─────────────┘       └─────────────┘       └─────────────┘
                                    │
                    ┌───────────────┼────────────────┐
                    │               │                │
                    ▼               ▼                ▼
             ┌────────────┐  ┌────────────┐  ┌────────────┐
             │ Fact Check │  │  Technical │  │  Reporting │
             │            │  │  Sandbox   │  │ & Dashboard│
             └────────────┘  └────────────┘  └────────────┘

---

Technology Stack

Backend

- Python
- FastAPI
- REST APIs
- WebSockets

AI / GenAI

- Retrieval-Augmented Generation (RAG)
- Local embeddings
- Semantic search
- LLM-ready scoring pipeline
- Hugging Face models

Frontend

- React
- Vite
- Streamlit

AI Application Components

- Resume processing
- Speech-to-text abstraction
- Speech feature analysis
- Adaptive question generation
- Fact checking
- Candidate scoring
- Report generation

---

API Highlights

Resume RAG

POST /api/resumes
GET  /api/resumes/{resume_id}
POST /api/resumes/{resume_id}/search
POST /api/resumes/{resume_id}/questions

Adaptive Follow-Ups

POST /api/follow-ups

Speech Analysis

POST /api/analyze-tone

Fact Checking

POST /api/fact-check

Technical Sandbox

POST /api/sandbox/check

Recruiter Dashboard

GET  /api/dashboard
POST /api/dashboard

Real-Time Interview

WS /ws/interview/{session_id}

---

Quick Start

Create a virtual environment:

python3 -m venv .venv
source .venv/bin/activate

Install dependencies:

pip install -r requirements.txt

Start the backend:

uvicorn app.main:app --reload --port 8000

Start the frontend:

cd frontend
npm install
npm run dev

---

Current MVP Scope

The project is intentionally designed as an MVP and currently runs without requiring paid APIs.

Resume retrieval uses deterministic local embeddings and process-memory storage.

The architecture is designed so external services can be integrated later, including:

- Persistent vector databases
- Production speech-to-text providers
- External LLM providers
- Scalable storage and deployment infrastructure

---

What This Project Demonstrates

This project demonstrates practical experience building an AI application that combines multiple components rather than a standalone chatbot.

Key areas include:

RAG → LLM applications → FastAPI → WebSockets → Speech processing → Semantic search → AI evaluation → APIs → React → Reporting

---

Project Structure

AI Interviewer
├── app/
│   ├── main.py
│   ├── services/
│   └── ...
├── frontend/
├── requirements.txt
└── README.md

---

Author

Keval Mistry

AI / GenAI Engineer focused on building practical AI applications using Python, FastAPI, RAG, LLM APIs, and modern web technologies.

"GitHub" (https://github.com/KevalMistry)
uction speech-to-text, connect a HuggingFace ASR model, Deepgram, or another streaming provider in `app/services/speech.py`.
