from __future__ import annotations

import re

from app.models import FactCheckClaim, FactCheckReport, FactCheckRequest, ResumeSearchResult
from app.services.resume_rag import ResumeRAGService


TECH_RULES = {
    "python is a compiled language": (
        "contradicted",
        "Python is generally executed by an interpreter/VM workflow, even though bytecode is produced.",
    ),
    "javascript is strongly typed": (
        "contradicted",
        "JavaScript is dynamically typed. TypeScript adds static typing on top of JavaScript.",
    ),
    "http is stateful": (
        "contradicted",
        "HTTP is stateless by design; applications add state with cookies, sessions, or tokens.",
    ),
    "websocket is http polling": (
        "contradicted",
        "WebSocket upgrades an HTTP connection into a persistent full-duplex channel.",
    ),
    "postgresql is nosql": (
        "contradicted",
        "PostgreSQL is primarily a relational database, while also supporting JSON features.",
    ),
    "fastapi is built on starlette": (
        "supported",
        "FastAPI is built on Starlette for the web parts and Pydantic for data validation.",
    ),
    "react is a library": (
        "supported",
        "React is commonly described as a JavaScript library for building user interfaces.",
    ),
    "docker containers share the host kernel": (
        "supported",
        "Docker containers use OS-level isolation and share the host kernel.",
    ),
}

CHECKABLE_MARKERS = (
    "built",
    "created",
    "led",
    "owned",
    "reduced",
    "increased",
    "improved",
    "migrated",
    "deployed",
    "designed",
    "implemented",
    "python",
    "javascript",
    "http",
    "websocket",
    "postgresql",
    "fastapi",
    "react",
    "docker",
)


def fact_check_answer(
    request: FactCheckRequest,
    resume_rag: ResumeRAGService | None = None,
) -> FactCheckReport:
    claims = extract_claims(request.transcript)
    checked_claims = [
        check_claim(claim, request.resume_id, resume_rag)
        for claim in claims
    ]
    score = calculate_accuracy_score(checked_claims)
    return FactCheckReport(
        session_id=request.session_id,
        transcript=request.transcript,
        claims=checked_claims,
        factual_accuracy_score=score,
        summary=build_summary(checked_claims, score),
    )


def extract_claims(transcript: str) -> list[str]:
    sentences = [
        sentence.strip(" \t\n\r,;:")
        for sentence in re.split(r"(?<=[.!?])\s+|\n+", transcript)
        if sentence.strip(" \t\n\r,;:")
    ]
    claims = [
        sentence
        for sentence in sentences
        if is_checkable(sentence)
    ]
    return claims[:8]


def is_checkable(sentence: str) -> bool:
    lowered = sentence.lower()
    if any(marker in lowered for marker in CHECKABLE_MARKERS):
        return True
    if re.search(r"\b\d+(\.\d+)?\s*(%|percent|ms|seconds?|users?|requests?|x)\b", lowered):
        return True
    return False


def check_claim(
    claim: str,
    resume_id: str | None,
    resume_rag: ResumeRAGService | None,
) -> FactCheckClaim:
    normalized = normalize_claim(claim)
    for rule, (status, explanation) in TECH_RULES.items():
        if rule in normalized:
            return FactCheckClaim(
                claim_text=claim,
                status=status,
                confidence=0.92,
                explanation=explanation,
            )

    evidence: list[ResumeSearchResult] = []
    if resume_id and resume_rag is not None:
        evidence = resume_rag.search(resume_id, claim, top_k=2)
        best_score = evidence[0].score if evidence else 0
        if best_score >= 0.18:
            return FactCheckClaim(
                claim_text=claim,
                status="supported",
                confidence=min(0.9, round(0.55 + best_score, 2)),
                explanation="The claim aligns with relevant resume evidence.",
                evidence=evidence,
            )
        return FactCheckClaim(
            claim_text=claim,
            status="questionable",
            confidence=0.54,
            explanation="No strong supporting resume evidence was found for this claim.",
            evidence=evidence,
        )

    return FactCheckClaim(
        claim_text=claim,
        status="questionable",
        confidence=0.45,
        explanation="The claim is checkable, but no external or resume evidence source is connected.",
    )


def calculate_accuracy_score(claims: list[FactCheckClaim]) -> float:
    if not claims:
        return 100.0

    weights = {
        "supported": 1.0,
        "not_checkable": 0.85,
        "questionable": 0.55,
        "contradicted": 0.0,
    }
    score = sum(weights[claim.status] for claim in claims) / len(claims) * 100
    return round(score, 1)


def build_summary(claims: list[FactCheckClaim], score: float) -> str:
    if not claims:
        return "No checkable technical or resume claims were detected."

    contradicted = sum(1 for claim in claims if claim.status == "contradicted")
    questionable = sum(1 for claim in claims if claim.status == "questionable")
    supported = sum(1 for claim in claims if claim.status == "supported")

    if contradicted:
        return f"{contradicted} claim(s) appear contradicted; factual accuracy score is {score}."
    if questionable:
        return f"{supported} supported claim(s), {questionable} claim(s) need evidence; score is {score}."
    return f"All detected checkable claims are supported; factual accuracy score is {score}."


def normalize_claim(claim: str) -> str:
    return re.sub(r"\s+", " ", claim.lower()).strip(" .!?")
