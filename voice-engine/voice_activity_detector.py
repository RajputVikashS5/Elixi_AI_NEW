"""Voice activity detector using webrtcvad (primary) and RMS heuristics (fallback)."""

from __future__ import annotations

import audioop
import io
import wave

try:
    import webrtcvad as _webrtcvad
    _WEBRTCVAD_AVAILABLE = True
except ImportError:
    _webrtcvad = None  # type: ignore[assignment]
    _WEBRTCVAD_AVAILABLE = False


class VoiceActivityDetector:
    """
    Detects speech in audio frames.

    Uses Google WebRTC VAD as primary engine when the ``webrtcvad-wheels``
    package is installed, then falls back to RMS energy heuristics.
    """

    _SUPPORTED_RATES = frozenset({8000, 16000, 32000, 48000})

    def __init__(
        self,
        aggressiveness: int = 2,
        energy_threshold: int = 250,
        min_duration_ms: int = 120,
    ) -> None:
        self.aggressiveness = aggressiveness
        self.energy_threshold = energy_threshold
        self.min_duration_ms = min_duration_ms
        self._vad = _webrtcvad.Vad(aggressiveness) if _WEBRTCVAD_AVAILABLE else None

    # ─── audio extraction helpers ────────────────────────────────────────────

    def _extract_pcm(self, audio_frame: bytes) -> tuple[bytes, int, int]:
        if not audio_frame:
            return b"", 2, 16000

        if audio_frame.startswith(b"RIFF") and b"WAVE" in audio_frame[:16]:
            with wave.open(io.BytesIO(audio_frame), "rb") as wav_file:
                sample_width = wav_file.getsampwidth()
                frame_rate = wav_file.getframerate()
                channels = wav_file.getnchannels()
                pcm = wav_file.readframes(wav_file.getnframes())
                if channels > 1:
                    pcm = audioop.tomono(pcm, sample_width, 0.5, 0.5)
                return pcm, sample_width, frame_rate

        # Treat as raw PCM S16LE at 16 kHz mono
        return audio_frame, 2, 16000

    # ─── webrtcvad path ───────────────────────────────────────────────────────

    def _webrtcvad_detect(self, pcm: bytes, sample_rate: int) -> bool:
        """Run webrtcvad over 20 ms chunks; voice if >30 % frames are speech."""
        if sample_rate not in self._SUPPORTED_RATES:
            try:
                pcm, _ = audioop.ratecv(pcm, 2, 1, sample_rate, 16000, None)
                sample_rate = 16000
            except audioop.error:
                return False

        frame_bytes = int(sample_rate * 2 * 0.020)  # 20 ms × 2 bytes/sample
        speech_frames = 0
        total_frames = 0

        for i in range(0, len(pcm) - frame_bytes + 1, frame_bytes):
            frame = pcm[i : i + frame_bytes]
            if len(frame) != frame_bytes:
                continue
            total_frames += 1
            try:
                if self._vad.is_speech(frame, sample_rate):
                    speech_frames += 1
            except Exception:
                pass

        if total_frames == 0:
            return False

        return (speech_frames / total_frames) > 0.30

    # ─── public API ──────────────────────────────────────────────────────────

    def analyze(self, audio_frame: bytes) -> dict:
        pcm, sample_width, frame_rate = self._extract_pcm(audio_frame)
        if not pcm:
            return {
                "speech_detected": False,
                "rms": 0,
                "duration_ms": 0.0,
                "method": "none",
            }

        duration_ms = (len(pcm) / max(sample_width, 1) / max(frame_rate, 1)) * 1000

        try:
            rms = audioop.rms(pcm, sample_width)
        except audioop.error:
            rms = 0

        if self._vad is not None:
            speech_detected = self._webrtcvad_detect(pcm, frame_rate)
            return {
                "speech_detected": speech_detected,
                "rms": rms,
                "duration_ms": round(duration_ms, 2),
                "method": "webrtcvad",
            }

        # RMS fallback
        speech_detected = (
            duration_ms >= self.min_duration_ms and rms >= self.energy_threshold
        )
        return {
            "speech_detected": speech_detected,
            "rms": rms,
            "duration_ms": round(duration_ms, 2),
            "method": "rms",
        }

    def detect(self, audio_frame: bytes) -> bool:
        return self.analyze(audio_frame)["speech_detected"]
