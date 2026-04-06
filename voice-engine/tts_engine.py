"""Text-to-speech engine with configurable rate, volume, and voice.

Primary:  pyttsx3  (wraps Windows SAPI5 with Python-level control)
Fallback: Windows System.Speech via PowerShell subprocess
"""

from __future__ import annotations

import logging
import os
import subprocess
import tempfile
from dataclasses import dataclass

logger = logging.getLogger(__name__)

try:
    import pyttsx3 as _pyttsx3
    _PYTTSX3_AVAILABLE = True
except ImportError:
    _pyttsx3 = None  # type: ignore[assignment]
    _PYTTSX3_AVAILABLE = False


@dataclass
class TTSSettings:
    """Runtime TTS configuration."""

    # Words-per-minute: maps loosely to SAPI5 rate (-10 … +10 internally).
    rate: int = 175
    # Volume: 0.0 (silent) – 1.0 (full).
    volume: float = 1.0
    # SAPI voice ID or name substring (None = system default).
    voice_id: str | None = None

    # Clamp volume to valid range on assignment.
    def __post_init__(self) -> None:
        self.volume = max(0.0, min(1.0, self.volume))
        self.rate = max(50, min(400, self.rate))


_DEFAULT_SETTINGS = TTSSettings()


def _wpm_to_sapi_rate(wpm: int) -> int:
    """Map words-per-minute to SAPI5 rate (-10 … +10)."""
    # 175 WPM ≈ rate 0; every 25 WPM step ≈ 1 SAPI unit.
    return max(-10, min(10, round((wpm - 175) / 25)))


def _list_voices_powershell() -> list[dict]:
    """Enumerate SAPI5 voices via PowerShell and return id/name pairs."""
    script = r"""
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.GetInstalledVoices() | ForEach-Object {
    $v = $_.VoiceInfo
    [PSCustomObject]@{ id = $v.Id; name = $v.Name; gender = $v.Gender.ToString(); culture = $v.Culture.Name }
} | ConvertTo-Json -Compress
$synth.Dispose()
"""
    script_path = ""
    try:
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=".ps1", mode="w", encoding="utf-8"
        ) as f:
            f.write(script)
            script_path = f.name

        result = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script_path],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        if result.returncode != 0 or not result.stdout.strip():
            return []

        import json
        raw = json.loads(result.stdout.strip())
        # PowerShell returns a dict (not list) when only one voice is installed.
        if isinstance(raw, dict):
            raw = [raw]
        return [
            {
                "id": v.get("id", ""),
                "name": v.get("name", ""),
                "gender": v.get("gender", ""),
                "culture": v.get("culture", ""),
            }
            for v in raw
        ]
    except Exception as exc:
        logger.debug("list_voices_powershell failed: %s", exc)
        return []
    finally:
        if script_path and os.path.exists(script_path):
            os.unlink(script_path)


class TTSEngine:
    def __init__(self) -> None:
        self._settings: TTSSettings = TTSSettings()
        self._pyttsx3_engine: "object | None" = None
        self._init_pyttsx3()

    # ─── initialisation ──────────────────────────────────────────────────────

    def _init_pyttsx3(self) -> None:
        if not _PYTTSX3_AVAILABLE:
            return
        try:
            engine = _pyttsx3.init()
            self._pyttsx3_engine = engine
            logger.info("pyttsx3 TTS engine loaded")
        except Exception as exc:
            logger.warning("pyttsx3 init failed: %s", exc)

    # ─── public API ──────────────────────────────────────────────────────────

    def apply_settings(self, settings: TTSSettings) -> None:
        self._settings = settings

    def list_voices(self) -> list[dict]:
        """Return available SAPI5 voices with id, name, gender, and culture."""
        return _list_voices_powershell()

    def synthesize(self, text: str, overrides: TTSSettings | None = None) -> bytes:
        if not text.strip():
            return b""

        effective_settings = overrides if overrides is not None else self._settings

        if self._pyttsx3_engine is not None:
            result = self._synthesize_pyttsx3(text, effective_settings)
            if result:
                return result

        return self._synthesize_windows_speech(text, effective_settings)

    # ─── backend implementations ─────────────────────────────────────────────

    def _synthesize_pyttsx3(self, text: str, settings: TTSSettings) -> bytes:
        engine = self._pyttsx3_engine
        output_path = ""
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
                output_path = f.name

            engine.setProperty("rate", settings.rate)
            engine.setProperty("volume", settings.volume)
            if settings.voice_id:
                engine.setProperty("voice", settings.voice_id)

            engine.save_to_file(text.strip(), output_path)
            engine.runAndWait()

            if os.path.exists(output_path) and os.path.getsize(output_path) > 0:
                with open(output_path, "rb") as fh:
                    return fh.read()

            return b""
        except Exception as exc:
            logger.debug("pyttsx3 synthesis error: %s", exc)
            return b""
        finally:
            if output_path and os.path.exists(output_path):
                os.unlink(output_path)

    def _synthesize_windows_speech(self, text: str, settings: TTSSettings) -> bytes:
        """PowerShell / System.Speech fallback with rate and volume support."""
        script = r"""
param([string]$OutputPath, [string]$SpeakText, [int]$SapiRate, [int]$VolumePct, [string]$VoiceName)
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SetOutputToWaveFile($OutputPath)
$synth.Rate = $SapiRate
$synth.Volume = $VolumePct
if ($VoiceName -ne '') { try { $synth.SelectVoice($VoiceName) } catch {} }
$synth.Speak($SpeakText)
$synth.Dispose()
"""
        output_path = ""
        script_path = ""
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
                output_path = f.name

            with tempfile.NamedTemporaryFile(
                delete=False, suffix=".ps1", mode="w", encoding="utf-8"
            ) as f:
                f.write(script)
                script_path = f.name

            sapi_rate = _wpm_to_sapi_rate(settings.rate)
            volume_pct = int(settings.volume * 100)
            voice_name = settings.voice_id or ""

            result = subprocess.run(
                [
                    "powershell",
                    "-NoProfile",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-File",
                    script_path,
                    output_path,
                    text.strip(),
                    str(sapi_rate),
                    str(volume_pct),
                    voice_name,
                ],
                capture_output=True,
                text=True,
                timeout=30,
                check=False,
            )

            if result.returncode != 0 or not os.path.exists(output_path):
                return b""

            with open(output_path, "rb") as fh:
                return fh.read()
        except (OSError, subprocess.SubprocessError) as exc:
            logger.debug("Windows Speech synthesis error: %s", exc)
            return b""
        finally:
            for path in (output_path, script_path):
                if path and os.path.exists(path):
                    os.unlink(path)
