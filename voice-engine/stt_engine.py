"""Speech-to-text engine stub."""


class STTEngine:
    def transcribe(self, audio_bytes: bytes) -> str:
        if not audio_bytes:
            return ""

        # In Phase 3, permit UTF-8 text payloads over the stream as a bridge-safe fallback.
        try:
            return audio_bytes.decode("utf-8").strip()
        except UnicodeDecodeError:
            return ""
