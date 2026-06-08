from __future__ import annotations

import re
from statistics import mean
from app.models import AnswerAnalysis, InterviewQuestion, ScoreBreakdown
from app.services import llm

FILLERS = {
    "um",
    "uh",
    "like",
    "actually",
    "basically",
    "literally",
    "you know",
    "sort of",
    "kind of",
}

POSITIVE_WORDS = {
    "confident",
    "clear",
    "improved",
    "achieved",
    "delivered",
    "resolved",
    "learned",
    "collaborated",
    "successful",
    "impact",
    "optimized",
    "structured",
    "designed",
    "tested",
}

NEGATIVE_WORDS = {
    "failed",
    "confused",
    "unclear",
    "angry",
    "frustrated",
    "stuck",
    "problem",
    "difficult",
}


def analyze_answer(
    question: InterviewQuestion,
    transcript: str,
    audio_features: dict[str, float] | None = None,
) -> AnswerAnalysis:
    audio_features = audio_features or {}
    llm_result = llm.analyze_answer_via_llm(question.text, transcript, audio_features)
    if not isinstance(llm_result, dict):
        raise RuntimeError("LLM returned an invalid answer analysis payload")

    scores = llm_result.get("scores", {})
    score_obj = ScoreBreakdown(
        relevance=float(scores.get("relevance", 0)),
        fluency=float(scores.get("fluency", 0)),
        confidence=float(scores.get("confidence", 0)),
        clarity=float(scores.get("clarity", 0)),
        emotional_tone=float(scores.get("emotional_tone", 0)),
    )

    return AnswerAnalysis(
        question_id=str(llm_result.get("question_id") or question.id),
        question=str(llm_result.get("question") or question.text),
        transcript=str(llm_result.get("transcript") or transcript),
        scores=score_obj,
        overall_score=float(llm_result.get("overall_score", 0)),
        sentiment=str(llm_result.get("sentiment") or "neutral"),
        strengths=[str(item) for item in llm_result.get("strengths", []) or []],
        improvements=[str(item) for item in llm_result.get("improvements", []) or []],
        feedback=str(llm_result.get("feedback") or ""),
    )


def average_scores(analyses: list[AnswerAnalysis]) -> ScoreBreakdown:
    if not analyses:
        return ScoreBreakdown(relevance=0, fluency=0, confidence=0, clarity=0, emotional_tone=0)

    return ScoreBreakdown(
        relevance=round(mean(item.scores.relevance for item in analyses), 1),
        fluency=round(mean(item.scores.fluency for item in analyses), 1),
        confidence=round(mean(item.scores.confidence for item in analyses), 1),
        clarity=round(mean(item.scores.clarity for item in analyses), 1),
        emotional_tone=round(mean(item.scores.emotional_tone for item in analyses), 1),
    )


