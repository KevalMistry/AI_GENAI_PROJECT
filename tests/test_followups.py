from app.models import AdaptiveFollowUpRequest, InterviewQuestion
from app.services.followups import detect_answer_gaps, generate_follow_up
from app.services.resume_rag import ResumeRAGService


def test_detect_answer_gaps_flags_short_answer_without_metrics_or_tradeoffs() -> None:
    question = InterviewQuestion(
        id="q1",
        text="Describe a difficult technical problem you solved.",
        competency="problem solving",
        expected_keywords=["problem", "approach", "tradeoff", "result"],
    )

    gaps = detect_answer_gaps(question, "I fixed an API issue with my team.")

    assert "specific detail" in gaps
    assert "measurable impact" in gaps
    assert "decision tradeoffs" in gaps


def test_generate_follow_up_prioritizes_measurable_impact() -> None:
    question = InterviewQuestion(
        id="q2",
        text="How do you make sure your work is reliable?",
        competency="quality",
        expected_keywords=["test", "review", "monitor", "quality"],
    )
    request = AdaptiveFollowUpRequest(
        question=question,
        transcript=(
            "I test the code, review it with teammates, and monitor quality after release. "
            "I owned the implementation because reliability was important."
        ),
    )

    response = generate_follow_up(request)

    assert "quantify" in response.follow_up_question.text.lower()
    assert "measurable impact" in response.detected_gaps
    assert "metric" in response.follow_up_question.expected_keywords


def test_generate_follow_up_uses_resume_context_when_available() -> None:
    service = ResumeRAGService()
    document = service.index_resume(
        "Margaret Hamilton",
        "resume.txt",
        (
            "Built Python FastAPI observability tooling that reduced API incident response "
            "time by 35 percent across production services."
        ).encode(),
    )
    question = InterviewQuestion(
        id="q3",
        text="Tell me about backend reliability work.",
        competency="backend",
        expected_keywords=["api", "reliability", "production"],
    )
    request = AdaptiveFollowUpRequest(
        question=question,
        transcript="I worked on backend services and helped make them better.",
        role="Backend Engineer",
        resume_id=document.resume_id,
    )

    response = generate_follow_up(request, service)

    assert response.resume_context
    assert "resume" in response.follow_up_question.text.lower()
    assert "resume evidence" in response.detected_gaps
