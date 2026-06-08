import json
import logging
import os
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("app.services.llm")

# Expect the user to provide GROQ_API_URL and GROQ_API_KEY in the environment.
GROQ_API_URL = os.getenv("GROQ_API_URL", "https://api.groq.com/openai/v1/chat/completions").strip()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile").strip()


def is_configured() -> bool:
    return bool(GROQ_API_URL and GROQ_API_KEY)


def _call_llm(prompt: str, timeout: int = 30, expect_json: bool = False) -> Optional[str]:
    """Call the configured Groq endpoint using OpenAI-compatible Chat Completions format."""
    if not is_configured():
        logger.error("Groq is not configured. GROQ_API_KEY or GROQ_API_URL is missing.")
        return None

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GROQ_API_KEY}"
    }
    
    payload: Dict[str, Any] = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.1,
    }

    if expect_json:
        payload["response_format"] = {"type": "json_object"}

    try:
        resp = requests.post(GROQ_API_URL, headers=headers, json=payload, timeout=timeout)
        resp.raise_for_status()
        data = resp.json()
        
        if "choices" in data and len(data["choices"]) > 0:
            return data["choices"][0].get("message", {}).get("content", "").strip()
            
        return resp.text
    except Exception as e:
        logger.exception(f"Error calling Groq endpoint: {e}")
        return None


# def complete_text(prompt: str, timeout: int = 30) -> str:
#     text = _call_gemini(prompt, timeout=timeout)
#     if not text:
#         raise RuntimeError("Gemini is not configured or returned no content")
#     return text


def complete_json(prompt: str, timeout: int = 30) -> Any:
    text = _call_llm(prompt, timeout=timeout, expect_json=True)
    if not text:
        raise RuntimeError("LLM is not configured or returned no content")

    try:
        return json.loads(text)
    except Exception:
        try:
            start = text.index("{") if "{" in text else text.index("[")
            end = text.rindex("}") if "{" in text else text.rindex("]")
            return json.loads(text[start : end + 1])
        except Exception as exc:
            raise RuntimeError("LLM returned invalid JSON") from exc


def generate_questions_via_llm(role: str, level: str, count: int, skills: Optional[List[str]] = None, job_description: str = "") -> Optional[List[Dict[str, Any]]]:
    """Ask LLM to produce a JSON array of interview questions. Each item should include id, competency, text, expected_keywords.
    The function returns None on failure so callers can fall back to templates.
    """
    skills_text = ", ".join(skills) if skills else ""
    prompt = (
        f"You are an expert interviewer. Produce {count} interview questions for the role '{role}' at level '{level}'."
        " Return results as a JSON array. Each element must be an object with keys: id (short string), competency (short phrase), text (the question text), expected_keywords (array of keywords)."
        f" Include research on skills: {skills_text}. Job description: {job_description}. Return ONLY the JSON object with a 'questions' key containing the array." 
    )

    parsed = complete_json(prompt)
    if isinstance(parsed, dict) and "questions" in parsed:
        return parsed["questions"]
    if isinstance(parsed, list):
        return parsed
    raise RuntimeError("LLM did not return a JSON array for question generation")


def analyze_answer_via_llm(question_text: str, transcript: str, audio_features: Optional[Dict[str, float]] = None) -> Optional[Dict[str, Any]]:
    """Ask LLM to analyze the user's answer and return a JSON object matching AnswerAnalysis shape.
    The expected JSON keys: question_id, question, transcript, scores (relevance, fluency, confidence, clarity, emotional_tone), overall_score, sentiment, strengths (list), improvements (list), feedback (string).
    """
    audio_note = json.dumps(audio_features or {})
    prompt = (
        "You are an expert interviewer and evaluator.\n"
        f"Question: {question_text}\n"
        f"Candidate answer: {transcript}\n"
        f"Audio features (json): {audio_note}\n"
        "Evaluate the answer along these numeric dimensions (0-100): relevance, fluency, confidence, clarity, emotional_tone."
        " Then compute an overall_score (0-100) and provide a short list of strengths and improvements."
        " Return EXACTLY one JSON object with fields: question_id, question, transcript, scores (object), overall_score, sentiment, strengths (array), improvements (array), feedback (string)."
    )

    parsed = complete_json(prompt, timeout=60)
    if isinstance(parsed, dict):
        return parsed
    raise RuntimeError("LLM did not return a JSON object for answer analysis")
