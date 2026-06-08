from __future__ import annotations

import re
from app.models import InterviewLevel, InterviewQuestion
from app.services import llm

TRACK_QUESTIONS = {
    "frontend": [
        {
            "competency": "frontend technology",
            "entry": "In frontend development using {skills}, how do you manage local UI state and ensure components render efficiently?",
            "mid": "Explain how you handle component lifecycles, global state management, and re-render optimization in a large-scale {skills} application.",
            "senior": "Walk me through how you would architect the frontend system of a complex {skills} app to support modular components, fast load times, and state persistence.",
            "keywords": ["state", "render", "component", "optimization", "props", "hook", "dom"]
        },
        {
            "competency": "performance & layout",
            "entry": "What steps do you take to make sure a UI page is responsive on mobile and accessible to keyboard users?",
            "mid": "How do you audit and optimize web performance metrics like Core Web Vitals in a {skills} interface?",
            "senior": "How do you enforce accessibility (a11y) standards, security controls (like XSS protection), and performance budgets across a large {skills} product suite?",
            "keywords": ["responsive", "accessibility", "vitals", "speed", "audit", "a11y", "layout"]
        }
    ],
    "backend": [
        {
            "competency": "backend logic & data",
            "entry": "In backend work using {skills}, how do you validate incoming request payloads and handle exceptions safely?",
            "mid": "How do you structure database queries, transaction pools, and indexes in a {skills} system to minimize latency under concurrent load?",
            "senior": "Architect a resilient, horizontally scalable backend with {skills} that handles high-throughput spikes using caching, message queues, and load balancing.",
            "keywords": ["database", "query", "latency", "scale", "concurrency", "api", "transaction"]
        },
        {
            "competency": "system security & protocols",
            "entry": "What is the difference between REST and WebSockets, and when would you choose to use each in a {skills} service?",
            "mid": "How do you secure backend API endpoints in a {skills} app, considering JWT tokens, CORS, and potential SQL injection?",
            "senior": "Explain how you design replication, cache invalidation, and data consistency models across distributed microservices using {skills}.",
            "keywords": ["security", "rest", "websocket", "cache", "token", "replication", "microservices"]
        }
    ],
    "data": [
        {
            "competency": "data engineering & models",
            "entry": "How do you handle missing values or clean anomalies in a dataset using tools like {skills}?",
            "mid": "Explain how you design robust feature engineering pipelines and validate machine learning models in a {skills} context.",
            "senior": "How would you design a distributed data processing or training pipeline using {skills} to handle terabytes of real-time streaming data?",
            "keywords": ["model", "pipeline", "validation", "cleaning", "features", "training", "pandas"]
        },
        {
            "competency": "analytical judgment",
            "entry": "What metrics do you use to evaluate model performance, and what do they represent?",
            "mid": "How do you detect and address dataset drift or model bias over time in a production {skills} pipeline?",
            "senior": "Explain how you choose and justify model tradeoffs between accuracy, training time, compute cost, and real-time inference latency.",
            "keywords": ["accuracy", "drift", "metrics", "latency", "bias", "inference", "tradeoff"]
        }
    ],
    "manager": [
        {
            "competency": "delivery management",
            "entry": "How do you organize your tasks and update stakeholders when an urgent deadline is at risk?",
            "mid": "How do you estimate timelines, manage sprint scope creep, and negotiate tradeoffs in an agile environment when resources are constrained?",
            "senior": "How do you align cross-functional product roadmaps, manage technical debt, and ensure stable, high-quality delivery across multiple quarters?",
            "keywords": ["deadline", "scope", "stakeholders", "delivery", "roadmap", "debt", "agile"]
        },
        {
            "competency": "people leadership",
            "entry": "Describe how you share feedback with team members to resolve task confusion.",
            "mid": "How do you support an underperforming team member while keeping team morale and overall sprint delivery on track?",
            "senior": "How do you build a culture of high ownership, resolve systemic conflicts, and design growth tracks for engineers?",
            "keywords": ["feedback", "culture", "conflict", "growth", "morale", "ownership", "mentorship"]
        }
    ],
    "general": [
        {
            "competency": "software architecture",
            "entry": "In software development with {skills}, how do you structure your code to keep it readable, clean, and testable?",
            "mid": "How do you design APIs or interface protocols to support loose coupling and easy extensibility?",
            "senior": "Walk me through how you design high-availability system architectures, manage technical debt, and ensure modularity in a {skills} project.",
            "keywords": ["modularity", "clean code", "testing", "api", "architecture", "coupling", "refactoring"]
        },
        {
            "competency": "problem solving & failures",
            "entry": "What steps do you take when debugging a complex issue that you do not yet know how to solve?",
            "mid": "How do you identify and fix memory leaks or runtime performance bottlenecks in a {skills} system?",
            "senior": "Explain a major production incident you diagnosed. What were the root causes, and how did you design a permanent architectural fix?",
            "keywords": ["debugging", "incident", "leak", "root cause", "bottleneck", "fix", "logs"]
        }
    ]
}

BEHAVIORAL_QUESTIONS = {
    "entry": [
        InterviewQuestion(
            id="bh-entry-1",
            competency="learning capacity",
            text="Describe a time you had to learn a new tool or technology quickly to complete a task. What was your approach?",
            expected_keywords=["learned", "research", "applied", "skills"]
        ),
        InterviewQuestion(
            id="bh-entry-2",
            competency="collaboration",
            text="Tell me about a time you handled disagreement or confusion within a student or team project.",
            expected_keywords=["listen", "talked", "collaborate", "resolve"]
        )
    ],
    "mid": [
        InterviewQuestion(
            id="bh-mid-1",
            competency="ownership",
            text="Tell me about a project where you owned a meaningful piece of delivery from planning to launch.",
            expected_keywords=["owned", "planned", "sprint", "delivered", "outcome"]
        ),
        InterviewQuestion(
            id="bh-mid-2",
            competency="communication & peer alignment",
            text="Tell me about a time you had a technical disagreement with a peer. How did you resolve it?",
            expected_keywords=["disagree", "compromise", "facts", "listen", "alignment"]
        )
    ],
    "senior": [
        InterviewQuestion(
            id="bh-senior-1",
            competency="technical leadership",
            text="Describe a major technical decision you influenced and the trade-offs and risks you considered.",
            expected_keywords=["tradeoff", "architecture", "stakeholder", "risk", "influence"]
        ),
        InterviewQuestion(
            id="bh-senior-2",
            competency="mentorship & growth",
            text="Walk me through a time you mentored a junior engineer or championed a process improvement. What was the outcome?",
            expected_keywords=["mentor", "coach", "process", "improvement", "growth"]
        )
    ]
}


def generate_questions(
    role: str,
    level: InterviewLevel,
    count: int,
    skills: list[str] | None = None,
    job_description: str = "",
) -> list[InterviewQuestion]:
    role_lower = role.lower()
    
    # 1. Classify Track
    track = "general"
    if any(k in role_lower for k in ["frontend", "react", "angular", "vue", "html", "css", "ui", "interface"]):
        track = "frontend"
    elif any(k in role_lower for k in ["backend", "fastapi", "django", "flask", "spring", "node", "database", "api"]):
        track = "backend"
    elif any(k in role_lower for k in ["data", "ml", "machine learning", "ai", "analytics", "nlp"]):
        track = "data"
    elif any(k in role_lower for k in ["manager", "lead", "director", "product"]):
        track = "manager"
    
    # 2. Extract Skills
    active_skills = []
    if skills:
        active_skills.extend(skills)
        
    if not active_skills and job_description:
        # Simple extraction from JD
        from app.services.resume_rag import SKILL_TERMS, term_in_text
        lowered_jd = job_description.lower()
        active_skills.extend([s for s in SKILL_TERMS if term_in_text(s, lowered_jd)])
        
    if not active_skills:
        # Fallbacks based on track
        if track == "frontend":
            active_skills.extend(["React", "TypeScript", "CSS"])
        elif track == "backend":
            active_skills.extend(["Python", "FastAPI", "PostgreSQL"])
        elif track == "data":
            active_skills.extend(["Python", "Pandas", "PyTorch"])
        elif track == "manager":
            active_skills.extend(["Agile", "Scrum", "Product Delivery"])
        else:
            active_skills.extend(["Software Design", "Git", "Testing"])
            
    skills_str = ", ".join(active_skills[:4])
    
    llm_questions = llm.generate_questions_via_llm(role, level, count, skills, job_description)
    questions: list[InterviewQuestion] = []
    for index, question in enumerate(llm_questions[:count]):
        questions.append(
            InterviewQuestion(
                id=str(question.get("id") or f"llm-{index}"),
                competency=str(question.get("competency") or "general"),
                text=str(question.get("text") or ""),
                expected_keywords=[str(keyword) for keyword in question.get("expected_keywords", []) or []],
            )
        )

    if not questions:
        raise RuntimeError("LLM returned no interview questions")

    return questions
