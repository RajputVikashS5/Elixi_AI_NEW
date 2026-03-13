"""Builds workflow representation from decomposed steps."""


class WorkflowBuilder:
    def build(self, steps: list[str]) -> dict:
        return {
            "name": "Generated Workflow",
            "steps": [{"id": i + 1, "action": step} for i, step in enumerate(steps)],
        }
