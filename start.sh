#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_DIR="$ROOT_DIR/script"
PROFILE="${1:-setup}"

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

case "$PROFILE" in
  setup)
    run_one "01-install.sh"
    run_one "03-quality.sh"
    run_one "04-build.sh"
    run_one "05-doctor.sh"
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
    echo "Usage: ./start.sh [setup|dev|all]" >&2
    exit 1
    ;;
esac

echo "[OK] Launcher completed."
