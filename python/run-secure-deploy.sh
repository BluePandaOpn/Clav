#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
exec sh python/script/03-full.sh "$@"
