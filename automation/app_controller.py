"""Cross-platform app launcher utility."""

import os
import platform
import subprocess


def open_app(app_name: str) -> dict:
    system = platform.system().lower()
    if system == "windows":
        os.startfile(app_name)  # type: ignore[attr-defined]
    elif system == "darwin":
        subprocess.Popen(["open", "-a", app_name])
    else:
        subprocess.Popen(["xdg-open", app_name])
    return {"success": True, "app": app_name}
