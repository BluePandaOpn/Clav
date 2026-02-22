#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

banner() {
  local title="$1"
  printf "\n==============================================\n"
  printf "  %s\n" "$title"
  printf "==============================================\n"
}

step() {
  local message="$1"
  printf "[STEP] %s\n" "$message"
}

assert_cmd() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    printf "[ERROR] Required command not found: %s\n" "$name" >&2
    exit 1
  fi
}

run_with_anim() {
  local title="$1"
  shift
  local cmd=("$@")
  local frames=("-" "\\" "|" "/")
  local i

  printf "[RUN ] %s\n" "$title"
  for i in {0..9}; do
    printf "\r[....] %s %s" "$title" "${frames[$((i % 4))]}"
    sleep 0.06
  done
  printf "\r"
  "${cmd[@]}"
  printf "[OK  ] %s\n" "$title"
}
