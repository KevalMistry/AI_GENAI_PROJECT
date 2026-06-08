from __future__ import annotations

from app.models import AnswerAnalysis, InterviewReport, InterviewSession, ScoreBreakdown
from app.services import llm


def build_report(session: InterviewSession, analyses: list[AnswerAnalysis]) -> InterviewReport:
    analysis_payload = [analysis.model_dump(mode="json") for analysis in analyses]
    prompt = (
        "You are an expert interview evaluator. Review the full mock interview and produce a compact JSON object. "
        "Use the completed answer analyses as the source of truth, then synthesize a final interview report. "
        "Return EXACTLY one JSON object with these keys: overall_score (0-100), recommendation (short phrase), "
        "category_scores (object with relevance, fluency, confidence, clarity, emotional_tone), summary (1-3 sentences). "
        "Keep the summary specific to the candidate and role, and do not include markdown. "
        f"Candidate: {session.profile.candidate_name}. Role: {session.profile.role}. "
        f"Level: {session.profile.level}. Analyses JSON: {analysis_payload}"
    )

    llm_result = llm.complete_json(prompt, timeout=60)
    if not isinstance(llm_result, dict):
        raise RuntimeError("LLM returned an invalid report payload")

    category_scores_data = llm_result.get("category_scores", {})
    category_scores = ScoreBreakdown(
        relevance=float(category_scores_data.get("relevance", 0)),
        fluency=float(category_scores_data.get("fluency", 0)),
        confidence=float(category_scores_data.get("confidence", 0)),
        clarity=float(category_scores_data.get("clarity", 0)),
        emotional_tone=float(category_scores_data.get("emotional_tone", 0)),
    )

    overall_score = float(llm_result.get("overall_score", 0))
    recommendation = str(llm_result.get("recommendation") or "Proceed to next round")
    summary = str(llm_result.get("summary") or "")

    if not summary:
        raise RuntimeError("LLM returned an empty report summary")

    return InterviewReport(
        session_id=session.session_id,
        candidate_name=session.profile.candidate_name,
        role=session.profile.role,
        resume_id=session.profile.resume_id,
        overall_score=overall_score,
        recommendation=recommendation,
        category_scores=category_scores,
        analyses=analyses,
        summary=summary,
    )
