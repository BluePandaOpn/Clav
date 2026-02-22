#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

banner "CLAVES :: Quality (Bash)"
assert_cmd npm
cd "$PROJECT_ROOT"
run_with_anim "npm run lint" npm run lint
run_with_anim "npm run format:check" npm run format:check
echo "[DONE] Quality checks completed."
