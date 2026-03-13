"""Simple schedule parser placeholder."""


class Scheduler:
    def parse(self, command: str) -> dict:
        lower = command.lower()
        if "tomorrow" in lower:
            return {"when": "tomorrow", "parsed": True}
        if "today" in lower:
            return {"when": "today", "parsed": True}
        return {"when": "unspecified", "parsed": False}
