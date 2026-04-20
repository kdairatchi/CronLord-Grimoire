#!/usr/bin/env bash
# install-bulk.sh — load rituals from a category (or all) into a running CronLord instance.
#
# Usage:
#   ./install-bulk.sh monitoring
#   ./install-bulk.sh all
#   ./install-bulk.sh monitoring security sync
#   CRONLORD_URL=http://host:7070 CRONLORD_ADMIN_TOKEN=... ./install-bulk.sh all
#
# Env vars:
#   CRONLORD_URL          — default: http://127.0.0.1:7070
#   CRONLORD_ADMIN_TOKEN  — Bearer token for /api/* (omit if no auth)
#   DRY_RUN=1             — print what would be installed, don't POST
#
# Requires: curl, python3 (3.11+ for tomllib)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RITUALS_DIR="$SCRIPT_DIR/rituals"
CL_URL="${CRONLORD_URL:-http://127.0.0.1:7070}"
TOKEN="${CRONLORD_ADMIN_TOKEN:-}"
DRY="${DRY_RUN:-0}"

AUTH=()
[[ -n "$TOKEN" ]] && AUTH=(-H "Authorization: Bearer $TOKEN")

ok=0
fail=0
skip=0

install_file() {
  local file="$1"
  local rel="${file#"$SCRIPT_DIR/"}"

  PAYLOAD=$(python3 - "$file" 2>&1 <<'PY'
import json, sys, tomllib
try:
    with open(sys.argv[1], "rb") as fh:
        data = tomllib.load(fh)
except Exception as e:
    print(f"PARSE_ERROR: {e}", file=sys.stderr)
    sys.exit(1)
jobs = data.get("jobs", [])
if not jobs:
    print("NO_JOBS", file=sys.stderr)
    sys.exit(2)
print(json.dumps(jobs[0]))
PY
  ) || {
    local ec=$?
    if [[ $ec -eq 2 ]]; then
      echo "  skip  $rel  (no [[jobs]])"
      (( skip++ )) || true
    else
      echo "  ERROR $rel  (parse failed)"
      (( fail++ )) || true
    fi
    return 0
  }

  if [[ "$DRY" == "1" ]]; then
    echo "  dry   $rel"
    (( ok++ )) || true
    return 0
  fi

  local resp
  resp=$(curl -sS -w "\n%{http_code}" -X POST "$CL_URL/api/jobs" \
    -H "content-type: application/json" \
    "${AUTH[@]}" \
    --data "$PAYLOAD" 2>&1) || {
    echo "  ERROR $rel  (curl failed)"
    (( fail++ )) || true
    return 0
  }

  local body http_code
  body="${resp%$'\n'*}"
  http_code="${resp##*$'\n'}"

  case "$http_code" in
    200|201) echo "  ok    $rel"; (( ok++ )) || true ;;
    409)     echo "  skip  $rel  (already exists)"; (( skip++ )) || true ;;
    *)       echo "  ERROR $rel  (HTTP $http_code: $body)"; (( fail++ )) || true ;;
  esac
}

usage() {
  echo "usage: $0 <category|all> [category ...]"
  echo ""
  echo "categories:"
  for d in "$RITUALS_DIR"/*/; do
    echo "  $(basename "$d")"
  done
  exit 1
}

[[ $# -eq 0 ]] && usage

targets=()
for arg in "$@"; do
  if [[ "$arg" == "all" ]]; then
    while IFS= read -r -d '' d; do
      targets+=("$d")
    done < <(find "$RITUALS_DIR" -mindepth 1 -maxdepth 1 -type d -print0 | sort -z)
    break
  fi
  d="$RITUALS_DIR/$arg"
  if [[ ! -d "$d" ]]; then
    echo "unknown category: $arg" >&2
    usage
  fi
  targets+=("$d")
done

echo "CronLord grimoire installer"
echo "  url:  $CL_URL"
echo "  auth: ${TOKEN:+yes}${TOKEN:-no}"
echo "  dry:  ${DRY:-0}"
echo ""

for dir in "${targets[@]}"; do
  cat_name="$(basename "$dir")"
  echo "[ $cat_name ]"
  while IFS= read -r -d '' f; do
    install_file "$f"
  done < <(find "$dir" -name "*.toml" -print0 | sort -z)
  echo ""
done

echo "done — ok: $ok  skip: $skip  fail: $fail"
[[ $fail -eq 0 ]] || exit 1
