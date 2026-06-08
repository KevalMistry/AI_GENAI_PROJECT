from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_resume_upload_search_and_question_flow() -> None:
    upload_response = client.post(
        "/api/resumes",
        data={"candidate_name": "Katherine Johnson"},
        files={
            "resume": (
                "resume.txt",
                b"Python FastAPI engineer who built analytics APIs and React recruiter dashboards.",
                "text/plain",
            )
        },
    )

    assert upload_response.status_code == 200
    resume_id = upload_response.json()["resume_id"]
    assert "fastapi" in upload_response.json()["extracted_skills"]

    search_response = client.post(
        f"/api/resumes/{resume_id}/search",
        json={"query": "backend analytics api", "top_k": 1},
    )
    assert search_response.status_code == 200
    assert search_response.json()[0]["score"] > 0

    question_response = client.post(
        f"/api/resumes/{resume_id}/questions",
        json={"role": "Backend Engineer", "level": "mid", "count": 2},
    )
    assert question_response.status_code == 200
    assert question_response.json()["questions"][0]["id"].startswith("resume-")


def test_interview_start_uses_resume_questions_when_resume_id_is_supplied() -> None:
    upload_response = client.post(
        "/api/resumes",
        data={"candidate_name": "Dorothy Vaughan"},
        files={
            "resume": (
                "resume.txt",
                b"Python FastAPI platform lead with Docker and Kubernetes production experience.",
                "text/plain",
            )
        },
    )
    resume_id = upload_response.json()["resume_id"]

    interview_response = client.post(
        "/api/interviews",
        json={
            "candidate_name": "Dorothy Vaughan",
            "role": "Backend Engineer",
            "level": "senior",
            "question_count": 2,
            "resume_id": resume_id,
        },
    )

    assert interview_response.status_code == 200
    payload = interview_response.json()
    assert payload["profile"]["resume_id"] == resume_id
    assert payload["questions"][0]["id"].startswith("resume-")


def test_resume_analyze_endpoint_returns_ats_breakdown() -> None:
    response = client.post(
        "/api/resumes/analyze",
        data={
            "candidate_name": "Grace Hopper",
            "job_description": "Python FastAPI PostgreSQL Docker APIs with measurable impact.",
        },
        files={
            "resume": (
                "resume.txt",
                (
                    b"Grace Hopper\ngrace@example.com\nSummary\nPython FastAPI engineer.\n"
                    b"Skills\nPython FastAPI PostgreSQL Docker\nExperience\n"
                    b"- Built APIs for 50k users and reduced latency by 35%.\nEducation\nMS CS"
                ),
                "text/plain",
            )
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ats_score"] > 60
    assert payload["score_cards"][0]["label"] == "ATS Score"
    assert "fastapi" in payload["matched_skills"]


def test_follow_up_endpoint_returns_adaptive_question() -> None:
    response = client.post(
        "/api/follow-ups",
        json={
            "role": "Backend Engineer",
            "level": "mid",
            "question": {
                "id": "q1",
                "text": "Describe a difficult technical problem you solved.",
                "competency": "problem solving",
                "expected_keywords": ["problem", "approach", "tradeoff", "result"],
            },
            "transcript": "I fixed a service issue.",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["follow_up_question"]["id"].startswith("follow-up-")
    assert payload["detected_gaps"]


def test_analyze_tone_endpoint_returns_confidence_profile() -> None:
    response = client.post(
        "/api/analyze-tone",
        json={
            "question": {
                "id": "q-tone",
                "text": "Tell me about a project.",
                "competency": "communication",
                "expected_keywords": ["project"],
            },
            "transcript": "I owned the project and clearly explained the result.",
            "audio_features": {
                "duration_seconds": 4,
                "rms_volume": 0.1,
                "pause_ratio": 0.1,
                "energy_variability": 0.03,
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["speech_rate_wpm"] > 0
    assert payload["confidence_score"] > 0
    assert payload["tone_label"] in {"confident", "steady", "rushed", "hesitant"}


def test_fact_check_endpoint_flags_contradicted_claim() -> None:
    response = client.post(
        "/api/fact-check",
        json={
            "transcript": "HTTP is stateful.",
            "role": "Backend Engineer",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["claims"][0]["status"] == "contradicted"
    assert payload["factual_accuracy_score"] == 0


def test_sandbox_check_endpoint_returns_editor_diagnostics() -> None:
    response = client.post(
        "/api/sandbox/check",
        json={
            "language": "python",
            "code": "open('secret.txt')",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["syntax_valid"] is False
    assert payload["execution_enabled"] is False
    assert payload["diagnostics"][0]["rule"] == "sandbox-call"


def test_dashboard_endpoint_builds_candidate_ranking() -> None:
    report_payload = {
        "session_id": "dash-1",
        "candidate_name": "Ada Lovelace",
        "role": "Backend Engineer",
        "overall_score": 86,
        "recommendation": "Proceed to next round",
        "category_scores": {
            "relevance": 88,
            "fluency": 84,
            "confidence": 82,
            "clarity": 85,
            "emotional_tone": 80,
        },
        "analyses": [
            {
                "question_id": "q1",
                "question": "Describe your backend work.",
                "transcript": "I built FastAPI services and reduced latency.",
                "scores": {
                    "relevance": 88,
                    "fluency": 84,
                    "confidence": 82,
                    "clarity": 85,
                    "emotional_tone": 80,
                },
                "overall_score": 86,
                "sentiment": "positive",
                "strengths": ["Technical Depth"],
                "improvements": ["Add metrics"],
                "feedback": "Strong answer.",
            }
        ],
        "summary": "Ada scored strongly.",
    }

    response = client.post(
        "/api/dashboard",
        json={"role": "Backend", "reports": [report_payload]},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["top_candidates"] == ["Ada Lovelace"]
    assert payload["candidates"][0]["radar_metrics"]["relevance"] == 88
