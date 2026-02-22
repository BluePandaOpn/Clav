#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

banner "CLAVES :: Doctor (Bash)"
assert_cmd node
assert_cmd npm
assert_cmd git
cd "$PROJECT_ROOT"
run_with_anim "node -v" node -v
run_with_anim "npm -v" npm -v
run_with_anim "git status --short" git status --short
echo "[DONE] Doctor checks completed."
