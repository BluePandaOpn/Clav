#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

banner "CLAVES :: Install (Bash)"
assert_cmd node
assert_cmd npm
cd "$PROJECT_ROOT"
run_with_anim "npm install" npm install
echo "[DONE] Install completed."
