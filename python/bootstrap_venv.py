#!/usr/bin/env python3
from __future__ import annotations

import subprocess
import sys
import shutil
import venv
from pathlib import Path


PY_DIR = Path(__file__).resolve().parent
VENV_DIR = PY_DIR / ".venv"
REQ_FILE = PY_DIR / "requirements.txt"


def run(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, cwd=str(PY_DIR.parent))
    if proc.returncode != 0:
        raise SystemExit(proc.returncode)


def run_optional(cmd: list[str]) -> bool:
    proc = subprocess.run(cmd, cwd=str(PY_DIR.parent))
    return proc.returncode == 0


def venv_python() -> Path:
    if sys.platform.startswith("win"):
        return VENV_DIR / "Scripts" / "python.exe"
    return VENV_DIR / "bin" / "python"


def create_venv_if_missing() -> None:
    py = venv_python()
    cfg = VENV_DIR / "pyvenv.cfg"
    if VENV_DIR.exists() and py.exists() and cfg.exists():
        print("[python-venv] .venv already exists")
        return
    if VENV_DIR.exists():
        print("[python-venv] removing broken .venv")
        shutil.rmtree(VENV_DIR, ignore_errors=True)
    print("[python-venv] creating .venv")
    # with_pip=False to avoid ensurepip failures in some Windows Store Python builds.
    builder = venv.EnvBuilder(with_pip=False, clear=False, symlinks=False, upgrade=False, prompt="python-deploy")
    builder.create(str(VENV_DIR))


def install_requirements() -> None:
    py = venv_python()
    if not py.exists():
        raise SystemExit("[python-venv][error] venv python not found after creation")
    pip_check = subprocess.run(
        [str(py), "-m", "pip", "--version"],
        cwd=str(PY_DIR.parent),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if pip_check.returncode != 0:
        print("[python-venv] pip not found in .venv, trying ensurepip")
        ensurepip = subprocess.run(
            [str(py), "-m", "ensurepip", "--upgrade"],
            cwd=str(PY_DIR.parent),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        if ensurepip.returncode != 0:
            print("[python-venv][warn] pip unavailable in this Python build; skipping pip package installation")
            return
    print("[python-venv] upgrading pip/setuptools")
    upgraded = run_optional([str(py), "-m", "pip", "install", "--upgrade", "pip", "setuptools"])
    if not upgraded:
        print("[python-venv][warn] no se pudo actualizar pip/setuptools, se continua con lo disponible")
    if REQ_FILE.exists():
        lines = [line.strip() for line in REQ_FILE.read_text(encoding="utf-8").splitlines()]
        installable = [line for line in lines if line and not line.startswith("#")]
        if not installable:
            print("[python-venv] requirements.txt sin paquetes, skip")
            return
        print("[python-venv] installing requirements")
        installed = run_optional([str(py), "-m", "pip", "install", "-r", str(REQ_FILE)])
        if not installed:
            print("[python-venv][warn] no se pudieron instalar todas las dependencias de requirements.txt")
    else:
        print("[python-venv] requirements.txt not found, skipping")


def main() -> None:
    create_venv_if_missing()
    install_requirements()
    print(f"[python-venv] ready: {VENV_DIR}")


if __name__ == "__main__":
    main()
