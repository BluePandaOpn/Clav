#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_URL="${1:-https://github.com/BluePandaOpn/Clav.git}"
DEFAULT_BRANCH="${2:-main}"

echo "=============================================="
echo "  CLAVES :: Auto Repair / Update (Bash)"
echo "=============================================="

cd "$ROOT_DIR"

if ! command -v git >/dev/null 2>&1; then
  echo "[ERROR] git is required but was not found in PATH." >&2
  exit 1
fi

if [[ ! -d ".git" ]]; then
  stamp="$(date +%Y%m%d-%H%M%S)"
  target="$(cd "$ROOT_DIR/.." && pwd)/Claves-repair-$stamp"
  echo "[WARN] .git not found. Cloning clean copy to: $target"
  git clone --depth 1 "$REPO_URL" "$target"
  echo "[OK] Clean clone created: $target"
  exit 0
fi

echo "[INFO] Syncing from: $REPO_URL"
git remote set-url origin "$REPO_URL"
git fetch origin --prune

branch="$(git branch --show-current || true)"
if [[ -z "$branch" ]]; then
  branch="$DEFAULT_BRANCH"
fi

if ! git show-ref --verify --quiet "refs/remotes/origin/$branch"; then
  branch="$DEFAULT_BRANCH"
fi

echo "[WARN] Hard reset and clean will discard local changes."
git reset --hard "origin/$branch"
git clean -fd
git submodule update --init --recursive

echo "[OK] Project updated successfully from origin/$branch."
