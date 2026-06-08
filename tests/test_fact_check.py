from app.models import FactCheckRequest
from app.services.fact_check import extract_claims, fact_check_answer
from app.services.resume_rag import ResumeRAGService


def test_extract_claims_ignores_non_checkable_small_talk() -> None:
    claims = extract_claims(
        "I enjoyed the project. I built a FastAPI service that reduced latency by 20 percent."
    )

    assert claims == ["I built a FastAPI service that reduced latency by 20 percent."]


def test_fact_check_flags_contradicted_technical_claim() -> None:
    report = fact_check_answer(
        FactCheckRequest(transcript="Python is a compiled language.")
    )

    assert report.claims[0].status == "contradicted"
    assert report.factual_accuracy_score == 0


def test_fact_check_supports_resume_grounded_claim() -> None:
    service = ResumeRAGService()
    document = service.index_resume(
        "Barbara Liskov",
        "resume.txt",
        b"Built FastAPI services that reduced API latency by 20 percent for recruiter analytics.",
    )

    report = fact_check_answer(
        FactCheckRequest(
            transcript="I built FastAPI services that reduced API latency by 20 percent.",
            resume_id=document.resume_id,
        ),
        service,
    )

    assert report.claims[0].status == "supported"
    assert report.claims[0].evidence
    assert report.factual_accuracy_score == 100


def test_fact_check_marks_resume_claim_questionable_without_evidence() -> None:
    service = ResumeRAGService()
    document = service.index_resume(
        "Frances Allen",
        "resume.txt",
        b"Designed React dashboards for recruiter workflows.",
    )

    report = fact_check_answer(
        FactCheckRequest(
            transcript="I deployed Kubernetes clusters for payment systems.",
            resume_id=document.resume_id,
        ),
        service,
    )

    assert report.claims[0].status == "questionable"
    assert report.factual_accuracy_score == 55
