"""ELIXI Personality implementation - handles spec-compliant response formatting and emotion-aware interactions."""

import logging
from typing import Optional, Dict, List, Any, Set

logger = logging.getLogger(__name__)


class VoiceToneMapper:
    """Maps emotion states to voice tones as per ELIXI spec."""
    
    _EMOTION_TO_TONE: Dict[str, str] = {
        # Positive emotions
        "happy": "energetic",
        "motivated": "energetic",
        "focused": "calm",
        "neutral": "neutral",
        
        # Negative emotions
        "sad": "supportive",
        "frustrated": "calm",
        "fatigued": "calm",
        "stressed": "supportive",
        "tired": "calm",
        
        # Fallback
        "unknown": "neutral",
    }
    
    @staticmethod
    def emotion_to_tone(emotion_state: Optional[str]) -> str:
        """Convert emotion state to voice tone.
        
        Args:
            emotion_state: The detected emotion (e.g., 'happy', 'sad', 'neutral')
            
        Returns:
            Voice tone: one of 'calm', 'energetic', 'supportive', 'neutral'
        """
        if not emotion_state:
            return "neutral"
        
        normalized = emotion_state.lower().strip()
        return VoiceToneMapper._EMOTION_TO_TONE.get(normalized, "neutral")


class SessionManager:
    """Manages session state and detects session starts."""
    
    _GREETING_INTENTS: Set[str] = {
        "chat_greeting",
        "chat_general",
        "chat_question",
    }
    
    _SESSION_STARTS: Dict[str, bool] = {}  # sessionId -> session_start_detected
    
    @staticmethod
    def is_session_start(session_id: str, intent: str, message: str) -> bool:
        """Detect if this is a session start (new or greeting).
        
        Args:
            session_id: Unique session identifier
            intent: Classified intent
            message: User's message
            
        Returns:
            True if this is likely a session start
        """
        # Only explicit greetings should trigger the canned greeting.
        # A fresh session should still route the user's first real question to the LLM.
        is_greeting = intent in SessionManager._GREETING_INTENTS
        is_greeting_message = any(
            keyword in message.lower() 
            for keyword in ["hello", "hi", "hey", "good morning", "good evening", "greetings", "wake up", "elixi"]
        )
        
        return is_greeting and is_greeting_message
    
    @staticmethod
    def mark_session_started(session_id: str):
        """Mark a session as started."""
        SessionManager._SESSION_STARTS[session_id] = True
    
    @staticmethod
    def reset_session(session_id: str):
        """Reset session state."""
        if session_id in SessionManager._SESSION_STARTS:
            del SessionManager._SESSION_STARTS[session_id]


class ResponseFormatter:
    """Formats responses according to ELIXI spec."""
    
    @staticmethod
    def format_response(
        intent: str,
        response_text: str,
        emotion_detected: Optional[str] = None,
        action: str = "respond",
        confidence: float = 0.75,
        entities: Optional[Dict[str, Any]] = None,
        actions: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Format response according to ELIXI spec.
        
        Args:
            intent: Classified user intent
            response_text: The assistant's response text
            emotion_detected: Detected user emotion state
            action: Action to take (respond, execute, etc.)
            confidence: Confidence score (0.0-1.0)
            entities: Extracted entities
            actions: Suggested actions to execute
            
        Returns:
            Spec-compliant response dictionary
        """
        voice_tone = VoiceToneMapper.emotion_to_tone(emotion_detected)
        
        return {
            # Spec-compliant fields
            "intent": intent,
            "emotion_detected": emotion_detected,
            "response_text": response_text,
            "voice_tone": voice_tone,
            "action": action,
            "confidence": min(max(float(confidence), 0.0), 1.0),
            
            # Support fields
            "content": response_text,  # Legacy field
            "response": response_text,  # Legacy field
            "entities": entities or {},
            "actions": actions or [],
        }
    
    @staticmethod
    def create_greeting(session_id: str) -> Dict[str, Any]:
        """Create ELIXI greeting response for session start.
        
        Returns:
            Spec-compliant greeting response
        """
        greeting_text = "Hello! I'm ELIXI. How can I help you today?"
        SessionManager.mark_session_started(session_id)
        
        return ResponseFormatter.format_response(
            intent="chat_greeting",
            response_text=greeting_text,
            emotion_detected="neutral",
            action="respond",
            confidence=0.99,
        )


class ResponseLengthOptimizer:
    """Optimizes response length to match ELIXI spec (1-2 sentences unless needed)."""
    
    _INFORMATIONAL_INTENTS: Set[str] = {
        "chat_question",
        "get_weather",
        "memory_recall",
    }
    
    @staticmethod
    def constrain_length(response_text: str, intent: str) -> str:
        """Constrain response to 1-2 sentences unless it's an informational query.
        
        Args:
            response_text: The response text
            intent: The classified intent
            
        Returns:
            Constrained response text
        """
        # Intent categories that may need longer responses
        # Keep long responses for informational queries
        if intent in ResponseLengthOptimizer._INFORMATIONAL_INTENTS:
            return response_text
        
        # For other intents, limit to 2 sentences
        sentences = response_text.split(". ")
        if len(sentences) <= 2:
            return response_text
        
        # Rejoin first 2 sentences
        constrained = ". ".join(sentences[:2])
        if not constrained.endswith("."):
            constrained += "."
        
        return constrained
