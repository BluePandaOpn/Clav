#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

banner "CLAVES :: Quality (Bash)"
assert_cmd npm
cd "$PROJECT_ROOT"
run_with_anim "npm run lint" npm run lint
set +e
run_with_anim "npm run format:check (advisory)" npm run format:check
fmt_rc=$?
set -e
if [[ $fmt_rc -ne 0 ]]; then
  echo "[WARN] format:check reported style differences (continuing)."
fi
echo "[DONE] Quality checks completed."
