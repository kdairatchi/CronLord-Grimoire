# Rituals

This directory holds every ritual in the grimoire — one `[[jobs]]` block per `.toml` file, organized by category.

**Never edit `INDEX.md` by hand.** It's regenerated from these files by `scripts/gen-index.py`.

## Layout

```
rituals/
├── INDEX.md              # auto-generated catalog
├── README.md             # this file
├── agents/               # tool-using, multi-step LLM agents
├── ai/                   # one-shot LLM calls (Claude, OpenAI, Gemini, Groq, Ollama, llm CLI)
├── backup/               # pg_dump, restic, anything you'd cry about losing
├── communication/        # Discord, Telegram, email, Mastodon, Apprise
├── content/              # RSS-to-Mastodon, arXiv alerts, cross-posting
├── data/                 # ETL, pipelines, ingestion
├── database/             # VACUUM, dump, analyze
├── devops/               # release watching, infrastructure checks
├── finance/              # FX rates, crypto price alerts
├── home/                 # MQTT, Home Assistant, IoT
├── maintenance/          # brew, certbot, docker prune — housekeeping
├── media/                # ImageMagick, ffmpeg batch
├── monitoring/           # uptime, disk, SSL, deadman
├── personal/             # ntfy reminders — for the humans
├── reporting/            # daily/weekly digests from CronLord runs
├── security/             # nuclei, subfinder, gitleaks, H1 sweep
└── sync/                 # git fetch, rclone mirror
```

## File format

Every ritual is a single `[[jobs]]` block matching the [CronLord TOML schema](https://github.com/kdairatchi/CronLord/blob/main/docs/job-kinds.md). Minimal shape:

```toml
# my-ritual — one-line summary of what it does.
# Install: any tools the ritual shells out to.
# Required env: comma list of env vars the command reads.
# Optional: notes on defaults, destructive behavior, path assumptions.

[[jobs]]
id          = "my-ritual"
name        = "Human-friendly name"
description = "One sentence fit for a UI tooltip."
category    = "<must match parent dir name>"
kind        = "shell"           # or "http" or "claude"
schedule    = "0 7 * * *"
timezone    = "UTC"              # UTC unless inherently local (wakeup reminders)
enabled     = false              # ALWAYS false in the grimoire
timeout_sec = 600

command = '''
: "${REQUIRED_VAR:?required}"
# /bin/sh-compatible body. bashisms only if declared in header.
'''
```

## Conventions (non-negotiable)

1. **`enabled = false`** — rituals never auto-run when pasted.
2. **`timezone = "UTC"`** — unless the ritual is inherently local (e.g. a wakeup push at a person's local 7am).
3. **`category` matches the parent directory name.** `gen-index.py` verifies this; mismatches show up in the index and get patched.
4. **Shell bodies must work under `/bin/sh`.** If you need bashisms, say so in the header comment.
5. **Secrets via env vars only.** No hard-coded tokens, URLs, paths pointing at personal dirs. Use `:?required` to fail fast when a mandatory var is missing.
6. **Header comment, 3–8 lines:** what it does · install command for tools it uses · required env · optional env / defaults / destructive behavior.
7. **One ritual per file.** One `[[jobs]]` block. Don't stack.
8. **ID format:** lowercase-kebab-case, matches the file stem.

## Adding a ritual

1. Pick a category dir (or propose a new one in the PR).
2. Copy the closest existing ritual as a starting point.
3. Run `python3 scripts/gen-index.py` — check the entry looks right.
4. Prove it runs on your box with real env vars before the PR.
5. Submit: one ritual per PR. Header-comment pattern mandatory.

See [`../CONTRIBUTING.md`](../CONTRIBUTING.md) for the full contribution workflow.

## Installing a ritual into CronLord

```bash
# from the repo root:
./install.sh rituals/monitoring/ssl-expiry-watch.toml

# or with a remote / authenticated instance:
CRONLORD_URL=https://cron.example.com \
CRONLORD_ADMIN_TOKEN=$MY_TOKEN \
  ./install.sh rituals/security/nuclei-template-update.toml
```

The installer POSTs to `/api/jobs` (upsert). The ritual lands `enabled=false` — you toggle it in the CronLord UI after setting the required env vars on the job.
