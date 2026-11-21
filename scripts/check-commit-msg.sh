#!/bin/sh
# commit-msg hook: Conventional Commits (handbook/03). Same for every language pack, no npm needed.
# Usage (lefthook): sh scripts/check-commit-msg.sh {1}
set -eu

file="${1:?usage: check-commit-msg.sh <commit-msg-file>}"
header=$(grep -v '^#' "$file" | sed -n '/[^[:space:]]/{p;q;}')

# Messages git writes itself.
case "$header" in
  "Merge "* | "Revert "* | "fixup! "* | "squash! "* | "amend! "*) exit 0 ;;
esac

types='feat|fix|refactor|perf|test|docs|i18n|style|build|ci|chore|revert'
fail() {
  echo "✖ Commit message: $1" >&2
  echo "  $header" >&2
  echo "Format: type(scope): what is now true for the user — types: $(echo "$types" | tr '|' ' ') (handbook/03)" >&2
  exit 1
}

printf '%s' "$header" | grep -Eq "^($types)(\([a-z0-9][a-z0-9-]*\))?!?: [^ ]" ||
  fail "the header must be 'type(scope): subject' (scope optional, kebab-case)"
# Characters, not bytes, where the locale allows; a byte count only errs on the strict side.
[ "$(printf '%s' "$header" | wc -m | tr -d ' ')" -le 120 ] || fail "the header is longer than 120 characters"
case "$header" in *.) fail "no full stop at the end of the header" ;; esac
exit 0
