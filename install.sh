#!/usr/bin/env bash
# install.sh — load a ritual into a running CronLord instance.
#
# Usage:
#   ./install.sh rituals/monitoring/ssl-expiry-watch.toml
#   CRONLORD_URL=http://127.0.0.1:7070 ./install.sh <file.toml>
#
# Requires: curl, python3 (stdlib tomllib).

set -euo pipefail

CL_URL="${CRONLORD_URL:-http://127.0.0.1:7070}"
TOKEN="${CRONLORD_ADMIN_TOKEN:-}"
FILE="${1:-}"

if [[ -z "$FILE" ]]; then
  echo "usage: $0 <ritual.toml>" >&2
  exit 2
fi
if [[ ! -f "$FILE" ]]; then
  echo "not a file: $FILE" >&2
  exit 2
fi

AUTH=()
[[ -n "$TOKEN" ]] && AUTH=(-H "Authorization: Bearer $TOKEN")

PAYLOAD=$(python3 - "$FILE" <<'PY'
import json, sys, tomllib
with open(sys.argv[1], "rb") as fh:
    data = tomllib.load(fh)
jobs = data.get("jobs", [])
if not jobs:
    sys.exit("no [[jobs]] entry found")
print(json.dumps(jobs[0]))
PY
)

echo "POST $CL_URL/api/jobs"
curl -sS -X POST "$CL_URL/api/jobs" \
  -H "content-type: application/json" \
  "${AUTH[@]}" \
  --data "$PAYLOAD" | python3 -m json.tool
