#!/bin/sh
# Pre-commit: refuse to commit temp / scratch / debug files (handbook/07). Same for every language pack.
set -eu

hits=$(git diff --cached --name-only --diff-filter=AR |
  grep -Ei '(^|/)(tmp|temp|scratch|\.scratch)(/|$)|\.(tmp|bak|orig|rej|swp|log)$|(^|/)(debug|scratch|test-output)[^/]*$' || true)

if [ -n "$hits" ]; then
  echo "✖ Temp/scratch files staged for commit:" >&2
  printf '%s\n' "$hits" | sed 's/^/  /' >&2
  echo "Unstage and delete them (git rm --cached <file>), or move scratch work to .scratch/." >&2
  exit 1
fi
