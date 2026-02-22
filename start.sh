#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_DIR="$ROOT_DIR/script"
PROFILE="${1:-auto}"

echo "=============================================="
echo "  CLAVES :: Unix Launcher"
echo "  Profile: $PROFILE"
echo "=============================================="

if [[ ! -d "$SCRIPT_DIR" ]]; then
  echo "[ERROR] Missing folder: $SCRIPT_DIR" >&2
  exit 1
fi

run_one() {
  local file="$1"
  echo "----------------------------------------------"
  echo "[RUN] $file"
  bash "$SCRIPT_DIR/$file"
}

run_setup_core() {
  run_one "01-install.sh"
  run_one "03-quality.sh"
  run_one "04-build.sh"
  run_one "05-doctor.sh"
}

run_setup_with_repair() {
  if run_setup_core; then
    return 0
  fi
  echo "[WARN] Setup pipeline failed. Running project auto-repair/update..."
  bash "$ROOT_DIR/update.sh"
  echo "[INFO] Retry setup after update..."
  run_setup_core
}

start_python_secure() {
  echo "----------------------------------------------"
  echo "[RUN] python secure auto-start"
  if [[ -x "$ROOT_DIR/python/script/03-full.sh" ]]; then
    "$ROOT_DIR/python/script/03-full.sh"
    return $?
  fi
  echo "[ERROR] Missing python secure launcher: $ROOT_DIR/python/script/03-full.sh" >&2
  return 1
}

case "$PROFILE" in
  auto)
    run_setup_with_repair
    start_python_secure
    ;;
  setup)
    run_setup_with_repair
    ;;
  dev)
    run_one "01-install.sh"
    run_one "02-dev.sh"
    ;;
  all)
    run_one "01-install.sh"
    run_one "02-dev.sh"
    run_one "03-quality.sh"
    run_one "04-build.sh"
    run_one "05-doctor.sh"
    ;;
  *)
    echo "[ERROR] Unknown profile: $PROFILE" >&2
    echo "Usage: ./start.sh [auto|setup|dev|all]" >&2
    exit 1
    ;;
esac

echo "[OK] Launcher completed."
