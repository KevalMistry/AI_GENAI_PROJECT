import base64

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def create_session() -> dict:
    response = client.post(
        "/api/interviews",
        json={
            "candidate_name": "Alan Turing",
            "role": "Backend Engineer",
            "level": "mid",
            "question_count": 2,
        },
    )
    assert response.status_code == 200
    return response.json()


def test_voice_websocket_accepts_audio_chunks_and_finalizes_turn() -> None:
    session = create_session()
    question = session["questions"][0]

    with client.websocket_connect(f"/ws/interview/{session['session_id']}") as websocket:
        assert websocket.receive_json()["type"] == "session"

        websocket.send_json(
            {
                "type": "voice_start",
                "data": {
                    "question": question,
                    "audio_format": "audio/webm",
                    "sample_rate": 48000,
                    "channels": 1,
                },
            }
        )
        ready = websocket.receive_json()
        assert ready["type"] == "voice_ready"

        websocket.send_json(
            {
                "type": "audio_chunk",
                "data": {
                    "chunk_index": 0,
                    "audio_base64": base64.b64encode(b"audio-bytes").decode(),
                    "partial_transcript": "I owned the API design and reviewed tradeoffs.",
                },
            }
        )
        ack = websocket.receive_json()
        assert ack["type"] == "audio_ack"
        assert ack["ack"]["buffered_bytes"] == len(b"audio-bytes")

        websocket.send_json({"type": "voice_turn_end", "data": {"request_follow_up": True}})
        result = websocket.receive_json()
        assert result["type"] == "voice_turn_result"
        assert result["result"]["transcript"] == "I owned the API design and reviewed tradeoffs."
        assert result["result"]["tone_analysis"]["confidence_score"] >= 0
        assert "vocal_confidence_score" in result["result"]["audio_features"]
        assert result["result"]["fact_check"]["factual_accuracy_score"] >= 0
        assert result["result"]["analysis"]["question_id"] == question["id"]
        assert result["result"]["follow_up"]["follow_up_question"]["id"].startswith("follow-up-")


def test_websocket_fact_check_event_returns_report() -> None:
    session = create_session()

    with client.websocket_connect(f"/ws/interview/{session['session_id']}") as websocket:
        websocket.receive_json()
        websocket.send_json(
            {
                "type": "fact_check",
                "data": {
                    "session_id": session["session_id"],
                    "transcript": "JavaScript is strongly typed.",
                    "role": "Frontend Engineer",
                },
            }
        )

        result = websocket.receive_json()
        assert result["type"] == "fact_check"
        assert result["fact_check"]["claims"][0]["status"] == "contradicted"


def test_websocket_sandbox_check_event_returns_result() -> None:
    session = create_session()

    with client.websocket_connect(f"/ws/interview/{session['session_id']}") as websocket:
        websocket.receive_json()
        websocket.send_json(
            {
                "type": "sandbox_check",
                "data": {
                    "session_id": session["session_id"],
                    "language": "javascript",
                    "code": "function solve(input) { return input.length;",
                },
            }
        )

        result = websocket.receive_json()
        assert result["type"] == "sandbox_result"
        assert result["sandbox"]["syntax_valid"] is False
        assert result["sandbox"]["diagnostics"][0]["rule"] == "js-delimiter"


def test_voice_websocket_can_finalize_from_chunk_final_flag() -> None:
    session = create_session()
    question = session["questions"][0]

    with client.websocket_connect(f"/ws/interview/{session['session_id']}") as websocket:
        websocket.receive_json()
        websocket.send_json({"type": "voice_start", "data": {"question": question}})
        websocket.receive_json()

        websocket.send_json(
            {
                "type": "audio_chunk",
                "data": {
                    "chunk_index": 0,
                    "partial_transcript": "I measured impact and reduced latency by 20 percent.",
                    "is_final": True,
                },
            }
        )

        ack = websocket.receive_json()
        result = websocket.receive_json()
        assert ack["type"] == "audio_ack"
        assert result["type"] == "voice_turn_result"
        assert "reduced latency" in result["result"]["transcript"]
