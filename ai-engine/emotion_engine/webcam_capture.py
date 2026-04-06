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
    """Detects emotional cues from facial expressions using facial landmarks."""
    
    def __init__(self):
        self.expression_history = deque(maxlen=30)
        # Landmark indices for key facial features
        # Reference: https://github.com/google/mediapipe/blob/master/mediapipe/surplus/face_mesh_indices.txt
        self.LEFT_EYE = [362, 385, 387, 263, 373, 380]
        self.RIGHT_EYE = [33, 160, 158, 133, 153, 144]
        self.MOUTH_CORNERS = [61, 291]  # Left and right corner of mouth
        self.MOUTH_TOP = [13]  # Top of mouth
        self.MOUTH_BOTTOM = [14]  # Bottom of mouth
        self.LEFT_EYEBROW = [105, 107, 66, 63, 70]  # Inner to outer
        self.RIGHT_EYEBROW = [336, 296, 334, 293, 300]  # Inner to outer
        self.JAW_LINE = [152, 148, 176, 149, 150, 136, 172, 58]  # For jaw detection
        
    @staticmethod
    def _distance(pt1: Any, pt2: Any) -> float:
        """Calculate distance between two landmarks."""
        return ((pt1.x - pt2.x)**2 + (pt1.y - pt2.y)**2)**0.5
    
    def _analyze_mouth(self, landmarks: Any) -> Dict[str, float]:
        """Analyze mouth expression (smile, frown, tension)."""
        try:
            mouth_left = landmarks.landmark[61]
            mouth_right = landmarks.landmark[291]
            mouth_top = landmarks.landmark[13]
            mouth_bottom = landmarks.landmark[14]
            
            # Mouth width
            mouth_width = self._distance(mouth_left, mouth_right)
            
            # Mouth height (openness)
            mouth_height = self._distance(mouth_top, mouth_bottom)
            
            # Mouth corners vertical position (positive = smile, negative = frown)
            mouth_corner_angle = (mouth_left.y + mouth_right.y) / 2 - mouth_top.y
            
            # Lip tension (how far corners are from relaxed position)
            corner_avg = (mouth_left.y + mouth_right.y) / 2
            
            return {
                "width": mouth_width,
                "height": mouth_height,
                "corner_angle": mouth_corner_angle,
                "smile_score": max(0, -mouth_corner_angle * 2),  # Higher when corners rise (smile)
                "frown_score": max(0, mouth_corner_angle * 2),   # Higher when corners drop (frown)
            }
        except Exception as e:
            logger.debug("Error analyzing mouth: %s", e)
            return {}
    
    def _analyze_eyebrows(self, landmarks: Any) -> Dict[str, float]:
        """Analyze eyebrow position (concern, surprise, focus)."""
        try:
            left_brow_inner = landmarks.landmark[105]
            left_brow_outer = landmarks.landmark[70]
            right_brow_inner = landmarks.landmark[336]
            right_brow_outer = landmarks.landmark[300]
            
            left_eye_top = landmarks.landmark[159]
            right_eye_top = landmarks.landmark[27]
            
            # Eyebrow raise (distance from eye)
            left_raise = left_brow_inner.y - left_eye_top.y
            right_raise = right_brow_inner.y - right_eye_top.y
            
            avg_raise = (left_raise + right_raise) / 2
            raise_score = max(0, -avg_raise * 3)  # Negative y = raised (surprise/concern)
            
            return {
                "left_raise": left_raise,
                "right_raise": right_raise,
                "avg_raise": avg_raise,
                "raise_score": raise_score,  # Higher = raised eyebrows (concern/surprise)
            }
        except Exception as e:
            logger.debug("Error analyzing eyebrows: %s", e)
            return {}
    
    def _analyze_eyes(self, landmarks: Any) -> Dict[str, float]:
        """Analyze eye expression (wide, squinting, intensity)."""
        try:
            # Eye openness (similar to EAR)
            left_eye_pts = [landmarks.landmark[i] for i in self.LEFT_EYE]
            right_eye_pts = [landmarks.landmark[i] for i in self.RIGHT_EYE]
            
            def calculate_ear(pts):
                if len(pts) >= 6:
                    d1 = self._distance(pts[1], pts[5])
                    d2 = self._distance(pts[2], pts[4])
                    d3 = self._distance(pts[0], pts[3])
                    return (d1 + d2) / (2.0 * d3) if d3 > 0 else 0
                return 0
            
            left_ear = calculate_ear(left_eye_pts)
            right_ear = calculate_ear(right_eye_pts)
            avg_ear = (left_ear + right_ear) / 2
            
            # Eye wideness (intensity/alertness)
            wideness_score = max(0, (avg_ear - 4.0) / 2)  # Normalized ~4-6 range
            
            # Eye squinting (focus/stress)
            squint_score = max(0, (5.5 - avg_ear) / 2)  # Inverse - lower = squinting
            
            return {
                "left_ear": left_ear,
                "right_ear": right_ear,
                "avg_ear": avg_ear,
                "wideness_score": wideness_score,   # Higher = wide alert eyes
                "squint_score": squint_score,       # Higher = squinting/focused
            }
        except Exception as e:
            logger.debug("Error analyzing eyes: %s", e)
            return {}
    
    def detect_from_landmarks(self, landmarks: Any, engagement: float = 0.5, eye_strain: float = 0.0) -> Dict[str, Any]:
        """Detect emotional expressions from facial landmarks.
        
        Args:
            landmarks: Mediapipe face landmarks
            engagement: User engagement score (0-1)
            eye_strain: Eye strain score (0-1)
            
        Returns:
            Dict with detected emotions including state and confidence
        """
        if landmarks is None:
            return {"state": "neutral", "confidence": 0.0, "summary": "No face detected"}
        
        try:
            # Analyze facial components
            mouth = self._analyze_mouth(landmarks)
            eyebrows = self._analyze_eyebrows(landmarks)
            eyes = self._analyze_eyes(landmarks)
            
            # Combine scores to determine emotion
            smile_score = mouth.get("smile_score", 0) * 0.6  # Weight smile heavily
            frown_score = mouth.get("frown_score", 0) * 0.6
            raise_score = eyebrows.get("raise_score", 0) * 0.3
            squint_score = eyes.get("squint_score", 0) * 0.4
            wideness_score = eyes.get("wideness_score", 0) * 0.3
            
            # Combine with context (engagement, eye strain)
            engagement_score = engagement * 0.5
            strain_score = eye_strain * 0.4
            
            # Determine primary emotion
            scores = {
                "motivated": smile_score + engagement_score + wideness_score * 0.5,
                "focused": engagement_score * 1.2 + squint_score + wideness_score * 0.3,
                "stressed": (eye_strain * 0.7 + raise_score * 0.8 + squint_score * 0.6 + 
                           frown_score * 0.5),
                "frustrated": frown_score * 1.2 + (1 - engagement_score) * 0.5 + raise_score * 0.4,
                "fatigued": (1 - wideness_score) * 0.8 + eye_strain * 0.6 + 
                           (1 - engagement_score) * 0.3,
            }
            
            # Find dominant emotion
            max_emotion = max(scores.items(), key=lambda x: x[1])
            dominant_emotion = max_emotion[0]
            raw_confidence = min(max_emotion[1] / 3.0, 1.0)  # Normalize to 0-1
            
            # Ensure minimum confidence threshold
            confidence = max(raw_confidence, 0.25) if raw_confidence > 0.1 else 0.0
            
            # Generate summary
            summary_parts = []
            if smile_score > 0.3:
                summary_parts.append("positive expression")
            elif frown_score > 0.3:
                summary_parts.append("frowning")
            if raise_score > 0.3:
                summary_parts.append("raised eyebrows")
            if squint_score > 0.3:
                summary_parts.append("focused/intense look")
            if eye_strain > 0.6:
                summary_parts.append("eye strain visible")
            if engagement < 0.3:
                summary_parts.append("looking away")
            
            summary = ", ".join(summary_parts) if summary_parts else "neutral expression"
            
            self.expression_history.append({
                "state": dominant_emotion,
                "confidence": confidence,
                "scores": scores,
            })
            
            return {
                "state": dominant_emotion,
                "confidence": confidence,
                "summary": summary,
                "raw_scores": scores,
                "facial_cues": {
                    "smile": smile_score,
                    "frown": frown_score,
                    "raised_brows": raise_score,
                    "squint": squint_score,
                    "eye_wideness": wideness_score,
                }
            }
        except Exception as e:
            logger.warning("Error detecting facial expression: %s", e)
            return {"state": "neutral", "confidence": 0.0, "summary": "Expression analysis error"}


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
                logger.error("Failed to open camera %d (device may not exist or is in use)", self.camera_index)
                self.enabled = False
                self.cap = None
                return
            
            # Try to read one frame to verify camera is actually working
            ret, _ = self.cap.read()
            if not ret:
                logger.error("Camera opened but failed to read frame. Check if device is in use or drivers are working.")
                self.cap.release()
                self.cap = None
                self.enabled = False
                return
            
            self.running = True
            self.thread = threading.Thread(target=self._capture_loop, daemon=True)
            self.thread.start()
            logger.info("Webcam capture started (FPS: %d)", self.target_fps)
        except Exception as e:
            logger.error("Error starting webcam capture: %s", e)
            self.enabled = False
            if self.cap:
                self.cap.release()
                self.cap = None
    
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
                    # Only log on first failure or periodically (not every cycle)
                    if (now - self._last_read_warning_at) >= 5.0:  # Log every 5 seconds max
                        if self._consecutive_read_failures == 1:
                            logger.warning("Camera read failed. Device may be in use or inaccessible.")
                        elif self._consecutive_read_failures % 100 == 0:
                            logger.warning("Camera read failures continue (%d). Consider disabling camera.", self._consecutive_read_failures)
                        self._last_read_warning_at = now

                    # After prolonged failures, disable camera to stop logging noise
                    if self._consecutive_read_failures >= 100:
                        logger.error("Camera disabled after 100 consecutive read failures")
                        self.running = False
                        self.enabled = False
                        if self.cap:
                            self.cap.release()
                            self.cap = None
                        break

                    # Exponential backoff to reduce CPU spinning
                    backoff_time = min(0.1 * (1 + self._consecutive_read_failures / 200), 2.0)
                    time.sleep(backoff_time)

                    # After prolonged failures, mark metrics as unavailable
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
                    
                    # Get engagement and strain scores for expression analysis
                    engagement_score = engagement_metrics["average_engagement"]
                    strain_score = eye_metrics["strain_score"]
                    
                    # Analyze facial expressions
                    expression = self.expression_detector.detect_from_landmarks(
                        landmarks,
                        engagement=engagement_score,
                        eye_strain=strain_score
                    )
                    
                    # Store metrics with facial expression data
                    self.last_metrics = {
                        "face_detected": True,
                        "face_engagement": engagement_score,
                        "eye_strain": strain_score,
                        "blink_rate": eye_metrics["blink_rate"],
                        "eye_openness": eye_metrics["eye_openness"],
                        "looking_at_screen": engagement_metrics["looking_at_screen"],
                        "facial_expression": expression.get("state", "neutral"),
                        "expression_confidence": expression.get("confidence", 0),
                        "expression_summary": expression.get("summary", ""),
                        "facial_cues": expression.get("facial_cues", {}),
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
