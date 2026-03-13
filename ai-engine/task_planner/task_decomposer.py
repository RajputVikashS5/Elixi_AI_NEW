"""Basic task decomposition for Phase 1."""


class TaskDecomposer:
    def decompose(self, command: str) -> list[str]:
        separators = [" and then ", " then ", " and ", ","]
        tasks = [command]
        for sep in separators:
            if sep in command.lower():
                tasks = [x.strip() for x in command.split(sep) if x.strip()]
                break
        return tasks
