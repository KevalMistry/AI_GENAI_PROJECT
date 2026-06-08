from app.models import (
    AnswerAnalysis,
    InterviewReport,
    ScoreBreakdown,
)
from app.services.dashboard import build_recruiter_dashboard, compare_candidates


def analysis(
    transcript: str,
    overall: float,
    strengths: list[str],
    improvements: list[str],
) -> AnswerAnalysis:
    return AnswerAnalysis(
        question_id="q",
        question="Describe your work.",
        transcript=transcript,
        scores=ScoreBreakdown(
            relevance=overall,
            fluency=overall,
            confidence=overall,
            clarity=overall,
            emotional_tone=overall,
        ),
        overall_score=overall,
        sentiment="positive",
        strengths=strengths,
        improvements=improvements,
        feedback="feedback",
    )


def report(name: str, session_id: str, role: str, overall: float, transcript: str) -> InterviewReport:
    return InterviewReport(
        session_id=session_id,
        candidate_name=name,
        role=role,
        overall_score=overall,
        recommendation="Proceed to next round",
        category_scores=ScoreBreakdown(
            relevance=overall,
            fluency=overall - 1,
            confidence=overall - 2,
            clarity=overall - 3,
            emotional_tone=overall - 4,
        ),
        analyses=[
            analysis(
                transcript,
                overall,
                ["Technical Depth", "Communication"],
                ["Add metrics"],
            )
        ],
        summary=f"{name} interview summary.",
    )


def test_dashboard_ranks_candidates_and_builds_summary() -> None:
    reports = [
        report("Ada", "s1", "Backend Engineer", 88, "Built FastAPI APIs and reduced latency."),
        report("Grace", "s2", "Backend Engineer", 72, "Built Python services and monitored quality."),
    ]

    dashboard = build_recruiter_dashboard(reports, role="Backend Engineer")

    assert dashboard.average_score == 80
    assert dashboard.top_candidates == ["Ada", "Grace"]
    assert dashboard.candidates[0].candidate_name == "Ada"
    assert dashboard.candidates[0].radar_metrics.relevance == 88
    assert dashboard.similarity_matrix
    assert "Top candidate: Ada" in dashboard.summary


def test_dashboard_filters_by_role() -> None:
    reports = [
        report("Ada", "s1", "Backend Engineer", 88, "Built APIs."),
        report("Linus", "s2", "Frontend Engineer", 91, "Built React UI."),
    ]

    dashboard = build_recruiter_dashboard(reports, role="Frontend")

    assert len(dashboard.candidates) == 1
    assert dashboard.candidates[0].candidate_name == "Linus"


def test_compare_candidates_returns_similarity_metadata() -> None:
    left = report("Ada", "s1", "Backend Engineer", 88, "Built FastAPI APIs.")
    right = report("Grace", "s2", "Backend Engineer", 82, "Built FastAPI APIs.")

    similarity = compare_candidates(left, right)

    assert similarity.similarity_score > 0
    assert "communication" in similarity.shared_signals
