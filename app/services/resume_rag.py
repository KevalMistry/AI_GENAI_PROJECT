from __future__ import annotations

import hashlib
import math
import re
import zipfile
from collections import Counter
from io import BytesIO
from uuid import uuid4

from app.models import (
    InterviewLevel,
    InterviewQuestion,
    ResumeAnalysisResponse,
    ResumeChunk,
    ResumeDocument,
    ResumeScoreCard,
    ResumeSearchResult,
    ResumeSuggestion,
)
from app.services import llm
from app.services.questions import generate_questions


SKILL_TERMS = {
    # Cloud & DevOps
    "aws", "gcp", "azure", "docker", "kubernetes", "terraform", "ansible", "jenkins", "circleci",
    "github actions", "serverless", "cloud native", "sre", "devops", "prometheus", "grafana", "datadog",
    # Frontend
    "react", "next.js", "vue", "angular", "typescript", "javascript", "tailwind", "html", "css", "sass",
    "web performance", "accessibility", "a11y", "redux", "webpack", "vite",
    # Backend & Architecture
    "python", "fastapi", "django", "flask", "node.js", "node", "graphql", "grpc", "rest api", "microservices",
    "system design", "ci/cd", "git", "agile", "scrum", "oop", "design patterns", "websockets",
    # Databases
    "postgresql", "mysql", "mongodb", "redis", "cassandra", "elasticsearch", "sqlite", "dynamodb", "oracle", "neo4j",
    # Languages
    "java", "c++", "c#", "ruby", "go", "golang", "rust", "php", "swift", "kotlin", "scala", "bash", "shell",
    # AI & Data Science
    "machine learning", "data engineering", "pytorch", "tensorflow", "langchain", "llm", "rag", "pandas", "numpy",
    "scikit-learn", "spark", "hadoop", "data pipelines", "analytics",
    # QA & Testing
    "selenium", "cypress", "playwright", "jest", "mocha", "pytest", "qa", "unit testing",
    # Management
    "leadership", "project management", "product management", "mentorship", "scrum master"
}


SECTION_PATTERNS = {
    "summary": r"\b(summary|profile|objective)\b",
    "experience": r"\b(experience|employment|work history|professional experience)\b",
    "skills": r"\b(skills|technical skills|technologies)\b",
    "education": r"\b(education|degree|university|college)\b",
    "projects": r"\b(projects|portfolio)\b",
}


class ResumeRAGService:
    """Small local RAG index that can be swapped for Chroma/Pinecone later."""

    def __init__(self, embedding_dimensions: int = 384) -> None:
        self.embedding_dimensions = embedding_dimensions
        self._documents: dict[str, ResumeDocument] = {}

    def index_resume(self, candidate_name: str, file_name: str, file_bytes: bytes) -> ResumeDocument:
        raw_text = extract_resume_text(file_name, file_bytes)
        chunks = chunk_text(raw_text)
        resume_id = str(uuid4())
        resume_chunks = [
            ResumeChunk(
                chunk_id=f"{resume_id}-{index}",
                resume_id=resume_id,
                text=chunk,
                embedding=embed_text(chunk, self.embedding_dimensions),
                metadata={"chunk_index": str(index), "file_name": file_name},
            )
            for index, chunk in enumerate(chunks)
        ]
        document = ResumeDocument(
            resume_id=resume_id,
            candidate_name=candidate_name,
            file_name=file_name,
            raw_text=raw_text,
            chunks=resume_chunks,
            extracted_skills=extract_skills(raw_text),
            summary=summarize_resume(raw_text),
        )
        self._documents[resume_id] = document
        return document

    def get_resume(self, resume_id: str) -> ResumeDocument | None:
        return self._documents.get(resume_id)

    def search(self, resume_id: str, query: str, top_k: int = 4) -> list[ResumeSearchResult]:
        document = self._documents.get(resume_id)
        if document is None:
            return []

        query_embedding = embed_text(query, self.embedding_dimensions)
        ranked = sorted(
            (
                ResumeSearchResult(
                    chunk_id=chunk.chunk_id,
                    resume_id=chunk.resume_id,
                    text=chunk.text,
                    score=round(cosine_similarity(query_embedding, chunk.embedding), 4),
                    metadata=chunk.metadata,
                )
                for chunk in document.chunks
            ),
            key=lambda item: item.score,
            reverse=True,
        )
        return ranked[:top_k]

    def generate_personalized_questions(
        self,
        resume_id: str,
        role: str,
        level: InterviewLevel,
        count: int,
    ) -> tuple[ResumeDocument | None, list[InterviewQuestion], list[ResumeSearchResult]]:
        document = self._documents.get(resume_id)
        if document is None:
            return None, [], []

        context_query = f"{role} {' '.join(document.extracted_skills[:8])}"
        context = self.search(resume_id, context_query, top_k=min(4, count))
        base_questions = generate_questions(role, level, count, skills=document.extracted_skills)

        personalized: list[InterviewQuestion] = []
        for index, result in enumerate(context):
            signal = result.text.split(".")[0].strip()
            if not signal:
                continue
            skill_hint = ", ".join(document.extracted_skills[:4]) or "the experience on your resume"
            personalized.append(
                InterviewQuestion(
                    id=f"resume-{resume_id[:8]}-{index}",
                    competency="resume evidence",
                    text=(
                        f"Your resume mentions {skill_hint}. Walk me through the work behind "
                        f"this evidence: {signal}."
                    ),
                    expected_keywords=document.extracted_skills[:6],
                )
            )

        merged = dedupe_questions([*personalized, *base_questions])
        return document, merged[:count], context


def extract_resume_text(file_name: str, file_bytes: bytes) -> str:
    if file_name.lower().endswith(".pdf"):
        text = extract_pdf_text(file_bytes)
    elif file_name.lower().endswith(".docx"):
        text = extract_docx_text(file_bytes)
    else:
        text = file_bytes.decode("utf-8", errors="ignore")

    cleaned = normalize_text(text)
    if not cleaned:
        raise ValueError("The resume did not contain readable text.")
    return cleaned


def extract_pdf_text(file_bytes: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError:
        return file_bytes.decode("utf-8", errors="ignore")

    reader = PdfReader(BytesIO(file_bytes))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def extract_docx_text(file_bytes: bytes) -> str:
    try:
        from xml.etree import ElementTree

        with zipfile.ZipFile(BytesIO(file_bytes)) as archive:
            xml = archive.read("word/document.xml")
        root = ElementTree.fromstring(xml)
    except (KeyError, zipfile.BadZipFile, ElementTree.ParseError):
        return file_bytes.decode("utf-8", errors="ignore")

    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    paragraphs: list[str] = []
    for paragraph in root.findall(".//w:p", namespace):
        text = "".join(node.text or "" for node in paragraph.findall(".//w:t", namespace))
        if text.strip():
            paragraphs.append(text.strip())
    return "\n".join(paragraphs)


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def chunk_text(text: str, chunk_size: int = 900, overlap: int = 140) -> list[str]:
    words = text.split()
    if not words:
        return []

    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = min(len(words), start + chunk_size)
        chunks.append(" ".join(words[start:end]))
        if end == len(words):
            break
        start = max(0, end - overlap)
    return chunks


def extract_skills(text: str) -> list[str]:
    lowered = text.lower()
    found = [skill for skill in sorted(SKILL_TERMS) if term_in_text(skill, lowered)]
    return found[:16]


def resume_experience_score(text: str) -> float:
    lowered = text.lower()
    score = 45.0
    
    # Check for experience section
    if re.search(r"\b(experience|employment|work history|professional experience)\b", lowered):
        score += 15
        
    # Check for date patterns (e.g. 2018-2022, 2021 - Present, etc.)
    dates = len(re.findall(r"\b(19\d{2}|20\d{2})\b\s*[\-–]\s*\b(19\d{2}|20\d{2}|present)\b", lowered))
    score += min(20, dates * 8)
    
    # Check for professional titles (e.g. engineer, developer, lead, manager, architect)
    titles = len(re.findall(r"\b(engineer|developer|programmer|architect|lead|manager|analyst|scientist|consultant)\b", lowered))
    score += min(15, titles * 3)
    
    # Check for duration description (e.g. "3 years", "5+ years", etc.)
    if re.search(r"\b(\d+\+?\s*years?(\s*of)?\s*experience|\d+\+?\s*yrs?)\b", lowered):
        score += 10
        
    return round(clamp_score(score), 1)


def resume_education_score(text: str) -> float:
    lowered = text.lower()
    score = 40.0
    
    # Check for education section
    if re.search(r"\b(education|academic|university|college|degree)\b", lowered):
        score += 15
        
    # Check for degrees
    degrees = ["bachelor", "master", "phd", "ph.d.", "doctorate", "bs", "ms", "b.s.", "m.s.", "b.tech", "m.tech", "computer science"]
    found_degrees = sum(1 for d in degrees if term_in_text(d, lowered))
    score += min(30, found_degrees * 10)
    
    # Check for certifications
    certs = ["certified", "certification", "aws", "pmp", "scrum", "gcp", "azure", "kubernetes", "cka", "ckad", "cissp", "itil"]
    found_certs = sum(1 for c in certs if term_in_text(c, lowered))
    score += min(20, found_certs * 8)
    
    return round(clamp_score(score), 1)


def resume_role_alignment_score(text: str, job_description: str) -> float:
    lowered_text = text.lower()
    lowered_jd = job_description.lower()
    if not lowered_jd.strip():
        return 75.0  # Reasonable default if no JD is provided
        
    score = 50.0
    
    # 1. Check if the target role/title keywords in job description match the resume
    jd_tokens = tokenize(lowered_jd)
    titles = ["software engineer", "frontend engineer", "backend engineer", "full stack developer", "data scientist", "devops engineer", "product manager", "solutions architect"]
    matched_titles = [t for t in titles if t in lowered_jd and t in lowered_text]
    if matched_titles:
        score += 25
    elif any(token in lowered_text for token in jd_tokens if token in ["engineer", "developer", "designer", "architect", "lead", "senior"]):
        score += 15
        
    # 2. Key matching from JD skills
    jd_skills = {skill for skill in SKILL_TERMS if term_in_text(skill, lowered_jd)}
    if jd_skills:
        matched = sum(1 for skill in jd_skills if term_in_text(skill, lowered_text))
        ratio = matched / len(jd_skills)
        score += ratio * 25
        
    return round(clamp_score(score), 1)


def analyze_resume(
    candidate_name: str,
    file_name: str,
    file_bytes: bytes,
    job_description: str = "",
    service: ResumeRAGService | None = None,
) -> ResumeAnalysisResponse:
    document = (service or ResumeRAGService()).index_resume(candidate_name, file_name, file_bytes)
    resume_excerpt = document.raw_text[:12000]
    prompt = (
        "You are an expert AI resume analyzer for hiring and ATS review. "
        "Analyze the resume and, if provided, the job description. Return EXACTLY one JSON object with these keys: "
        "ats_score (0-100), keyword_match_score (0-100), formatting_score (0-100), impact_score (0-100), "
        "section_score (0-100), matched_skills (array of strings), missing_skills (array of strings), "
        "extracted_skills (array of strings), summary (1-3 sentences), score_cards (array of objects with label, value, description), "
        "suggestions (array of objects with type, title, detail). "
        "Use realistic scores and keep the response concise and grounded in the provided resume. "
        f"Candidate name: {candidate_name}. File name: {file_name}. "
        f"Job description: {job_description or 'Not provided'}. "
        f"Resume text: {resume_excerpt}"
    )

    llm_result = llm.complete_json(prompt, timeout=60)
    if not isinstance(llm_result, dict):
        raise RuntimeError("LLM returned an invalid resume analysis payload")

    matched_skills = [str(item) for item in llm_result.get("matched_skills", []) or []]
    missing_skills = [str(item) for item in llm_result.get("missing_skills", []) or []]
    extracted_skills = [str(item) for item in llm_result.get("extracted_skills", []) or []]
    summary = str(llm_result.get("summary") or "").strip()
    if not summary:
        raise RuntimeError("LLM returned an empty resume summary")

    score_cards_data = llm_result.get("score_cards", []) or []
    suggestion_data = llm_result.get("suggestions", []) or []

    score_cards = [
        ResumeScoreCard(
            label=str(item.get("label") or "Insight"),
            value=round(clamp_score(parse_score_value(item.get("value", 0))), 1),
            description=str(item.get("description") or ""),
        )
        for item in score_cards_data
        if isinstance(item, dict)
    ]
    suggestions = [
        ResumeSuggestion(
            type=normalize_suggestion_type(item.get("type")),
            title=str(item.get("title") or "Recommendation"),
            detail=str(item.get("detail") or ""),
        )
        for item in suggestion_data
        if isinstance(item, dict)
    ]

    ats_score = round(clamp_score(parse_score_value(llm_result.get("ats_score", 0))), 1)
    keyword_score = round(clamp_score(parse_score_value(llm_result.get("keyword_match_score", 0))), 1)
    formatting_score = round(clamp_score(parse_score_value(llm_result.get("formatting_score", 0))), 1)
    impact_score = round(clamp_score(parse_score_value(llm_result.get("impact_score", 0))), 1)
    section_score = round(clamp_score(parse_score_value(llm_result.get("section_score", 0))), 1)

    document.summary = summary
    if extracted_skills:
        document.extracted_skills = extracted_skills[:16]

    return ResumeAnalysisResponse(
        resume_id=document.resume_id,
        candidate_name=document.candidate_name,
        file_name=document.file_name,
        ats_score=ats_score,
        keyword_match_score=keyword_score,
        formatting_score=formatting_score,
        impact_score=impact_score,
        section_score=section_score,
        matched_skills=matched_skills[:16],
        missing_skills=missing_skills[:12],
        extracted_skills=extracted_skills[:16],
        summary=summary,
        score_cards=score_cards,
        suggestions=suggestions,
    )


def extract_job_terms(job_description: str) -> list[str]:
    lowered = job_description.lower()
    if not lowered.strip():
        return []

    terms = {skill for skill in SKILL_TERMS if term_in_text(skill, lowered)}
    tokens = [
        token
        for token in tokenize(lowered)
        if len(token) > 2 and token not in COMMON_JOB_WORDS and not token.isdigit()
    ]
    counts = Counter(tokens)
    terms.update(term for term, count in counts.items() if count >= 2)
    return sorted(terms)[:40]


COMMON_JOB_WORDS = {
    "and",
    "are",
    "for",
    "with",
    "you",
    "your",
    "our",
    "the",
    "this",
    "that",
    "will",
    "have",
    "has",
    "from",
    "work",
    "team",
    "role",
    "candidate",
    "experience",
    "years",
    "strong",
    "build",
    "using",
    "ability",
    "knowledge",
    "required",
    "preferred",
}


def keyword_match_score(matched_terms: list[str], job_terms: list[str], extracted_skills: list[str]) -> float:
    if job_terms:
        return round((len(matched_terms) / len(job_terms)) * 100, 1)
    if extracted_skills:
        return min(88.0, round(55 + len(extracted_skills) * 4.5, 1))
    return 45.0


def resume_formatting_score(text: str) -> float:
    words = text.split()
    if not words:
        return 0.0
    score = 70
    if 250 <= len(words) <= 900:
        score += 12
    elif len(words) < 120:
        score -= 18
    if len(re.findall(r"[•\-\*]\s+\w+", text)) >= 3:
        score += 8
    if re.search(r"\b(pdf|docx?)\b", text.lower()):
        score -= 5
    long_lines = [line for line in text.splitlines() if len(line) > 140]
    score -= min(12, len(long_lines) * 3)
    return round(clamp_score(score), 1)


def resume_impact_score(text: str) -> float:
    lowered = text.lower()
    metrics = len(re.findall(r"(\d+%|\$\d+|\d+\s*(x|k|m|million|users|requests|ms|seconds|hours|days))", lowered))
    action_verbs = len(re.findall(r"\b(led|built|created|improved|reduced|increased|delivered|launched|owned|optimized|automated|designed)\b", lowered))
    score = 42 + min(30, metrics * 10) + min(28, action_verbs * 3)
    return round(clamp_score(score), 1)


def resume_section_score(text: str) -> float:
    lowered = text.lower()
    found = sum(1 for pattern in SECTION_PATTERNS.values() if re.search(pattern, lowered))
    return round((found / len(SECTION_PATTERNS)) * 100, 1)


def resume_contact_score(text: str) -> float:
    score = 35
    if re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", text):
        score += 25
    if re.search(r"(\+?\d[\d\s().-]{8,}\d)", text):
        score += 20
    if re.search(r"\b(linkedin|github|portfolio|https?://)\b", text.lower()):
        score += 20
    return round(clamp_score(score), 1)


def resume_suggestions(
    ats_score: float,
    keyword_score: float,
    formatting_score: float,
    impact_score: float,
    section_score: float,
    contact_score: float,
    experience_score: float,
    education_score: float,
    missing_terms: list[str],
) -> list[ResumeSuggestion]:
    suggestions: list[ResumeSuggestion] = []
    
    if ats_score >= 85:
        suggestions.append(ResumeSuggestion(type="success", title="Excellent ATS Match", detail=f"Your resume matches standard ATS formatting and role requirements with an overall score of {ats_score}%."))
    elif ats_score >= 70:
        suggestions.append(ResumeSuggestion(type="success", title="Good ATS Score", detail=f"Solid base score of {ats_score}%. Minor refinements can elevate your profile higher."))
    else:
        suggestions.append(ResumeSuggestion(type="error", title="Optimize for ATS", detail=f"Overall ATS score is low ({ats_score}%). Follow the recommendations below to improve formatting, structure, and keyword alignment."))

    if missing_terms:
        detail_msg = f"Add missing keywords to align with the JD: {', '.join(missing_terms[:5])}."
        suggestions.append(
            ResumeSuggestion(
                type="warning" if keyword_score >= 60 else "error",
                title="Keyword Gaps Detected",
                detail=detail_msg,
            )
        )
    else:
        suggestions.append(ResumeSuggestion(type="success", title="Strong Skill Alignment", detail="Extremely high skill keyword overlap with the target job description."))

    if impact_score < 70:
        suggestions.append(ResumeSuggestion(
            type="warning",
            title="Quantify Project Achievements",
            detail="Integrate metrics (percentages, dollar values, user count, load speeds) to prove the business impact of your work.",
        ))
    else:
        suggestions.append(ResumeSuggestion(
            type="success",
            title="Action-Oriented & Quantified",
            detail="Excellent use of metrics and action verbs to highlight project results.",
        ))

    if experience_score < 70:
        suggestions.append(ResumeSuggestion(
            type="warning",
            title="Refine Career Progression",
            detail="Clearly outline past roles, companies, and date durations. Highlight promotions or senior responsibilities.",
        ))

    if formatting_score < 75:
        suggestions.append(ResumeSuggestion(
            type="error",
            title="Simplify Layout",
            detail="Ensure your resume avoids multi-column layouts, tables, or non-standard fonts. Stick to clean list bullet points.",
        ))

    if education_score < 60:
        suggestions.append(ResumeSuggestion(
            type="warning",
            title="List Degrees & Credentials",
            detail="Clearly document your degrees (e.g. BS in Computer Science) and professional certifications (e.g. AWS/Azure).",
        ))

    return suggestions[:5]


def term_in_text(term: str, lowered_text: str) -> bool:
    escaped = re.escape(term.lower()).replace(r"\ ", r"\s+")
    return re.search(rf"(?<![a-z0-9]){escaped}(?![a-z0-9])", lowered_text) is not None


def clamp_score(value: float) -> float:
    return max(0.0, min(100.0, value))


def parse_score_value(value: object) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        match = re.search(r"\d+(?:\.\d+)?", value)
        if match:
            return float(match.group(0))
    return 0.0


def normalize_suggestion_type(value: object) -> str:
    raw = str(value or "warning").strip().lower()
    if raw in {"success", "warning", "error"}:
        return raw
    if any(token in raw for token in {"positive", "good", "great", "strong", "excellent"}):
        return "success"
    if any(token in raw for token in {"bad", "weak", "poor", "low", "risk", "issue", "error"}):
        return "error"
    return "warning"


def summarize_resume(text: str, max_words: int = 45) -> str:
    words = text.split()
    if len(words) <= max_words:
        return text
    return " ".join(words[:max_words]).rstrip(" ,.;") + "..."


def embed_text(text: str, dimensions: int = 384) -> list[float]:
    tokens = tokenize(text)
    if not tokens:
        return [0.0] * dimensions

    vector = [0.0] * dimensions
    counts = Counter(tokens)
    for token, count in counts.items():
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % dimensions
        sign = 1 if digest[4] % 2 == 0 else -1
        vector[index] += sign * (1 + math.log(count))

    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [round(value / norm, 6) for value in vector]


def tokenize(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z][a-zA-Z0-9.+#-]*", text.lower())


def cosine_similarity(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return max(0.0, min(1.0, dot / (left_norm * right_norm)))


def dedupe_questions(questions: list[InterviewQuestion]) -> list[InterviewQuestion]:
    deduped: list[InterviewQuestion] = []
    seen: set[str] = set()
    for question in questions:
        if question.text in seen:
            continue
        deduped.append(question)
        seen.add(question.text)
    return deduped
