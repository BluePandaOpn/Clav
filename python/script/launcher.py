#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
PY_DIR = ROOT / "python"
BOOTSTRAP = PY_DIR / "bootstrap_venv.py"
DEPLOY = PY_DIR / "deploy_secure.py"


def info(message: str) -> None:
    print(f"[python-script] {message}")


def fail(message: str, code: int = 1) -> None:
    print(f"[python-script][error] {message}", file=sys.stderr)
    raise SystemExit(code)


def venv_python() -> Path:
    if os.name == "nt":
        return PY_DIR / ".venv" / "Scripts" / "python.exe"
    return PY_DIR / ".venv" / "bin" / "python"


def run_with_spinner(command: list[str], title: str, env: dict[str, str] | None = None) -> None:
    spinner = "|/-\\"
    try:
        proc = subprocess.Popen(command, cwd=str(ROOT), env=env)
    except FileNotFoundError:
        fail(f"No se encontro el ejecutable: {command[0]}. Verifica que este instalado y en PATH.")
    idx = 0
    while proc.poll() is None:
        symbol = spinner[idx % len(spinner)]
        print(f"\r[{symbol}] {title}", end="", flush=True)
        idx += 1
        time.sleep(0.12)
    print("\r", end="", flush=True)
    if proc.returncode != 0:
        fail(f"Command failed ({proc.returncode}): {' '.join(command)}")
    print(f"[ok] {title}")


def ensure_venv() -> None:
    if not BOOTSTRAP.exists():
        fail(f"Missing bootstrap file: {BOOTSTRAP}")
    run_with_spinner([sys.executable, str(BOOTSTRAP)], "Configurando entorno virtual (.venv)")
    if not venv_python().exists():
        fail(f"No se encontro Python de .venv: {venv_python()}")


def npm_install() -> None:
    npm_exec = "npm.cmd" if os.name == "nt" else "npm"
    npm_path = shutil.which(npm_exec)
    if not npm_path:
        fail(
            f"No se encontro {npm_exec} en PATH. Instala Node.js y reabre la terminal para actualizar PATH."
        )
    run_with_spinner([npm_path, "install"], "Instalando dependencias npm")


def deploy_secure(mode: str, extra: list[str]) -> None:
    py = venv_python()
    if mode == "setup":
        info("Setup completado.")
        return
    if mode == "run":
        cmd = [
            str(py),
            str(DEPLOY),
            "serve",
            "--with-api",
            "--api-https",
            "--enable-http-redirect",
        ] + extra
    else:
        cmd = [
            str(py),
            str(DEPLOY),
            "full",
            "--with-api",
            "--api-https",
            "--enable-http-redirect",
            "--watch",
        ] + extra
    info(f"Iniciando deploy seguro ({mode})")
    result = subprocess.run(cmd, cwd=str(ROOT), check=False)
    if result.returncode != 0:
        fail(f"deploy_secure.py finalizo con codigo {result.returncode}", result.returncode)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Python script launcher with automatic setup and animations.")
    parser.add_argument("mode", choices=["setup", "run", "full"], help="Execution profile")
    parser.add_argument("extra", nargs="*", help="Extra args passed to deploy_secure.py")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    ensure_venv()
    npm_install()
    deploy_secure(args.mode, args.extra)


if __name__ == "__main__":
    main()
