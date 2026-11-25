#!/usr/bin/env bash
# Build and run FreeKards from this checkout, without installing (Linux; spec runtimes/electron.md
# §Running a local build, D-063). Runs whatever branch is checked out. Used by the "FreeKards (local
# build)" menu entry that scripts/install-local-launcher.sh creates.
#
# Uses the same player data as an installed FreeKards (~/.config/cardtable). Only one copy of the
# app can run at a time, so close an installed FreeKards first.
set -uo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
log="$repo/.cache/run-local.log"
mkdir -p "$repo/.cache"
cd "$repo" || exit 1

notify() { command -v notify-send >/dev/null && notify-send --app-name=FreeKards "$@"; }

version="$(git branch --show-current 2>/dev/null || true) @ $(git rev-parse --short HEAD 2>/dev/null || echo '?')"
if ! git diff --quiet HEAD 2>/dev/null; then version="$version (with uncommitted changes)"; fi

if pgrep -x freekards >/dev/null; then
  notify -i dialog-warning "FreeKards is already open" "Close the installed FreeKards first, then start the local build again."
  exit 1
fi

notify -i applications-games "Building FreeKards" "$version"
{
  echo "=== $(date '+%F %T')  $version"
  # nvm is not loaded in a desktop session; the repo's .nvmrc picks the Node version (D-011).
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh" && nvm use >/dev/null
  npm run build
} >"$log" 2>&1
status=$?
if [ $status -ne 0 ]; then
  notify -i dialog-error "FreeKards build failed" "Details are in $log"
  exit $status
fi

exec "$repo/node_modules/.bin/electron" . >>"$log" 2>&1
