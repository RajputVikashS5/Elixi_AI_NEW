"""Wake-word detector stub."""


class WakeWordDetector:
    def start(self) -> dict:
        return {"running": True, "status": "stub"}

    def stop(self) -> dict:
        return {"running": False, "status": "stub"}
