# cronlord-grimoire

A curated, vendor-neutral collection of [CronLord](https://github.com/kdairatchi/CronLord) rituals (jobs). Ready-to-run TOML entries covering everything a small team or solo operator actually schedules: monitoring, backups, sync, security, AI pipelines, data, devops, reporting, and personal automation.

Every ritual ships `enabled = false`. You read the header, set the env vars it names, then enable.

## Install one ritual

```bash
# Into a running CronLord on localhost:7070:
./install.sh rituals/monitoring/ssl-expiry-watch.toml

# Or paste the [[jobs]] block into your cronlord.toml and restart.
```

## Categories

### `rituals/monitoring/`
Health and uptime. What's down, what's drifting, what's about to expire.
- **ssl-expiry-watch** — warn when a cert has <14 days left
- **disk-space-alert** — fail when root usage exceeds threshold
- **deadman-heartbeat** — ping healthchecks.io so *someone* notices when the scheduler dies
- **http-uptime-check** — fail when a URL doesn't return 2xx
- **port-baseline-diff** — nmap drift detection vs. stored baseline

### `rituals/backup/`
Data you'd cry about losing.
- **postgres-dump-to-s3** — nightly pg_dump -Fc streamed to S3/R2/MinIO
- **restic-home-snapshot** — encrypted incremental `$HOME` backup with retention

### `rituals/sync/`
Move bytes between places.
- **git-repo-sync** — `git fetch --all --prune` on a local repo
- **rclone-cloud-mirror** — one-way mirror of a local dir to any rclone remote

### `rituals/security/`
Scans, audits, and public-intel sweeps. Works for both defenders and bounty hunters.
- **nuclei-template-update** — pull latest projectdiscovery templates
- **subdomain-monitor** — daily subfinder diff (in-scope targets only)
- **h1-disclosed-sweep** — pull HackerOne disclosures via GraphQL
- **gitleaks-scan** — fail on accidentally committed secrets

### `rituals/ai/`
One-shot LLM calls. Vendor-neutral by design — one ritual per major provider plus `llm-cli-any` as the universal option.
- **claude-vault-summary** — `kind: claude`, Haiku, summarizes Obsidian daily notes
- **claude-repo-audit** — `kind: claude`, Sonnet, writes weekly audit note
- **ollama-local-summary** — fully offline via locally-hosted Ollama
- **openai-pr-triage** — GPT-class triage of open GitHub PRs
- **gemini-news-digest** — Google Gemini summarizing an RSS feed
- **groq-fast-classify** — Groq's fast inference to label a JSONL file
- **llm-cli-any** — provider-agnostic via [simonw/llm](https://llm.datasette.io/) (OpenAI, Anthropic, Gemini, Ollama, Mistral, Groq, local — all via plugins)

### `rituals/agents/`
Agentic rituals — tool-using, multi-step, sometimes subagent-spawning. Where `rituals/ai/` calls a model once, `rituals/agents/` hands a goal to an agent framework and lets it work.
- **claude-skill-invoke** — generic wrapper to run any Claude Code `/<skill>` on schedule
- **claude-subagent-fanout** — one Claude run spawns N parallel `Task`-tool subagents over a targets file
- **goose-recipe** — Block's [Goose](https://block.github.io/goose/) agent running a prepared recipe
- **fabric-pattern** — [danielmiessler/fabric](https://github.com/danielmiessler/fabric) pattern pipeline
- **llm-tools-call** — simonw/llm with tool-calling plugins (Exec, QuickJS, MCP bridge, …)
- **aider-autocommit** — [aider](https://aider.chat/) in scratch workspace (DANGER: writes code + commits)

### `rituals/data/`
Pipelines, ETL, ingestion.
- **rss-to-jsonl** — poll an RSS feed, append new items as JSONL (dedup by guid)

### `rituals/devops/`
Keep infrastructure honest.
- **github-release-watch** — diff tracked repos' latest releases, emit new tags

### `rituals/maintenance/`
Housekeeping. Nothing glamorous.
- **brew-outdated-report** — weekly outdated-package list
- **certbot-renewal-check** — dry-run renewal
- **docker-prune** — weekly `docker system prune -f`

### `rituals/reporting/`
Turn runs and state into digests.
- **daily-activity-digest** — post yesterday's CronLord run summary to Slack
- **weekly-run-stats** — markdown digest of last 7 days of runs per job

### `rituals/personal/`
For the humans, not the servers.
- **ntfy-habit-reminder** — push a reminder to a ntfy.sh topic at a local time

## File format

Each ritual is a single `[[jobs]]` block matching the CronLord TOML schema. See [`cronlord/docs/job-kinds.md`](https://github.com/kdairatchi/CronLord/blob/main/docs/job-kinds.md) for the full field list.

Grimoire conventions:
- `enabled = false` by default — never auto-run on paste
- `timezone = "UTC"` unless the ritual is inherently local (human wakeup time)
- Shell snippets must work under `/bin/sh` (bashisms declared in header comment)
- Secrets via env vars (e.g. `SLACK_WEBHOOK`, `GEMINI_API_KEY`, `TARGET`) — never hard-coded
- A 3-8 line header comment explains: what it does, required tools, required env vars, path assumptions

## LLM provider matrix

| Provider | Ritual | How it's called |
|---|---|---|
| Anthropic Claude | `ai/claude-vault-summary`, `ai/claude-repo-audit` | `kind = "claude"` — CronLord's native integration |
| OpenAI | `ai/openai-pr-triage` | `kind = "shell"` + `curl` to `api.openai.com` |
| Google Gemini | `ai/gemini-news-digest` | `kind = "shell"` + `curl` to `generativelanguage.googleapis.com` |
| Groq | `ai/groq-fast-classify` | `kind = "shell"` + `curl` to `api.groq.com` |
| Ollama (local) | `ai/ollama-local-summary` | `kind = "shell"` + `ollama run` |
| *Any provider* | `ai/llm-cli-any` | `kind = "shell"` + [`llm`](https://llm.datasette.io/) CLI — swap model via env |

Missing a provider (Mistral, Cohere, xAI Grok, DeepSeek, local llama.cpp, …)? PR welcome — copy the closest ritual, adjust the endpoint, submit.

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md). One ritual per PR, follow the header-comment pattern, prove it runs on your box.

## License

MIT. See [LICENSE](LICENSE).
