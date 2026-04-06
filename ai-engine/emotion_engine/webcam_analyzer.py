"""Privacy-preserving webcam signal analyzer based on facial expressions and engagement."""

from typing import Dict, Optional, Any


class WebcamAnalyzer:
    def analyze(
        self,
        face_engagement: Optional[float] = None,
        eye_strain: Optional[float] = None,
        facial_expression: Optional[str] = None,
        expression_confidence: Optional[float] = None,
        facial_cues: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        """Analyze webcam metrics to determine emotional state.
        
        Args:
            face_engagement: User engagement level (0-1)
            eye_strain: Eye strain level (0-1)
            facial_expression: Detected facial expression state
            expression_confidence: Confidence in detected expression
            facial_cues: Dict with individual facial cues (smile, frown, etc.)
            
        Returns:
            Dict with emotion state and confidence
        """
        if (
            face_engagement is None
            and eye_strain is None
            and facial_expression is None
        ):
            return {
                "source": "webcam",
                "state": "neutral",
                "confidence": 0.0,
                "weight": 0.0,
                "enabled": False,
                "summary": "No facial data available",
            }

        face_engagement = face_engagement if face_engagement is not None else 0.5
        eye_strain = eye_strain if eye_strain is not None else 0.0
        expression_confidence = (
            expression_confidence if expression_confidence is not None else 0.0
        )
        facial_cues = facial_cues if facial_cues is not None else {}

        # Use facial expression as primary signal if available and confident
        if (
            facial_expression
            and expression_confidence > 0.25
        ):
            state = facial_expression
            # Confidence is expression confidence boosted by engagement context
            confidence = min(
                0.95,
                expression_confidence * (0.7 + face_engagement * 0.3)
            )
            weight = 0.85
            
            # Generate summary based on expression and facial cues
            summary_parts = []
            if facial_cues:
                if facial_cues.get("smile", 0) > 0.3:
                    summary_parts.append("smiling")
                elif facial_cues.get("frown", 0) > 0.3:
                    summary_parts.append("frowning")
                if facial_cues.get("raised_brows", 0) > 0.3:
                    summary_parts.append("eyebrows raised")
                if facial_cues.get("squint", 0) > 0.3:
                    summary_parts.append("focused/squinting")
            summary = " • ".join(summary_parts) if summary_parts else state.capitalize()
        else:
            # Fallback to engagement and eye strain heuristics
            if eye_strain > 0.65:
                state = "fatigued"
                confidence = 0.72
                weight = 0.8
                summary = "Visible eye strain suggests fatigue"
            elif face_engagement < 0.3:
                state = "neutral"
                confidence = 0.4
                weight = 0.5
                summary = "Low engagement signal; not looking at screen"
            elif face_engagement > 0.7 and eye_strain < 0.35:
                state = "focused"
                confidence = 0.63
                weight = 0.7
                summary = "Engaged and visually steady"
            else:
                state = "neutral"
                confidence = 0.35
                weight = 0.45
                summary = "Neutral state; typical engagement"

        return {
            "source": "webcam",
            "state": state,
            "confidence": confidence,
            "weight": weight,
            "enabled": True,
            "summary": summary,
        }
