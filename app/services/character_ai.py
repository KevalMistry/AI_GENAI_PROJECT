import os
import logging
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv

# Try importing PyCharacterAI
try:
    from PyCharacterAI import Client
    HAS_PYCHARACTERAI = True
except ImportError:
    HAS_PYCHARACTERAI = False

load_dotenv()

logger = logging.getLogger("app.services.character_ai")

class CharacterAIService:
    def __init__(self):
        self.token = os.getenv("CHARACTER_AI_TOKEN")
        self.coach_ids = {
            "rohit": os.getenv("CHARACTER_AI_ROHIT_COACH_ID"),
            "allie": os.getenv("CHARACTER_AI_ALLIE_COACH_ID"),
            "blaise": os.getenv("CHARACTER_AI_BLAISE_COACH_ID"),
            "aarthi": os.getenv("CHARACTER_AI_AARTHI_COACH_ID"),
            "jeff": os.getenv("CHARACTER_AI_JEFF_COACH_ID"),
        }
        self.client: Optional[Client] = None
        self.active_chats: Dict[str, str] = {}  # Maps key (session_id + "_" + coach_id) to Character.AI chat_id
        self.authenticated = False

    async def _init_client(self) -> bool:
        """Initializes and authenticates the PyCharacterAI client if credentials are provided."""
        if not HAS_PYCHARACTERAI:
            logger.warning("PyCharacterAI package is not installed. Running in mock/fallback mode.")
            return False

        if not self.token or self.token == "your_character_ai_token_here":
            logger.warning("CHARACTER_AI_TOKEN is not configured. Running in mock/fallback mode.")
            return False

        if self.client and self.authenticated:
            return True

        try:
            self.client = Client()
            try:
                await self.client.authenticate(self.token)
            except AttributeError:
                # Fallback for library versions that might use authenticate_with_token
                await self.client.authenticate_with_token(self.token)
            self.authenticated = True
            logger.info("Successfully authenticated with Character.AI")
            return True
        except Exception as e:
            logger.error(f"Failed to authenticate with Character.AI: {e}. Running in mock fallback mode.")
            self.authenticated = False
            self.client = None
            return False

    def get_coaches(self) -> List[Dict[str, Any]]:
        """Returns metadata profiles of the 5 AI coaches."""
        return [
            {
                "id": "rohit",
                "name": "Rohit Prasad (Technical & AI/ML)",
                "description": "Alexa Head Scientist. Specialist in AI/ML systems, natural language processing, deep learning pipelines, and core coding questions.",
                "expertise": ["AI/ML Systems", "Neural Networks", "NLP / LLMs", "Technical Coding"],
                "icon": "Code",
                "avatar_color": "from-blue-500 to-indigo-600"
            },
            {
                "id": "allie",
                "name": "Allie Miller (Resume & Career)",
                "description": "Top AI brand strategist and tech advisor. Reviews resumes, optimizes ATS parsing, and helps map transition roadmaps.",
                "expertise": ["ATS Optimization", "Resume Polish", "Career Transition", "Brand Building"],
                "icon": "FileText",
                "avatar_color": "from-purple-500 to-pink-500"
            },
            {
                "id": "blaise",
                "name": "Blaise Agüera y Arcas (AI Research)",
                "description": "VP & Distinguished Scientist at Google AI. Diagnoses machine learning models, project architectures, and academic research methodologies.",
                "expertise": ["AI Architectures", "Neural Computation", "Project Diagnostics", "Research Papers"],
                "icon": "Brain",
                "avatar_color": "from-teal-500 to-emerald-500"
            },
            {
                "id": "aarthi",
                "name": "Aarthi Subramanian (HR & Communication)",
                "description": "Experienced technology executive. Focuses on situational leadership, behavioral STAR framework, and executive presence.",
                "expertise": ["Behavioral STAR method", "Executive Presence", "Conflict Resolution", "Leadership Values"],
                "icon": "User",
                "avatar_color": "from-amber-500 to-orange-500"
            },
            {
                "id": "jeff",
                "name": "Jeff Dean (System Design & Scale)",
                "description": "Chief Scientist at Google AI. Reviews internet-scale distributed systems, low-latency design patterns, and database scaling.",
                "expertise": ["Distributed Systems", "MapReduce/Bigtable scale", "Scalability Reviews", "Low-Latency Design"],
                "icon": "Layers",
                "avatar_color": "from-red-500 to-rose-600"
            }
        ]

    async def get_or_create_chat_id(self, session_id: str, coach_id: str) -> Optional[str]:
        """Fetches an existing Character.AI chat_id or creates a new one for the session and coach."""
        is_ready = await self._init_client()
        if not is_ready or not self.client:
            return None

        char_id = self.coach_ids.get(coach_id)
        if not char_id or char_id == f"your_{coach_id}_coach_id_here":
            logger.warning(f"No Character.AI Character ID configured for coach: {coach_id}")
            return None

        # Clean any leading slashes from Character ID
        char_id = char_id.lstrip("/")

        key = f"{session_id}_{coach_id}"
        if key in self.active_chats:
            return self.active_chats[key]

        try:
            # Check existing chats on Character.AI first to reuse if possible
            logger.info(f"Fetching chats for character: {char_id}")
            chats = await self.client.chat.fetch_chats(char_id)
            if chats:
                # Reuse the most recent chat
                chat_id = chats[0].chat_id
                self.active_chats[key]
                logger.info(f"Reused existing Character.AI chat session for {key}: {chat_id}")
                return chat_id

            # If no chats found, create a new one
            logger.info(f"Creating new chat for character: {char_id}")
            chat_obj, _ = await self.client.chat.create_chat(char_id)
            self.active_chats[key] = chat_obj.chat_id
            logger.info(f"Created new Character.AI chat session for {key}: {chat_obj.chat_id}")
            return chat_obj.chat_id
        except Exception as e:
            logger.error(f"Error getting/creating Character.AI chat ID for {key}: {e}")
            return None

    async def send_message(self, session_id: str, coach_id: str, message: str) -> str:
        """Sends a message to the specified coach and returns their response."""
        chat_id = await self.get_or_create_chat_id(session_id, coach_id)
        char_id = self.coach_ids.get(coach_id)

        if char_id:
            char_id = char_id.lstrip("/")

        if not chat_id or not char_id or not self.client:
            # Return high-fidelity fallback response if credentials are not configured or request fails
            return self._get_fallback_response(coach_id, message)

        try:
            logger.info(f"Sending message to Character.AI character: {char_id}, chat: {chat_id}")
            turn = await self.client.chat.send_message(char_id, chat_id, message)
            candidate = turn.get_primary_candidate()
            if candidate and candidate.text:
                return candidate.text
            return "The coach was unable to formulate a response. Please try again."
        except Exception as e:
            logger.error(f"Error during Character.AI API communication: {e}")
            # Graceful fallback so user always gets a response
            return self._get_fallback_response(coach_id, message)

    async def reset_chat(self, session_id: str, coach_id: str) -> bool:
        """Resets the chat context by creating a fresh chat on Character.AI."""
        is_ready = await self._init_client()
        char_id = self.coach_ids.get(coach_id)
        key = f"{session_id}_{coach_id}"

        if char_id:
            char_id = char_id.lstrip("/")

        if not is_ready or not self.client or not char_id:
            # In mock fallback mode, we just remove the local cache keys
            if key in self.active_chats:
                del self.active_chats[key]
            return True

        try:
            logger.info(f"Resetting chat for coach: {coach_id} (character {char_id})")
            chat_obj, _ = await self.client.chat.create_chat(char_id)
            self.active_chats[key] = chat_obj.chat_id
            logger.info(f"Reset complete. Created fresh Character.AI chat ID: {chat_obj.chat_id}")
            return True
        except Exception as e:
            logger.error(f"Error resetting Character.AI chat for {key}: {e}")
            # Remove from local dictionary to force a fresh creation attempts next time
            if key in self.active_chats:
                del self.active_chats[key]
            return True


    def _get_fallback_response(self, coach_id: str, message: str) -> str:
        """Provides realistic mock responses when API credentials are missing or call fails."""
        normalized_msg = message.lower()
        
        if coach_id == "rohit":
            if "model" in normalized_msg or "deep" in normalized_msg:
                return "Hi! I'm Rohit Prasad. When designing AI/ML models (like Alexa's Speech NLP), you must pay attention to details like contextual representation, compute costs, and model latency. For deep networks, are you focusing on Transformer architectures or RNN/CNN models? Let's discuss your design choices."
            elif "ml" in normalized_msg or "machine learning" in normalized_msg:
                return "Hey! Rohit Prasad here. Let's analyze your machine learning pipeline. In production systems, clean data ingestion, hyperparameter tuning, and drift monitoring are just as important as the core model architecture. What kind of dataset or objective function are we working on?"
            else:
                return "Greetings. Rohit Prasad here. As a tech and AI/ML coach, I focus on how you translate ideas into scalable algorithmic solutions. Paste your code snippet or explain your model's pipeline, and let's optimize it. What technical concept would you like to review?"

        elif coach_id == "allie":
            if "ats" in normalized_msg or "resume" in normalized_msg:
                return "Hey there! Allie Miller here. Your resume needs to highlight your direct business value. Don't just list technologies; write achievements in terms of business impact: 'Implemented model X, yielding a 20% conversion bump and $400k revenue growth'. Let's audit your bullet points."
            else:
                return "Hi, Allie Miller here! I evaluate resumes and career positioning. In the AI space, staying competitive means showing active portfolio projects, continuous learning, and clear personal branding. Let's examine your job search strategy. What target roles are you chasing?"

        elif coach_id == "blaise":
            if "research" in normalized_msg or "architect" in normalized_msg:
                return "Hello, Blaise here. Evaluating AI research requires understanding local neural architectures and the mathematical bounds of your model. When proposing a new model, it is vital to discuss how your baseline comparison is set up. Tell me about the core hypothesis you are testing."
            else:
                return "Hi, Blaise Agüera y Arcas here. I am happy to critique your AI project or review research ideas. A strong technical project must show clear validation metrics, explain why a specific architecture was chosen, and describe limitations. What project are we assessing today?"

        elif coach_id == "aarthi":
            if "star" in normalized_msg or "communication" in normalized_msg:
                return "Hello! Aarthi Subramanian here. For HR and situational communication, structure is everything. Use the STAR framework (Situation, Task, Action, Result). Make sure to highlight leadership, team collaboration, and the actual business impact. Let's practice a situational question."
            else:
                return "Hi! Aarthi Subramanian here. I focus on behavioral skills, leadership, and communication effectiveness. In corporate executive settings, clarity of thought and team conflict resolution are highly valued. Tell me about a time you solved a conflict on your team."

        elif coach_id == "jeff":
            if "distrib" in normalized_msg or "scale" in normalized_msg:
                return "Jeff Dean here. When scaling distributed systems to hundreds of millions of daily operations, look closely at latency profiles, network roundtrips, cache hit-rates, and data sharding. For write-heavy operations, what replica consistency level are you targeting? Let's check the design bottlenecks."
            else:
                return "Jeff Dean here. Distributed systems, file systems, and large-scale computations are my bread and butter. If you're designing database sharding, caching, or compute clusters, explain your high-level architecture and let's identify the scaling limits. What are we designing today?"

        return "I'm your AI Coach. That is a great question. Let's work together to polish your skills and prepare you for career success. What details can you share about your target role?"
