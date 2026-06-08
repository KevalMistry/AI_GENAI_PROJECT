from app.models import InterviewQuestion
from app.services.scoring import analyze_answer


def test_relevant_structured_answer_scores_higher_than_short_answer() -> None:
    question = InterviewQuestion(
        id="q1",
        text="Describe a difficult technical problem you solved.",
        competency="problem solving",
        expected_keywords=["problem", "approach", "tradeoff", "result"],
    )

    strong = analyze_answer(
        question,
        "First, I defined the problem and measured impact. Then I compared two approaches, "
        "explained the tradeoff to the team, delivered the fix, and monitored the result.",
    )
    weak = analyze_answer(question, "I fixed it.")

    assert strong.overall_score > weak.overall_score
    assert strong.scores.relevance > weak.scores.relevance


def test_uncertainty_reduces_confidence() -> None:
    question = InterviewQuestion(
        id="q2",
        text="How do you prioritize urgent tasks?",
        competency="judgment",
        expected_keywords=["priority", "impact", "deadline"],
    )

    confident = analyze_answer(question, "I rank work by impact, deadline, and stakeholder risk.")
    uncertain = analyze_answer(question, "I think maybe I would probably pick one, but I am not sure.")

    assert confident.scores.confidence > uncertain.scores.confidence
