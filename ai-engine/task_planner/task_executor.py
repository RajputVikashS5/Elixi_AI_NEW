"""Task execution stub for planning output."""


class TaskExecutor:
    async def execute(self, steps: list[str]) -> dict:
        # Phase 1 does not execute tasks in AI engine; backend automation handles execution.
        return {
            "executed": False,
            "steps": [{"step": s, "status": "planned"} for s in steps],
        }
