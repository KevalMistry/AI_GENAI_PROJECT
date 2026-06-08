from app.services.resume_rag import ResumeRAGService, analyze_resume, chunk_text, extract_skills


def test_resume_index_extracts_skills_and_searches_relevant_chunks() -> None:
    service = ResumeRAGService()
    resume = (
        "Built FastAPI services with Python and PostgreSQL for interview analytics. "
        "Led React dashboard work with TypeScript. Improved Kubernetes deployment reliability."
    )

    document = service.index_resume("Ada Lovelace", "resume.txt", resume.encode())
    results = service.search(document.resume_id, "backend api python database", top_k=2)

    assert document.candidate_name == "Ada Lovelace"
    assert "fastapi" in document.extracted_skills
    assert results
    assert results[0].resume_id == document.resume_id
    assert results[0].score > 0


def test_personalized_questions_prepend_resume_grounded_prompts() -> None:
    service = ResumeRAGService()
    document = service.index_resume(
        "Grace Hopper",
        "resume.txt",
        (
            "Created Python and FastAPI systems for real-time analytics. "
            "Owned React and Next.js interfaces for recruiters."
        ).encode(),
    )

    _, questions, context = service.generate_personalized_questions(
        document.resume_id,
        role="Backend Engineer",
        level="mid",
        count=3,
    )

    assert context
    assert questions[0].id.startswith("resume-")
    assert "Your resume mentions" in questions[0].text


def test_chunk_text_uses_overlap_for_long_resumes() -> None:
    text = " ".join(f"word{i}" for i in range(120))

    chunks = chunk_text(text, chunk_size=50, overlap=10)

    assert len(chunks) == 3
    assert "word40" in chunks[1]


def test_extract_skills_is_case_insensitive() -> None:
    assert extract_skills("PYTHON, React, and Docker") == ["docker", "python", "react"]


def test_resume_analysis_rewards_job_match_and_quantified_impact() -> None:
    job_description = (
        "We need a Python FastAPI engineer with PostgreSQL, Docker, Kubernetes, "
        "React dashboards, and system design experience."
    )
    strong_resume = (
        "Ada Lovelace\nada@example.com\n+1 555 123 4567\nhttps://github.com/ada\n"
        "Summary\nBackend engineer focused on Python FastAPI systems.\n"
        "Skills\nPython FastAPI PostgreSQL Docker Kubernetes React system design\n"
        "Experience\n- Built FastAPI services with PostgreSQL for 200k users.\n"
        "- Reduced API latency by 45% and improved deployment reliability by 30%.\n"
        "Projects\nCreated recruiter analytics dashboards in React.\n"
        "Education\nBS Computer Science"
    )
    weak_resume = "Ada fixed things and worked on software."

    strong = analyze_resume("Ada", "resume.txt", strong_resume.encode(), job_description)
    weak = analyze_resume("Ada", "resume.txt", weak_resume.encode(), job_description)

    assert strong.ats_score > weak.ats_score
    assert strong.keyword_match_score > weak.keyword_match_score
    assert strong.impact_score > weak.impact_score
    assert "fastapi" in strong.matched_skills
    assert weak.missing_skills
