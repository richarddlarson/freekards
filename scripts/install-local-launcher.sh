#!/usr/bin/env bash
# Add a "FreeKards (local build)" entry to the desktop menu that runs scripts/run-local.sh from this
# checkout (Linux; spec runtimes/electron.md §Running a local build, D-063). Run it once; run it
# again if the repo moves. Remove the entry with: rm ~/.local/share/applications/freekards-local.desktop
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
apps="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
entry="$apps/freekards-local.desktop"
mkdir -p "$apps"
chmod +x "$repo/scripts/run-local.sh"

cat >"$entry" <<EOF
[Desktop Entry]
Type=Application
Name=FreeKards (local build)
Comment=Build and run FreeKards from $repo
Exec="$repo/scripts/run-local.sh"
Path=$repo
Icon=applications-games
Terminal=false
Categories=Game;CardGame;
StartupWMClass=FreeKards
EOF
chmod +x "$entry"
command -v update-desktop-database >/dev/null && update-desktop-database "$apps" >/dev/null 2>&1 || true
echo "Added $entry"
