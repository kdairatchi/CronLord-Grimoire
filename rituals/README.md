# Rituals

> 56 copy-paste-ready cron jobs for [CronLord](https://github.com/kdairatchi/CronLord). Paste a block, set your env vars, flip `enabled = true` in the UI. Done.

---

## Category Index

| Category | Count | What's inside |
|---|---|---|
| [ai](#-ai) | 8 | Claude, Ollama, Gemini, GPT-4o, Groq, OpenRouter — scheduled LLM calls |
| [agents](#-agents) | 6 | Claude Code skill invocations, aider auto-edit, subagent fanout |
| [security](#-security) | 5 | nuclei updates, gitleaks scans, subdomain monitoring, H1 sweep |
| [monitoring](#-monitoring) | 5 | SSL expiry, HTTP uptime, disk alerts, port diff, deadman heartbeat |
| [communication](#-communication) | 5 | Discord, Telegram, email, Mastodon, Apprise multi-channel |
| [maintenance](#-maintenance) | 3 | brew update, certbot renew, docker prune |
| [database](#-database) | 3 | SQLite VACUUM, pg_dump, ANALYZE |
| [content](#-content) | 3 | RSS-to-Mastodon, arXiv alerts, cross-posting |
| [backup](#-backup) | 2 | restic snapshots, postgres-to-S3 |
| [sync](#-sync) | 2 | git fetch mirror, rclone |
| [reporting](#-reporting) | 2 | CronLord daily digest, weekly summary |
| [media](#-media) | 2 | ImageMagick batch, ffmpeg transcode |
| [home](#-home) | 2 | Home Assistant MQTT, IoT sensor check |
| [finance](#-finance) | 2 | FX rates, crypto price alert |
| [data](#-data) | 2 | ETL pipeline trigger, data ingestion |
| [devops](#-devops) | 2 | GitHub release watch, Kubernetes rolling restart |
| [personal](#-personal) | 1 | ntfy morning reminder |

---

## Ritual Anatomy

Every `.toml` file is a single `[[jobs]]` block. Copy the whole thing into your `cronlord.toml`, or POST it via the API. Required env vars are called out in the header comment — set them in CronLord's job settings before enabling.

```toml
# ritual-name — one line: what it does.
# Install: brew install <tool>  |  pipx install <tool>  |  go install ...
# Required env: COMMA_SEPARATED_VAR_NAMES
# Optional: any defaults, destructive behavior notes, path assumptions.

[[jobs]]
id          = "ritual-name"              # kebab-case, matches filename stem
name        = "Human-friendly name"
description = "One sentence for the UI tooltip."
category    = "matches-parent-dir"
kind        = "shell"                    # shell | http | claude
schedule    = "0 7 * * *"               # standard 5-field cron expression
timezone    = "UTC"                      # IANA tz, local only for reminders
enabled     = false                      # ALWAYS false — you flip it after setup
timeout_sec = 600

command = '''
: "${REQUIRED_VAR:?required}"           # fail fast if env var is missing
# /bin/sh-compatible body
# Secrets from env only — no hard-coded tokens or personal paths
'''
```

**Golden rules:**
1. `enabled = false` — never auto-runs from a fresh paste.
2. `timezone = "UTC"` — except for inherently local jobs (wakeup reminders, market-hours alerts).
3. Secrets via env vars, validated with `: "${VAR:?required}"`.
4. `/bin/sh` compatible. Bashisms must be noted in the header.
5. One ritual per file. One `[[jobs]]` block. No stacking.

---

## Playbooks

### 🔐 Security

**SSL certificate expiry — daily alert 14 days out**

```toml
# ssl-expiry-watch — alert when a cert is within 14 days of expiry.
# Requires: openssl.
# Required env: DOMAIN (default: example.com), SLACK_WEBHOOK (optional alert)

[[jobs]]
id          = "ssl-expiry-watch"
name        = "SSL expiry watch"
description = "Check TLS cert expiry for a domain, warn if <14 days left."
category    = "monitoring"
kind        = "shell"
schedule    = "0 7 * * *"
timezone    = "UTC"
enabled     = false
timeout_sec = 30

command = '''
DOMAIN="${DOMAIN:-example.com}"
END=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN":443 2>/dev/null \
      | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
[ -z "$END" ] && { echo "probe failed for $DOMAIN"; exit 1; }
EPOCH_END=$(date -d "$END" +%s)
EPOCH_NOW=$(date +%s)
DAYS=$(( (EPOCH_END - EPOCH_NOW) / 86400 ))
echo "$DOMAIN expires in $DAYS day(s) ($END)"
[ "$DAYS" -lt 14 ] && exit 2 || exit 0
'''
```

**Secret scanning — nightly gitleaks sweep**

```toml
# gitleaks-scan — scan a directory tree for accidentally-committed secrets.
# Install: github.com/gitleaks/gitleaks
# Required env: TARGET_DIR (default: $PWD), REPORT_FILE (optional)

[[jobs]]
id          = "gitleaks-scan"
name        = "Gitleaks — secret scan"
description = "Fail when gitleaks finds any committed secret in TARGET_DIR."
category    = "security"
kind        = "shell"
schedule    = "0 3 * * *"
timezone    = "UTC"
enabled     = false
timeout_sec = 900

command = '''
DIR="${TARGET_DIR:-$PWD}"
REPORT="${REPORT_FILE:-/tmp/gitleaks-$(date -u +%F).json}"
gitleaks detect --source "$DIR" --report-path "$REPORT" --report-format json --no-banner
RC=$?
COUNT=$(jq 'length' "$REPORT" 2>/dev/null || echo 0)
echo "findings: $COUNT (report: $REPORT)"
exit $RC
'''
```

---

### 💾 Backup

**Encrypted incremental home backup with restic**

```toml
# restic-home-snapshot — encrypted incremental snapshot of $HOME to a restic repo.
# Install: restic
# Required env: RESTIC_REPOSITORY, RESTIC_PASSWORD
# Optional: EXCLUDES (comma-separated paths, defaults to common noise)

[[jobs]]
id          = "restic-home-snapshot"
name        = "restic — $HOME snapshot"
description = "Nightly restic backup with prune + integrity check."
category    = "backup"
kind        = "shell"
schedule    = "0 2 * * *"
timezone    = "UTC"
enabled     = false
timeout_sec = 7200

command = '''
: "${RESTIC_REPOSITORY:?unset}" "${RESTIC_PASSWORD:?unset}"
EXCLUDES="${EXCLUDES:-$HOME/.cache,$HOME/Downloads,$HOME/node_modules,**/__pycache__,**/.venv}"
restic backup "$HOME" --exclude="$EXCLUDES" --tag auto
restic forget --prune --keep-daily 7 --keep-weekly 4 --keep-monthly 6
restic check --read-data-subset=5%
'''
```

**Postgres dump to S3**

```toml
# postgres-dump-to-s3 — gzip-compressed pg_dump pushed to S3 with date-stamped key.
# Install: pg_dump (postgresql-client), aws-cli
# Required env: PG_DATABASE, PG_HOST, PG_USER, PG_PASSWORD, S3_BUCKET
# Optional: S3_PREFIX (default: backups/postgres), AWS_PROFILE

[[jobs]]
id          = "postgres-dump-to-s3"
name        = "Postgres → S3 dump"
description = "Daily gzipped pg_dump pushed to S3."
category    = "backup"
kind        = "shell"
schedule    = "0 1 * * *"
timezone    = "UTC"
enabled     = false
timeout_sec = 3600

command = '''
: "${PG_DATABASE:?required}" "${S3_BUCKET:?required}"
KEY="${S3_PREFIX:-backups/postgres}/${PG_DATABASE}-$(date -u +%F).sql.gz"
PGPASSWORD="$PG_PASSWORD" pg_dump -h "${PG_HOST:-localhost}" -U "${PG_USER:-postgres}" "$PG_DATABASE" \
  | gzip -9 \
  | aws s3 cp - "s3://$S3_BUCKET/$KEY"
echo "uploaded s3://$S3_BUCKET/$KEY"
'''
```

---

### 🤖 AI

**Weekly Claude repo audit → dated markdown file**

```toml
# claude-repo-audit — point Claude at a repo and produce a security/quality audit note.
# Outputs to a dated markdown file. Keep scope tight — one repo per job.
# Requires: claude CLI logged in

[[jobs]]
id          = "claude-repo-audit"
name        = "Weekly repo audit"
description = "Claude reviews a repo and writes an audit note."
category    = "ai"
kind        = "claude"
schedule    = "0 14 * * 0"
timezone    = "UTC"
enabled     = false
timeout_sec = 1800
working_dir = "/home/anon/MyRepo"

command = '''
Audit this repo for:
- exposed secrets (grep .env, config.*, credentials)
- unpinned dependencies with known CVEs
- TODO/FIXME that reference security
- recently added third-party deps in package.json / go.mod / Cargo.toml / requirements.txt

Write findings to ./audits/$(date -u +%Y-%m-%d).md. Severity + one-line evidence per finding.
Skip anything already listed in ./audits/ignored.txt.
'''

[jobs.args]
model           = "claude-sonnet-4-6"
permission_mode = "bypassPermissions"
extra_args      = ["--dangerously-skip-permissions"]
```

**Nightly Ollama summary on local logs**

```toml
# ollama-local-summary — run a local Ollama model against a log file, output digest.
# Install: ollama (ollama.ai). Pull model once: ollama pull mistral
# Required env: LOG_FILE
# Optional: OLLAMA_MODEL (default: mistral), OLLAMA_HOST (default: localhost:11434)

[[jobs]]
id          = "ollama-local-summary"
name        = "Ollama — local log digest"
description = "Summarize LOG_FILE with a local Ollama model, no data leaves your machine."
category    = "ai"
kind        = "shell"
schedule    = "0 6 * * *"
timezone    = "UTC"
enabled     = false
timeout_sec = 600

command = '''
: "${LOG_FILE:?required}"
MODEL="${OLLAMA_MODEL:-mistral}"
HOST="${OLLAMA_HOST:-localhost:11434}"
BODY=$(tail -500 "$LOG_FILE" | head -c 8000)
PROMPT="Summarize in 5 bullets what happened in the last 24h. Be direct, no padding:\n\n$BODY"
curl -sS "http://$HOST/api/generate" \
  -d "{\"model\":\"$MODEL\",\"prompt\":\"$PROMPT\",\"stream\":false}" \
  | jq -r '.response'
'''
```

---

### 🔁 DevOps

**GitHub release watch — track new versions across repos**

```toml
# github-release-watch — poll a tracked list of repos for new releases.
# Install: curl, jq
# Required env: REPOS_FILE (one "owner/repo" per line)
# Optional: GITHUB_TOKEN (for rate limits / private repos)

[[jobs]]
id          = "github-release-watch"
name        = "GitHub — release watch"
description = "Diff latest release tag per repo vs. cache; emit new tags only."
category    = "devops"
kind        = "shell"
schedule    = "0 */3 * * *"
timezone    = "UTC"
enabled     = false
timeout_sec = 300
working_dir = "/var/lib/cronlord/grimoire/releases"

command = '''
mkdir -p "$PWD"
LIST="${REPOS_FILE:-$PWD/repos.txt}"
CACHE="$PWD/seen.tsv"
: > /tmp/new-releases.txt
touch "$CACHE"
while IFS= read -r R; do
  [ -z "$R" ] || [ "${R:0:1}" = "#" ] && continue
  TAG=$(curl -sS "https://api.github.com/repos/$R/releases/latest" \
        ${GITHUB_TOKEN:+-H "authorization: Bearer $GITHUB_TOKEN"} \
        | jq -r '.tag_name // empty')
  [ -z "$TAG" ] && continue
  OLD=$(awk -F"\t" -v r="$R" '$1==r{print $2}' "$CACHE")
  if [ "$TAG" != "$OLD" ]; then
    echo "$R  $OLD → $TAG" | tee -a /tmp/new-releases.txt
    grep -v "^$R	" "$CACHE" > "$CACHE.tmp" || true
    printf '%s\t%s\n' "$R" "$TAG" >> "$CACHE.tmp"
    mv "$CACHE.tmp" "$CACHE"
  fi
done < "$LIST"
[ -s /tmp/new-releases.txt ] && cat /tmp/new-releases.txt || echo "no new releases"
'''
```

**Kubernetes rolling restart — weekly graceful pod recycle**

```toml
# k8s-rollout-restart — rolling restart of a Kubernetes deployment on a cadence.
# Install: kubectl (configured against target cluster)
# Required env: K8S_NAMESPACE, K8S_DEPLOYMENT
# Optional: KUBECONFIG

[[jobs]]
id          = "k8s-rollout-restart"
name        = "Kubernetes — rolling restart"
description = "kubectl rollout restart of a deployment (graceful, rolling)."
category    = "devops"
kind        = "shell"
schedule    = "0 4 * * 0"
timezone    = "UTC"
enabled     = false
timeout_sec = 600

command = '''
: "${K8S_NAMESPACE:?required}" "${K8S_DEPLOYMENT:?required}"
kubectl -n "$K8S_NAMESPACE" rollout restart "deployment/$K8S_DEPLOYMENT"
kubectl -n "$K8S_NAMESPACE" rollout status "deployment/$K8S_DEPLOYMENT" --timeout=5m
'''
```

---

### 🧠 Agents

**Claude Code skill — invoke any installed skill on a schedule**

```toml
# claude-skill-invoke — generic wrapper to run any Claude Code skill on a schedule.
# Requires: claude CLI logged in (`claude login` once on the box).
# Required env: none — edit SKILL_NAME in command below

[[jobs]]
id          = "claude-skill-invoke"
name        = "Claude skill — scheduled invoke"
description = "Run any Claude Code skill on schedule. Set the skill in command."
category    = "agents"
kind        = "claude"
schedule    = "0 13 * * *"
timezone    = "UTC"
enabled     = false
timeout_sec = 1800
working_dir = "/home/anon"

command = "/refresh-latest"   # replace with any skill name

[jobs.args]
model           = "claude-sonnet-4-6"
permission_mode = "bypassPermissions"
extra_args      = ["--dangerously-skip-permissions"]
```

**aider auto-edit — AI-assisted code fixes on a scratch repo**

```toml
# aider-autocommit — run aider non-interactively against a scratch workspace.
# DANGER: AI modifies and commits code — point at a disposable repo only.
# Install: pipx install aider-chat
# Required env: OPENAI_API_KEY or ANTHROPIC_API_KEY

[[jobs]]
id          = "aider-autocommit"
name        = "aider — scheduled auto-edit"
description = "Run aider --message ... --yes --auto-commits in a scratch workspace."
category    = "agents"
kind        = "shell"
schedule    = "0 7 * * *"
timezone    = "UTC"
enabled     = false
timeout_sec = 1800
working_dir = "/var/lib/cronlord/agents/aider-scratch"

command = '''
TASK="${AIDER_TASK:-Run tests. Fix the smallest possible diff for any failures. Do not refactor.}"
MODEL="${AIDER_MODEL:-gpt-4o-mini}"
aider \
  --model "$MODEL" \
  --message "$TASK" \
  --yes --auto-commits \
  --no-stream --no-pretty \
  --test-cmd "${AIDER_TEST_CMD:-make test}"
'''
```

---

### 📡 Monitoring

**Dead-man heartbeat — job that must succeed or you get paged**

```toml
# deadman-heartbeat — ping a healthcheck URL every hour to confirm CronLord is alive.
# Wire the check to alert you if it goes silent for 90 minutes.
# Required env: HEALTHCHECK_URL (e.g. https://hc-ping.com/<uuid>)

[[jobs]]
id          = "deadman-heartbeat"
name        = "Dead-man heartbeat"
description = "Ping a healthcheck URL every hour. Silence = alert."
category    = "monitoring"
kind        = "http"
schedule    = "0 * * * *"
timezone    = "UTC"
enabled     = false
timeout_sec = 10

command     = "GET ${HEALTHCHECK_URL}"
```

**HTTP uptime check — fail on bad status or slow response**

```toml
# http-uptime-check — simple uptime probe with response-time threshold.
# Requires: curl
# Required env: TARGET_URL
# Optional: MAX_SECONDS (default: 5)

[[jobs]]
id          = "http-uptime-check"
name        = "HTTP uptime check"
description = "Curl TARGET_URL and fail if status != 2xx or response > MAX_SECONDS."
category    = "monitoring"
kind        = "shell"
schedule    = "*/5 * * * *"
timezone    = "UTC"
enabled     = false
timeout_sec = 30

command = '''
: "${TARGET_URL:?required}"
MAX="${MAX_SECONDS:-5}"
HTTP=$(curl -o /dev/null -sw "%{http_code} %{time_total}" --max-time "$MAX" "$TARGET_URL" 2>&1)
CODE=$(echo "$HTTP" | awk '{print $1}')
TIME=$(echo "$HTTP" | awk '{print $2}')
echo "$TARGET_URL → HTTP $CODE in ${TIME}s"
case "$CODE" in 2*) exit 0;; *) exit 1;; esac
'''
```

---

## Environment Variable Patterns

**Fast setup for any ritual — export once, then enable in UI:**

```sh
# Monitoring
export DOMAIN="mysite.com"
export SLACK_WEBHOOK="https://hooks.slack.com/services/..."

# Backup
export RESTIC_REPOSITORY="s3:s3.amazonaws.com/mybucket/restic"
export RESTIC_PASSWORD="$(openssl rand -hex 32)"
export PG_DATABASE="mydb"
export PG_HOST="localhost"
export PG_USER="postgres"
export PG_PASSWORD="$(cat /run/secrets/pg_password)"
export S3_BUCKET="mybucket"

# Security
export TARGET_DIR="/home/anon/myrepo"

# AI
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."

# DevOps
export GITHUB_TOKEN="ghp_..."
export REPOS_FILE="/var/lib/cronlord/release-watch/repos.txt"
export K8S_NAMESPACE="production"
export K8S_DEPLOYMENT="my-app"
```

Pass these to a CronLord job via the job's **Env vars** field in the UI (Settings → job → Edit → Env vars), or export in the shell before `cronlord server`.

---

## Installing a Ritual

**From CLI** (recommended — uses `install.sh` in the repo root):

```sh
./install.sh rituals/monitoring/ssl-expiry-watch.toml
```

**Against a remote instance:**

```sh
CRONLORD_URL=https://cron.example.com \
CRONLORD_ADMIN_TOKEN=your-token \
  ./install.sh rituals/security/gitleaks-scan.toml
```

**Directly via API:**

```sh
curl -X POST http://localhost:7070/api/jobs \
  -H "Authorization: Bearer $CRONLORD_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "ssl-expiry-watch",
    "name": "SSL expiry watch",
    "schedule": "0 7 * * *",
    "kind": "shell",
    "command": "...",
    "enabled": false
  }'
```

The installer POSTs to `/api/jobs` (upsert by ID). The ritual lands `enabled=false`. Flip it on in the CronLord UI after setting the required env vars on the job.

---

## File Layout

```
rituals/
├── INDEX.md              # auto-generated catalog (do not edit by hand)
├── README.md             # this file
├── agents/               # tool-using, multi-step LLM agents (6)
├── ai/                   # one-shot LLM calls — Claude, Ollama, Gemini, Groq (8)
├── backup/               # pg_dump, restic — things you'd cry about losing (2)
├── communication/        # Discord, Telegram, email, Mastodon, Apprise (5)
├── content/              # RSS-to-Mastodon, arXiv alerts, cross-posting (3)
├── data/                 # ETL pipelines, ingestion jobs (2)
├── database/             # VACUUM, dump, ANALYZE (3)
├── devops/               # release watching, k8s ops (2)
├── finance/              # FX rates, crypto price alerts (2)
├── home/                 # Home Assistant MQTT, IoT (2)
├── maintenance/          # brew, certbot, docker prune (3)
├── media/                # ImageMagick batch, ffmpeg transcode (2)
├── monitoring/           # uptime, disk, SSL expiry, deadman (5)
├── personal/             # ntfy morning reminders (1)
├── reporting/            # daily/weekly CronLord digests (2)
├── security/             # nuclei, gitleaks, subdomain monitor (5)
└── sync/                 # git mirror, rclone (2)
```

---

## Contributing a Ritual

1. Pick a category dir (or propose a new one in the PR — one-line justification).
2. Copy the closest existing ritual as a starting point.
3. Header comment: what it does · install command · required env · optional env.
4. Test with real env vars on your machine before submitting.
5. Run `python3 scripts/gen-index.py` and check the index entry looks right.
6. One ritual per PR. Header-comment format is mandatory; PRs without it are closed.

See [`../CONTRIBUTING.md`](../CONTRIBUTING.md) for the full workflow.
