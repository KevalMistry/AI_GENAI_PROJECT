import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.character_ai import CharacterAIService

client = TestClient(app)

def test_get_coaches():
    """Test that the coaches list endpoint returns the configured coaches with correct metadata."""
    response = client.get("/api/coaches")
    assert response.status_code == 200
    coaches = response.json()
    assert len(coaches) == 5
    
    coach_ids = [c["id"] for c in coaches]
    assert "rohit" in coach_ids
    assert "allie" in coach_ids
    assert "blaise" in coach_ids
    assert "aarthi" in coach_ids
    assert "jeff" in coach_ids
    
    for coach in coaches:
        assert "name" in coach
        assert "description" in coach
        assert "expertise" in coach
        assert "icon" in coach
        assert "avatar_color" in coach
        assert isinstance(coach["expertise"], list)

@pytest.mark.asyncio
async def test_character_ai_service_fallback():
    """Test that the CharacterAIService returns realistic fallbacks when not authenticated."""
    service = CharacterAIService()
    # Force mock mode
    service.token = None
    
    # Test aarthi fallback
    reply = await service.send_message("test_session", "aarthi", "Tell me about the STAR method")
    assert "Aarthi" in reply
    assert "STAR" in reply

    # Test rohit fallback
    reply = await service.send_message("test_session", "rohit", "Explain ML models")
    assert "Rohit" in reply or "model" in reply

    # Test allie fallback
    reply = await service.send_message("test_session", "allie", "How to optimize resume for ATS?")
    assert "Allie" in reply or "ATS" in reply

    # Test blaise fallback
    reply = await service.send_message("test_session", "blaise", "AI Research models")
    assert "Blaise" in reply

    # Test jeff fallback
    reply = await service.send_message("test_session", "jeff", "How should I design distributed scale?")
    assert "Jeff" in reply or "distrib" in reply

def test_coach_chat_endpoint_fallback():
    """Test that the chat API endpoint handles requests and responds with fallbacks if unauthenticated."""
    payload = {
        "session_id": "test_session_id",
        "message": "Hello coach, explain system design to me"
    }
    response = client.post("/api/coaches/rohit/chat", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["coach_id"] == "rohit"
    assert "reply" in data
    assert len(data["reply"]) > 0

def test_coach_reset_endpoint():
    """Test that the chat reset API endpoint works and returns success."""
    payload = {
        "session_id": "test_session_id"
    }
    response = client.post("/api/coaches/aarthi/reset", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"

