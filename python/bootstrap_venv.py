#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import sys
import venv
from pathlib import Path


PY_DIR = Path(__file__).resolve().parent
VENV_DIR = PY_DIR / ".venv"
REQ_FILE = PY_DIR / "requirements.txt"


def run(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, cwd=str(PY_DIR.parent))
    if proc.returncode != 0:
        raise SystemExit(proc.returncode)


def venv_python() -> Path:
    if sys.platform.startswith("win"):
        return VENV_DIR / "Scripts" / "python.exe"
    return VENV_DIR / "bin" / "python"


def create_venv_if_missing() -> None:
    if VENV_DIR.exists():
        print("[python-venv] .venv already exists")
        return
    print("[python-venv] creating .venv")
    builder = venv.EnvBuilder(with_pip=True, clear=False, symlinks=False, upgrade=False, with_prompt="python-deploy")
    builder.create(str(VENV_DIR))


def install_requirements() -> None:
    py = venv_python()
    if not py.exists():
        raise SystemExit("[python-venv][error] venv python not found after creation")
    print("[python-venv] upgrading pip/setuptools/wheel")
    run([str(py), "-m", "pip", "install", "--upgrade", "pip", "setuptools", "wheel"])
    if REQ_FILE.exists():
        print("[python-venv] installing requirements")
        run([str(py), "-m", "pip", "install", "-r", str(REQ_FILE)])
    else:
        print("[python-venv] requirements.txt not found, skipping")


def main() -> None:
    create_venv_if_missing()
    install_requirements()
    print(f"[python-venv] ready: {VENV_DIR}")


if __name__ == "__main__":
    main()
