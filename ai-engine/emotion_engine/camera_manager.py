"""Camera emotion analysis manager - handles startup, permissions, and integration."""

import logging
from typing import Optional, Dict, Any

from emotion_engine.webcam_capture import WebcamCapture, MEDIAPIPE_AVAILABLE
from emotion_engine.webcam_analyzer import WebcamAnalyzer

logger = logging.getLogger(__name__)


class CameraEmotionManager:
    """Manages camera-based emotion detection with privacy controls."""
    
    def __init__(self, enabled: bool = False, camera_index: int = 0, target_fps: int = 10):
        """Initialize camera emotion manager.
        
        Args:
            enabled: Whether to enable camera on init (defaults to False for privacy)
            camera_index: Which camera device to use
            target_fps: Target FPS for frame processing (lower = less CPU)
        """
        self.enabled = enabled and MEDIAPIPE_AVAILABLE
        self.camera_index = camera_index
        self.target_fps = target_fps
        
        # Only initialize capture if enabled
        self.capture: Optional[WebcamCapture] = None
        self.analyzer = WebcamAnalyzer()
        
        if self.enabled:
            self._initialize_capture()
        else:
            if not MEDIAPIPE_AVAILABLE:
                logger.warning("MediaPipe not available. Install with: pip install mediapipe opencv-python")
            else:
                logger.info("Camera emotion detection available but disabled by default (privacy-first)")
    
    def _initialize_capture(self):
        """Initialize webcam capture."""
        try:
            self.capture = WebcamCapture(
                camera_index=self.camera_index,
                target_fps=self.target_fps,
                enabled=True,
            )
            self.capture.start()
        except Exception as e:
            logger.error("Failed to initialize camera capture: %s", e)
            self.enabled = False
            self.capture = None
    
    def enable(self) -> bool:
        """Enable camera emotion detection.
        
        Returns:
            True if successfully enabled, False otherwise
        """
        if self.enabled:
            return True
        
        if not MEDIAPIPE_AVAILABLE:
            logger.error("Cannot enable camera: MediaPipe not installed")
            return False
        
        try:
            self._initialize_capture()
            self.enabled = True
            logger.info("Camera emotion detection enabled")
            return True
        except Exception as e:
            logger.error("Failed to enable camera: %s", e)
            return False
    
    def disable(self):
        """Disable camera emotion detection."""
        if self.capture:
            self.capture.stop()
            self.capture = None
        self.enabled = False
        logger.info("Camera emotion detection disabled")
    
    def is_enabled(self) -> bool:
        """Check if camera is currently enabled."""
        return self.enabled and self.capture is not None and self.capture.enabled
    
    def get_emotion_signal(self) -> Dict[str, Any]:
        """Get current emotion signal from camera analysis.
        
        Returns:
            Dict with emotion state and confidence
        """
        if not self.is_enabled() or not self.capture:
            return {
                "source": "webcam",
                "state": "neutral",
                "confidence": 0.0,
                "weight": 0.0,
                "enabled": False,
            }
        
        try:
            metrics = self.capture.get_metrics()
            
            if not metrics.get("face_detected", False):
                return {
                    "source": "webcam",
                    "state": "neutral",
                    "confidence": 0.0,
                    "weight": 0.0,
                    "enabled": True,
                    "summary": "Camera available but no face detected",
                }
            
            # Use the WebcamAnalyzer to interpret metrics
            emotion = self.analyzer.analyze(
                face_engagement=metrics.get("face_engagement"),
                eye_strain=metrics.get("eye_strain"),
            )
            
            # Add extra metrics for debugging
            emotion["raw_metrics"] = {
                "face_engagement": metrics.get("face_engagement"),
                "eye_strain": metrics.get("eye_strain"),
                "blink_rate": metrics.get("blink_rate"),
                "eye_openness": metrics.get("eye_openness"),
                "looking_at_screen": metrics.get("looking_at_screen"),
            }
            
            return emotion
        
        except Exception as e:
            logger.error("Error getting emotion signal from camera: %s", e)
            return {
                "source": "webcam",
                "state": "neutral",
                "confidence": 0.0,
                "weight": 0.0,
                "enabled": True,
                "error": str(e),
            }
    
    def get_status(self) -> Dict[str, Any]:
        """Get current camera status and metrics.
        
        Returns:
            Dict with camera status information
        """
        status = {
            "enabled": self.is_enabled(),
            "available": MEDIAPIPE_AVAILABLE,
            "camera_index": self.camera_index,
            "target_fps": self.target_fps,
        }
        
        if self.capture:
            metrics = self.capture.get_metrics()
            status["face_detected"] = metrics.get("face_detected", False)
            status["timestamps"] = metrics.get("timestamp")
            status["metrics"] = {
                "face_engagement": metrics.get("face_engagement"),
                "eye_strain": metrics.get("eye_strain"),
                "looking_at_screen": metrics.get("looking_at_screen"),
            }
        
        return status
    
    def shutdown(self):
        """Cleanly shutdown camera resources."""
        self.disable()
        logger.info("Camera emotion manager shutdown")


# Global instance
_camera_manager: Optional[CameraEmotionManager] = None


def get_camera_manager(enabled: bool = False) -> CameraEmotionManager:
    """Get or create global camera emotion manager.
    
    Args:
        enabled: Whether to enable on first init
        
    Returns:
        CameraEmotionManager instance
    """
    global _camera_manager
    if _camera_manager is None:
        _camera_manager = CameraEmotionManager(enabled=enabled)
    return _camera_manager


def shutdown_camera():
    """Shutdown global camera manager."""
    global _camera_manager
    if _camera_manager:
        _camera_manager.shutdown()
        _camera_manager = None
