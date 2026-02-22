#!/usr/bin/env bash
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

banner "CLAVES :: Dev (Bash)"
assert_cmd npm
cd "$PROJECT_ROOT"
step "Starting full dev mode (client + server)."
npm run dev
