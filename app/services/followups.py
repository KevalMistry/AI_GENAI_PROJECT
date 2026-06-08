from __future__ import annotations

import re
from uuid import uuid4

from app.models import (
    AdaptiveFollowUpRequest,
    AdaptiveFollowUpResponse,
    InterviewQuestion,
    ResumeSearchResult,
)
from app.services.resume_rag import ResumeRAGService


EVIDENCE_TERMS = {
    "metric",
    "measured",
    "percent",
    "percentage",
    "reduced",
    "increased",
    "latency",
    "revenue",
    "users",
    "scale",
    "impact",
    "result",
}

TRADEOFF_TERMS = {
    "tradeoff",
    "alternative",
    "because",
    "risk",
    "constraint",
    "compared",
    "decision",
    "chose",
}

OWNERSHIP_TERMS = {
    "i",
    "owned",
    "led",
    "designed",
    "implemented",
    "debugged",
    "shipped",
}


def generate_follow_up(
    request: AdaptiveFollowUpRequest,
    resume_rag: ResumeRAGService | None = None,
) -> AdaptiveFollowUpResponse:
    words = _words(request.transcript)
    lower_text = request.transcript.lower()
    gaps = detect_answer_gaps(request.question, request.transcript)
    context: list[ResumeSearchResult] = []

    if request.resume_id and resume_rag is not None:
        context = resume_rag.search(
            request.resume_id,
            f"{request.question.text} {request.transcript}",
            top_k=3,
        )
        if context and "resume evidence" not in gaps:
            gaps.append("resume evidence")

    follow_up_text = build_follow_up_prompt(
        request.question,
        lower_text,
        gaps,
        context,
        request.role,
    )
    expected_keywords = derive_expected_keywords(request.question, gaps, context, words)

    follow_up = InterviewQuestion(
        id=f"follow-up-{uuid4().hex[:10]}",
        text=follow_up_text,
        competency=f"follow-up: {request.question.competency}",
        expected_keywords=expected_keywords,
    )
    return AdaptiveFollowUpResponse(
        follow_up_question=follow_up,
        reason=build_reason(gaps, context),
        detected_gaps=gaps,
        resume_context=context,
    )


def detect_answer_gaps(question: InterviewQuestion, transcript: str) -> list[str]:
    words = _words(transcript)
    word_set = set(words)
    lower_text = transcript.lower()
    gaps: list[str] = []

    missing_keywords = [
        keyword
        for keyword in question.expected_keywords
        if keyword.lower() not in lower_text
    ]
    if missing_keywords:
        gaps.append("question relevance")

    if len(words) < 45:
        gaps.append("specific detail")

    if not any(term in word_set or term in lower_text for term in EVIDENCE_TERMS):
        gaps.append("measurable impact")

    if not any(term in word_set or term in lower_text for term in TRADEOFF_TERMS):
        gaps.append("decision tradeoffs")

    if not any(term in word_set for term in OWNERSHIP_TERMS):
        gaps.append("personal ownership")

    return gaps[:4]


def build_follow_up_prompt(
    question: InterviewQuestion,
    lower_text: str,
    gaps: list[str],
    context: list[ResumeSearchResult],
    role: str,
) -> str:
    if context:
        resume_signal = _compact_context(context[0].text)
        return (
            f"You mentioned part of your experience, and your resume also points to this: "
            f"{resume_signal}. Can you connect that work to your answer, including your exact "
            f"role, one technical decision, and the outcome?"
        )

    if "measurable impact" in gaps:
        return (
            "Can you quantify the outcome of that example? Include the baseline, what changed, "
            "and how you knew the result mattered."
        )

    if "decision tradeoffs" in gaps:
        return (
            f"What alternatives did you consider for that {role} problem, and why did you choose "
            "the approach you described?"
        )

    if "personal ownership" in gaps:
        return "What part did you personally own, and where did you rely on the team?"

    if "specific detail" in gaps:
        return (
            "Can you walk me through that example step by step, from the situation to the final result?"
        )

    if "question relevance" in gaps:
        return (
            f"Bring this back to the original question: {question.text} What is the strongest "
            "example that directly answers it?"
        )

    if "not sure" in lower_text or "maybe" in lower_text:
        return "What would make you more confident in that answer, and how would you verify it?"

    return "What is the hardest follow-on question you would expect me to ask about that example?"


def derive_expected_keywords(
    question: InterviewQuestion,
    gaps: list[str],
    context: list[ResumeSearchResult],
    answer_words: list[str],
) -> list[str]:
    keywords = list(question.expected_keywords[:4])
    gap_keywords = {
        "question relevance": "relevance",
        "specific detail": "example",
        "measurable impact": "metric",
        "decision tradeoffs": "tradeoff",
        "personal ownership": "owned",
        "resume evidence": "resume",
    }
    keywords.extend(gap_keywords[gap] for gap in gaps if gap in gap_keywords)

    if context:
        context_words = _words(context[0].text)
        keywords.extend(word for word in context_words if len(word) > 5 and word not in keywords)

    keywords.extend(word for word in answer_words if len(word) > 7 and word not in keywords)
    return keywords[:8]


def build_reason(gaps: list[str], context: list[ResumeSearchResult]) -> str:
    if context:
        return "Generated from the answer plus the most relevant resume context."
    if gaps:
        return f"Generated to probe missing signal: {', '.join(gaps)}."
    return "Generated to deepen an already relevant answer."


def _words(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z][a-zA-Z0-9.+#-]*", text.lower())


def _compact_context(text: str, max_words: int = 28) -> str:
    words = text.split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words]).rstrip(" ,.;") + "..."
