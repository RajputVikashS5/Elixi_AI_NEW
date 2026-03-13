"""Basic file operations used by automation workflows."""

from pathlib import Path


def create_file(path: str, content: str = "") -> dict:
    file_path = Path(path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content, encoding="utf-8")
    return {"success": True, "path": str(file_path)}


def read_file(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def list_files(path: str) -> list[dict]:
    p = Path(path)
    return [{"name": child.name, "is_dir": child.is_dir()} for child in p.iterdir()]
