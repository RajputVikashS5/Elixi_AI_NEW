"""Privacy-preserving webcam signal analyzer based on optional numeric features."""


class WebcamAnalyzer:
    def analyze(
        self,
        face_engagement: float | None = None,
        eye_strain: float | None = None,
    ) -> dict:
        if face_engagement is None and eye_strain is None:
            return {
                "source": "webcam",
                "state": "neutral",
                "confidence": 0.0,
                "weight": 0.0,
                "enabled": False,
            }

        face_engagement = face_engagement if face_engagement is not None else 0.5
        eye_strain = eye_strain if eye_strain is not None else 0.0

        if eye_strain > 0.65:
            return {
                "source": "webcam",
                "state": "fatigued",
                "confidence": 0.72,
                "weight": 0.8,
                "enabled": True,
                "summary": "Visible eye strain suggests fatigue.",
            }
        if face_engagement < 0.3:
            return {
                "source": "webcam",
                "state": "neutral",
                "confidence": 0.4,
                "weight": 0.5,
                "enabled": True,
                "summary": "Low engagement signal; not enough for a stronger label.",
            }
        if face_engagement > 0.7 and eye_strain < 0.35:
            return {
                "source": "webcam",
                "state": "focused",
                "confidence": 0.63,
                "weight": 0.7,
                "enabled": True,
                "summary": "Engaged and visually steady.",
            }
        return {
            "source": "webcam",
            "state": "neutral",
            "confidence": 0.35,
            "weight": 0.45,
            "enabled": True,
            "summary": "Webcam signal is available but inconclusive.",
        }
