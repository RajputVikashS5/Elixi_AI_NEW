"""Offline speech-to-text engine.

Priority chain:
  1. faster-whisper  (auto-downloads ``tiny`` model on first use)
  2. Vosk            (requires ELIXI_VOSK_MODEL_PATH env var pointing at a model dir)
  3. Windows System.Speech  (WAV only; always available on Windows)
"""

from __future__ import annotations

import io
import json
import logging
import os
import subprocess
import tempfile
import wave
from pathlib import Path
#vkbnbnsdivs
# Prevent OpenMP duplicate-library crash when ctranslate2 is loaded alongside
# other packages that also bundle OpenMP (e.g. pywin32 internals).
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

from voice_activity_detector import VoiceActivityDetector

logger = logging.getLogger(__name__)

# ─── optional: faster-whisper ────────────────────────────────────────────────
try:
    from faster_whisper import WhisperModel as _WhisperModel
    _WHISPER_AVAILABLE = True
except ImportError:
    _WhisperModel = None  # type: ignore[assignment, misc]
    _WHISPER_AVAILABLE = False

# ─── optional: vosk ──────────────────────────────────────────────────────────
try:
    from vosk import KaldiRecognizer as _KaldiRecognizer
    from vosk import Model as _VoskModel
    _VOSK_AVAILABLE = True
except ImportError:
    _KaldiRecognizer = None  # type: ignore[assignment]
    _VoskModel = None  # type: ignore[assignment]
    _VOSK_AVAILABLE = False

_WHISPER_MODEL_SIZE: str = os.environ.get("ELIXI_WHISPER_MODEL", "tiny")
_VOSK_MODEL_PATH: str = os.environ.get("ELIXI_VOSK_MODEL_PATH", "")


class STTEngine:
    def __init__(self) -> None:
        self.vad = VoiceActivityDetector()
        self._whisper: "_WhisperModel | None" = None
        self._vosk_model: "_VoskModel | None" = None
        self._whisper_loaded = False
        self._vosk_loaded = False
        self._init_engines()

    # ─── initialisation ──────────────────────────────────────────────────────

    def _init_engines(self) -> None:
        if _WHISPER_AVAILABLE:
            try:
                self._whisper = _WhisperModel(
                    _WHISPER_MODEL_SIZE,
                    device="cpu",
                    compute_type="int8",
                )
                self._whisper_loaded = True
                logger.info("faster-whisper loaded (model=%s)", _WHISPER_MODEL_SIZE)
            except Exception as exc:
                logger.warning("faster-whisper init failed: %s", exc)

        if _VOSK_AVAILABLE and _VOSK_MODEL_PATH and Path(_VOSK_MODEL_PATH).exists():
            try:
                self._vosk_model = _VoskModel(_VOSK_MODEL_PATH)
                self._vosk_loaded = True
                logger.info("Vosk loaded (path=%s)", _VOSK_MODEL_PATH)
            except Exception as exc:
                logger.warning("Vosk init failed: %s", exc)

    # ─── public API ──────────────────────────────────────────────────────────

    def get_capabilities(self) -> dict:
        return {
            "whisper": self._whisper_loaded,
            "whisperModel": _WHISPER_MODEL_SIZE if self._whisper_loaded else None,
            "vosk": self._vosk_loaded,
            "windowsFallback": True,
        }

    def transcribe(self, audio_bytes: bytes) -> str:
        if not audio_bytes:
            return ""

        # Quick passthrough for text / JSON payloads (used in testing)
        text_fallback = self._decode_text_fallback(audio_bytes)
        if text_fallback:
            return text_fallback

        is_wav = audio_bytes.startswith(b"RIFF") and b"WAVE" in audio_bytes[:16]

        if self._whisper_loaded:
            result = self._transcribe_whisper(audio_bytes, is_wav)
            if result:
                return result

        if self._vosk_loaded:
            result = self._transcribe_vosk(audio_bytes, is_wav)
            if result:
                return result

        if is_wav:
            return self._transcribe_windows_wave(audio_bytes)

        return ""

    # ─── private helpers ─────────────────────────────────────────────────────

    def _decode_text_fallback(self, audio_bytes: bytes) -> str:
        try:
            decoded = audio_bytes.decode("utf-8").strip()
        except UnicodeDecodeError:
            return ""

        if not decoded:
            return ""

        if decoded.startswith("{"):
            try:
                payload = json.loads(decoded)
            except json.JSONDecodeError:
                return decoded
            return str(payload.get("text") or payload.get("transcript") or "").strip()

        printable_ratio = sum(c.isprintable() for c in decoded) / max(len(decoded), 1)
        return decoded if printable_ratio > 0.9 else ""

    def _ensure_wav(self, audio_bytes: bytes, is_wav: bool) -> bytes:
        if is_wav:
            return audio_bytes
        return self._pcm_s16le_to_wav(audio_bytes)

    @staticmethod
    def _pcm_s16le_to_wav(pcm: bytes, sample_rate: int = 16000) -> bytes:
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(pcm)
        return buf.getvalue()

    def _transcribe_whisper(self, audio_bytes: bytes, is_wav: bool) -> str:
        wav_bytes = self._ensure_wav(audio_bytes, is_wav)
        if not wav_bytes:
            return ""

        tmp_path = ""
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
                f.write(wav_bytes)
                tmp_path = f.name

            segments, _info = self._whisper.transcribe(
                tmp_path, language="en", beam_size=1
            )
            return " ".join(seg.text for seg in segments).strip()
        except Exception as exc:
            logger.debug("Whisper transcription error: %s", exc)
            return ""
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    def _transcribe_vosk(self, audio_bytes: bytes, is_wav: bool) -> str:
        wav_bytes = self._ensure_wav(audio_bytes, is_wav)
        if not wav_bytes:
            return ""

        try:
            with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
                sample_rate = wf.getframerate()
                pcm = wf.readframes(wf.getnframes())
        except Exception:
            return ""

        try:
            rec = _KaldiRecognizer(self._vosk_model, sample_rate)
            rec.AcceptWaveform(pcm)
            result = json.loads(rec.FinalResult())
            return result.get("text", "").strip()
        except Exception as exc:
            logger.debug("Vosk transcription error: %s", exc)
            return ""

    def _transcribe_windows_wave(self, audio_bytes: bytes) -> str:
        script = r"""
param([string]$AudioPath)
Add-Type -AssemblyName System.Speech
$engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine
$engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
$engine.SetInputToWaveFile($AudioPath)
$parts = New-Object System.Collections.Generic.List[string]
while ($true) {
    $result = $engine.Recognize()
    if ($null -eq $result) { break }
    if ($result.Text) { [void]$parts.Add($result.Text) }
}
$engine.Dispose()
if ($parts.Count -gt 0) { $parts -join ' ' }
"""
        audio_path = ""
        script_path = ""
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
                f.write(audio_bytes)
                audio_path = f.name

            with tempfile.NamedTemporaryFile(
                delete=False, suffix=".ps1", mode="w", encoding="utf-8"
            ) as f:
                f.write(script)
                script_path = f.name

            result = subprocess.run(
                [
                    "powershell",
                    "-NoProfile",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-File",
                    script_path,
                    audio_path,
                ],
                capture_output=True,
                text=True,
                timeout=25,
                check=False,
            )
            return result.stdout.strip() if result.returncode == 0 else ""
        except (OSError, subprocess.SubprocessError):
            return ""
        finally:
            for path in (audio_path, script_path):
                if path and os.path.exists(path):
                    os.unlink(path)
