#!/bin/bash
# Hourly Scholar refresh. Runs on this Mac because GitHub-hosted runners are blocked.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export GIT_TERMINAL_PROMPT=0
cd "$(dirname "$0")/.."
mkdir -p "$HOME/Library/Logs"
exec >> "$HOME/Library/Logs/scholar-citations.log" 2>&1
echo "---- $(date '+%Y-%m-%d %H:%M:%S') ----"

if [ -n "$(git status --porcelain -- . ':(exclude).DS_Store')" ]; then
  echo "working tree is not clean; skip"
  git status --porcelain -- . ':(exclude).DS_Store'
  exit 0
fi

git pull --rebase --quiet origin main
/usr/bin/python3 scripts/update-scholar-citations.py

if git diff --quiet -- assets/gs-citations.json; then
  echo "citation count unchanged"
  exit 0
fi

git add -- assets/gs-citations.json
git commit -m "chore: refresh Google Scholar citation count" -- assets/gs-citations.json
git push origin HEAD
