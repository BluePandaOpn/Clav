#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

banner "CLAVES :: Build (Bash)"
assert_cmd npm
cd "$PROJECT_ROOT"
run_with_anim "npm run build" npm run build
echo "[DONE] Build completed."
