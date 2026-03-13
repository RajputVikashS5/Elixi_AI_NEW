"""Audio capture stub for Phase 1."""


class AudioCapture:
    def start(self) -> dict:
        return {"capturing": True, "status": "stub"}

    def stop(self) -> dict:
        return {"capturing": False, "status": "stub"}
