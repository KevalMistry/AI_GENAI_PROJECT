from __future__ import annotations

from itertools import combinations
from statistics import mean

from app.models import (
    CandidateDashboardCard,
    CandidateSimilarity,
    InterviewReport,
    RecruiterDashboard,
)
from app.services.resume_rag import ResumeRAGService, cosine_similarity, embed_text


def build_recruiter_dashboard(
    reports: list[InterviewReport],
    resume_rag: ResumeRAGService | None = None,
    role: str | None = None,
) -> RecruiterDashboard:
    filtered = filter_reports(reports, role)
    dashboard_role = role or infer_role(filtered)
    cards = [
        build_candidate_card(report, resume_rag)
        for report in filtered
    ]
    similarities = [
        compare_candidates(left, right)
        for left, right in combinations(filtered, 2)
    ]
    top_candidates = [
        card.candidate_name
        for card in sorted(cards, key=lambda item: item.overall_score, reverse=True)[:3]
    ]
    average_score = round(mean(card.overall_score for card in cards), 1) if cards else 0.0

    return RecruiterDashboard(
        role=dashboard_role,
        candidates=sorted(cards, key=lambda item: item.overall_score, reverse=True),
        similarity_matrix=similarities,
        top_candidates=top_candidates,
        average_score=average_score,
        summary=build_dashboard_summary(cards, similarities, dashboard_role),
    )


def filter_reports(reports: list[InterviewReport], role: str | None) -> list[InterviewReport]:
    if not role:
        return reports
    role_lower = role.lower()
    return [report for report in reports if role_lower in report.role.lower()]


def infer_role(reports: list[InterviewReport]) -> str:
    if not reports:
        return "All Roles"
    roles = [report.role for report in reports]
    return max(set(roles), key=roles.count)


def build_candidate_card(
    report: InterviewReport,
    resume_rag: ResumeRAGService | None = None,
) -> CandidateDashboardCard:
    return CandidateDashboardCard(
        session_id=report.session_id,
        candidate_name=report.candidate_name,
        role=report.role,
        recommendation=report.recommendation,
        overall_score=report.overall_score,
        radar_metrics=report.category_scores,
        factual_accuracy=estimate_factual_accuracy(report),
        resume_alignment=estimate_resume_alignment(report, resume_rag),
        top_strengths=top_strengths(report),
        improvement_areas=top_improvements(report),
    )


def compare_candidates(left: InterviewReport, right: InterviewReport) -> CandidateSimilarity:
    left_profile = report_profile_text(left)
    right_profile = report_profile_text(right)
    similarity = round(cosine_similarity(embed_text(left_profile), embed_text(right_profile)), 4)
    left_signals = signal_set(left)
    right_signals = signal_set(right)
    shared = sorted(left_signals & right_signals)[:5]
    differentiators = sorted((left_signals ^ right_signals))[:6]

    return CandidateSimilarity(
        left_session_id=left.session_id,
        right_session_id=right.session_id,
        left_candidate_name=left.candidate_name,
        right_candidate_name=right.candidate_name,
        similarity_score=similarity,
        shared_signals=shared,
        differentiators=differentiators,
    )


def estimate_factual_accuracy(report: InterviewReport) -> float:
    # Full fact-check reports are attached to live voice turns; report-only dashboards
    # infer this conservatively from analysis relevance and clarity.
    values = [
        (analysis.scores.relevance * 0.65) + (analysis.scores.clarity * 0.35)
        for analysis in report.analyses
    ]
    return round(mean(values), 1) if values else 100.0


def estimate_resume_alignment(
    report: InterviewReport,
    resume_rag: ResumeRAGService | None,
) -> float:
    if not report.resume_id or resume_rag is None or resume_rag.get_resume(report.resume_id) is None:
        return round(report.category_scores.relevance, 1)

    query = report_profile_text(report)
    results = resume_rag.search(report.resume_id, query, top_k=3)
    if not results:
        return round(report.category_scores.relevance, 1)
    return round(min(100.0, mean(result.score for result in results) * 100), 1)


def top_strengths(report: InterviewReport) -> list[str]:
    strengths: list[str] = []
    for analysis in sorted(report.analyses, key=lambda item: item.overall_score, reverse=True):
        strengths.extend(analysis.strengths)
    return dedupe_labels(strengths)[:4]


def top_improvements(report: InterviewReport) -> list[str]:
    improvements: list[str] = []
    for analysis in sorted(report.analyses, key=lambda item: item.overall_score):
        improvements.extend(analysis.improvements)
    return dedupe_labels(improvements)[:4]


def report_profile_text(report: InterviewReport) -> str:
    answer_text = " ".join(analysis.transcript for analysis in report.analyses)
    strengths = " ".join(item for analysis in report.analyses for item in analysis.strengths)
    improvements = " ".join(item for analysis in report.analyses for item in analysis.improvements)
    return f"{report.role} {report.summary} {strengths} {improvements} {answer_text}"


def signal_set(report: InterviewReport) -> set[str]:
    labels = set()
    for analysis in report.analyses:
        labels.update(label.lower() for label in analysis.strengths)
        labels.update(label.lower() for label in analysis.improvements)
    score_labels = {
        name.replace("_", " ").lower()
        for name, value in report.category_scores.model_dump().items()
        if value >= 75
    }
    return labels | score_labels


def dedupe_labels(labels: list[str]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for label in labels:
        normalized = label.strip().lower()
        if not normalized or normalized in seen:
            continue
        deduped.append(label)
        seen.add(normalized)
    return deduped


def build_dashboard_summary(
    cards: list[CandidateDashboardCard],
    similarities: list[CandidateSimilarity],
    role: str,
) -> str:
    if not cards:
        return f"No completed candidate reports are available for {role}."

    leader = max(cards, key=lambda item: item.overall_score)
    if similarities:
        closest = max(similarities, key=lambda item: item.similarity_score)
        return (
            f"{len(cards)} candidate(s) reviewed for {role}. Top candidate: "
            f"{leader.candidate_name} at {leader.overall_score}/100. Closest match pair: "
            f"{closest.left_candidate_name} and {closest.right_candidate_name}."
        )

    return (
        f"{len(cards)} candidate(s) reviewed for {role}. Top candidate: "
        f"{leader.candidate_name} at {leader.overall_score}/100."
    )
