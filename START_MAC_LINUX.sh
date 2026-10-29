#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
SANDBOX_DIR="$ROOT_DIR/sandbox"
URL="http://127.0.0.1:8765/#/overview"

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3.10 or newer is required: https://www.python.org/downloads/"
  exit 1
fi

cd "$SANDBOX_DIR"
(
  sleep 2
  if command -v open >/dev/null 2>&1; then
    open "$URL"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL"
  fi
) &

echo "Starting Decision Engine Offline Research Workbench"
echo "UI: $URL"
echo "Press Ctrl+C to stop."
python3 -m engine.server

