"""Real-time facial analysis for emotion detection using MediaPipe."""

import logging
import threading
import time
from typing import Optional, Dict, Any
from collections import deque

logger = logging.getLogger(__name__)

# Try to import MediaPipe for facial analysis
try:
    import cv2
    import mediapipe as mp
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False
    logger.warning("MediaPipe or OpenCV not installed. Webcam emotion detection unavailable.")


class EyeStrainDetector:
    """Detects eye strain through blinking patterns and eye openness."""
    
    def __init__(self, window_size: int = 30):
        self.blink_history = deque(maxlen=window_size)
        self.eye_openness_history = deque(maxlen=window_size)
        self.blink_threshold = 4.5  # EAR threshold for closed eye
        
    def update(self, left_eye_aspect_ratio: float, right_eye_aspect_ratio: float) -> Dict[str, float]:
        """Update with current eye metrics.
        
        Args:
            left_eye_aspect_ratio: Distance-based ratio (higher = more open)
            right_eye_aspect_ratio: Distance-based ratio (higher = more open)
            
        Returns:
            Dict with strain metrics
        """
        avg_ear = (left_eye_aspect_ratio + right_eye_aspect_ratio) / 2.0
        self.eye_openness_history.append(avg_ear)
        
        # Detect blink (rapid closure and reopening)
        is_blink = avg_ear < self.blink_threshold
        self.blink_history.append(is_blink)
        
        # Calculate strain metrics
        blink_rate = sum(self.blink_history) / len(self.blink_history) if self.blink_history else 0
        avg_openness = sum(self.eye_openness_history) / len(self.eye_openness_history) if self.eye_openness_history else avg_ear
        
        # High strain indicators: excessive blinking or poor eye openness
        strain_score = 0.0
        if blink_rate > 0.4:  # Blinking more than 40% of frames
            strain_score += 0.4
        if avg_openness < 4.0:  # Eyes frequently less open
            strain_score += 0.3
        
        return {
            "blink_rate": min(blink_rate, 1.0),
            "eye_openness": min(avg_openness / 6.0, 1.0),  # Normalize to 0-1
            "strain_score": min(strain_score, 1.0),
        }


class FaceEngagementDetector:
    """Detects if user is looking at screen and engaged."""
    
    def __init__(self, window_size: int = 20):
        self.engagement_history = deque(maxlen=window_size)
        self.head_pose_history = deque(maxlen=window_size)
        
    def update(
        self,
        face_center_x: float,
        face_center_y: float,
        frame_width: int,
        frame_height: int,
        head_pose_distance: Optional[float] = None,
    ) -> Dict[str, float]:
        """Update engagement metrics based on face position.
        
        Args:
            face_center_x: X coordinate of face center (0-1 normalized)
            face_center_y: Y coordinate of face center (0-1 normalized)
            frame_width: Video frame width
            frame_height: Video frame height
            head_pose_distance: Distance of head from camera (optional)
            
        Returns:
            Dict with engagement metrics
        """
        # Higher engagement if face is centered on screen
        # Allow some tolerance for natural head movement
        center_tolerance = 0.2  # 20% from center
        
        x_centered = abs(face_center_x - 0.5) < center_tolerance
        y_centered = abs(face_center_y - 0.35) < center_tolerance  # Slightly above center (typical monitor height)
        
        engagement_score = 0.0
        if x_centered and y_centered:
            engagement_score = 0.8  # Good engagement
        elif x_centered or y_centered:
            engagement_score = 0.5  # Partial engagement
        else:
            engagement_score = 0.2  # Poor engagement (looking away)
        
        # Adjust for distance (too close or too far reduces engagement)
        if head_pose_distance is not None:
            if 0.3 < head_pose_distance < 0.8:  # Optimal distance
                engagement_score *= 1.1
            elif head_pose_distance < 0.2 or head_pose_distance > 1.0:
                engagement_score *= 0.7
        
        self.engagement_history.append(engagement_score)
        
        return {
            "engagement_score": min(engagement_score, 1.0),
            "looking_at_screen": engagement_score > 0.5,
            "average_engagement": sum(self.engagement_history) / len(self.engagement_history) if self.engagement_history else engagement_score,
        }


class FacialExpressionDetector:
    """Detects emotional cues from facial expressions."""
    
    def __init__(self):
        self.expression_history = deque(maxlen=30)
        
    def detect_from_landmarks(self, landmarks: Any) -> Dict[str, Any]:
        """Detect emotional expressions from facial landmarks.
        
        Args:
            landmarks: Mediapipe face landmarks
            
        Returns:
            Dict with detected emotions
        """
        if landmarks is None:
            return {"state": "unknown", "confidence": 0.0}
        
        # Note: Full facial expression analysis would require more sophisticated
        # ML models (like facial action units). For now, we provide a simpler
        # heuristic approach based on mouth and eye regions.
        
        try:
            # Simple heuristics based on key landmarks
            # Landmark indices: 13=left eye, 14=right eye, 78=mouth
            
            # This is a simplified approach - real implementation would use
            # proper facial action unit detection or emotion classifiers
            
            return {
                "state": "neutral",
                "confidence": 0.3,
                "summary": "Facial expression analysis available",
            }
        except Exception as e:
            logger.warning("Error detecting facial expression: %s", e)
            return {"state": "unknown", "confidence": 0.0}


class WebcamCapture:
    """Real-time webcam capture and analysis thread."""
    
    def __init__(self, camera_index: int = 0, target_fps: int = 10, enabled: bool = True):
        """Initialize webcam capture.
        
        Args:
            camera_index: Index of camera device (0 = default)
            target_fps: Target frames per second for analysis (lower = less CPU)
            enabled: Whether to enable camera on startup
        """
        if not MEDIAPIPE_AVAILABLE:
            logger.error("MediaPipe not available; webcam analysis disabled")
            self.enabled = False
            return
        
        self.enabled = enabled
        self.camera_index = camera_index
        self.target_fps = target_fps
        self.frame_interval = 1.0 / target_fps if target_fps > 0 else 0.1
        
        self.cap = None
        self.mp_face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
        )
        
        self.eye_strain_detector = EyeStrainDetector()
        self.engagement_detector = FaceEngagementDetector()
        self.expression_detector = FacialExpressionDetector()
        
        self.last_metrics: Dict[str, Any] = {
            "face_engagement": 0.5,
            "eye_strain": 0.0,
            "face_detected": False,
            "timestamp": time.time(),
        }
        
        self.thread: Optional[threading.Thread] = None
        self.running = False
        self.lock = threading.Lock()
        self._consecutive_read_failures = 0
        self._last_read_warning_at = 0.0
        
    def start(self):
        """Start webcam capture thread."""
        if not self.enabled or not MEDIAPIPE_AVAILABLE:
            return
        
        if self.running:
            logger.warning("Webcam capture already running")
            return
        
        try:
            self.cap = cv2.VideoCapture(self.camera_index)
            if not self.cap.isOpened():
                logger.error("Failed to open camera %d", self.camera_index)
                self.enabled = False
                return
            
            self.running = True
            self.thread = threading.Thread(target=self._capture_loop, daemon=True)
            self.thread.start()
            logger.info("Webcam capture started (FPS: %d)", self.target_fps)
        except Exception as e:
            logger.error("Error starting webcam capture: %s", e)
            self.enabled = False
    
    def stop(self):
        """Stop webcam capture thread."""
        if not self.running:
            return
        
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
        
        if self.cap:
            self.cap.release()
        
        logger.info("Webcam capture stopped")
    
    def _capture_loop(self):
        """Main capture loop running in background thread."""
        last_process_time = time.time()
        
        while self.running:
            try:
                if self.cap is None:
                    time.sleep(0.1)
                    continue

                ret, frame = self.cap.read()
                if not ret:
                    self._consecutive_read_failures += 1

                    now = time.time()
                    if (now - self._last_read_warning_at) >= 2.0:
                        logger.warning(
                            "Failed to read frame from camera (streak=%d)",
                            self._consecutive_read_failures,
                        )
                        self._last_read_warning_at = now

                    # Avoid tight spin-loop when camera is busy/unavailable.
                    time.sleep(0.12)

                    # After prolonged failures, mark metrics as unavailable to reduce stale state.
                    if self._consecutive_read_failures >= 25:
                        with self.lock:
                            self.last_metrics["face_detected"] = False
                            self.last_metrics["timestamp"] = now
                    continue

                self._consecutive_read_failures = 0
                
                # Process frame at target FPS
                current_time = time.time()
                if (current_time - last_process_time) < self.frame_interval:
                    time.sleep(0.01)  # Avoid busy-waiting
                    continue
                
                last_process_time = current_time
                self._process_frame(frame)
                
            except Exception as e:
                logger.error("Error in capture loop: %s", e)
                time.sleep(0.1)
    
    def _process_frame(self, frame: Any):
        """Process single frame for facial analysis."""
        try:
            # Convert BGR to RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.mp_face_mesh.process(rgb_frame)
            
            h, w, _ = frame.shape
            
            with self.lock:
                if results.multi_face_landmarks and len(results.multi_face_landmarks) > 0:
                    landmarks = results.multi_face_landmarks[0]
                    
                    # Extract face center
                    face_x = sum(lm.x for lm in landmarks.landmark) / len(landmarks.landmark)
                    face_y = sum(lm.y for lm in landmarks.landmark) / len(landmarks.landmark)
                    
                    # Calculate eye aspect ratios (EAR)
                    left_eye_ear = self._calculate_ear(landmarks, [362, 385, 387, 263, 373, 380])
                    right_eye_ear = self._calculate_ear(landmarks, [33, 160, 158, 133, 153, 144])
                    
                    # Update detectors
                    eye_metrics = self.eye_strain_detector.update(left_eye_ear, right_eye_ear)
                    engagement_metrics = self.engagement_detector.update(face_x, face_y, w, h)
                    
                    # Store metrics
                    self.last_metrics = {
                        "face_detected": True,
                        "face_engagement": engagement_metrics["average_engagement"],
                        "eye_strain": eye_metrics["strain_score"],
                        "blink_rate": eye_metrics["blink_rate"],
                        "eye_openness": eye_metrics["eye_openness"],
                        "looking_at_screen": engagement_metrics["looking_at_screen"],
                        "timestamp": time.time(),
                    }
                else:
                    self.last_metrics["face_detected"] = False
                    self.last_metrics["timestamp"] = time.time()
        
        except Exception as e:
            logger.error("Error processing frame: %s", e)
    
    @staticmethod
    def _calculate_ear(landmarks: Any, eye_indices: list) -> float:
        """Calculate Eye Aspect Ratio (EAR) for blink detection.
        
        Args:
            landmarks: Mediapipe face landmarks
            eye_indices: List of landmark indices for eye region
            
        Returns:
            Eye aspect ratio (higher = more open)
        """
        try:
            pts = [landmarks.landmark[i] for i in eye_indices]
            
            # Euclidean distances between key points
            d1 = ((pts[1].x - pts[5].x)**2 + (pts[1].y - pts[5].y)**2)**0.5
            d2 = ((pts[2].x - pts[4].x)**2 + (pts[2].y - pts[4].y)**2)**0.5
            d3 = ((pts[0].x - pts[3].x)**2 + (pts[0].y - pts[3].y)**2)**0.5
            
            # EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)
            ear = (d1 + d2) / (2.0 * d3) if d3 > 0 else 0.0
            return ear
        except Exception:
            return 5.0  # Neutral value
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current facial analysis metrics.
        
        Returns:
            Dict with engagement, eye_strain, and other metrics
        """
        with self.lock:
            return self.last_metrics.copy()
