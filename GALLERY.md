# Gallery

Curated views into the grimoire. **[`rituals/INDEX.md`](rituals/INDEX.md)** has the full catalog; this page is use-case-driven for when you know the outcome you want but not the ritual name.

---

## By outcome

<details open>
<summary><strong>🩺 "I want to know when something breaks"</strong></summary>

Minimal uptime-and-health kit. Pair with `reporting/daily-activity-digest` so you get one Slack post per morning instead of a pager storm.

| Ritual | Why |
| --- | --- |
| [`monitoring/deadman-heartbeat`](rituals/monitoring/deadman-heartbeat.toml) | Tells you when *CronLord itself* dies (via healthchecks.io). |
| [`monitoring/http-uptime-check`](rituals/monitoring/http-uptime-check.toml) | URL → expect 2xx. Fail otherwise. |
| [`monitoring/disk-space-alert`](rituals/monitoring/disk-space-alert.toml) | Fail when root usage crosses a threshold. |
| [`monitoring/ssl-expiry-watch`](rituals/monitoring/ssl-expiry-watch.toml) | Warn at <14 days on the cert. |
| [`monitoring/port-baseline-diff`](rituals/monitoring/port-baseline-diff.toml) | nmap drift vs. a stored baseline. |
| [`reporting/daily-activity-digest`](rituals/reporting/daily-activity-digest.toml) | Slack post of yesterday's run summary. |

```bash
for f in monitoring/deadman-heartbeat monitoring/http-uptime-check monitoring/disk-space-alert \
         monitoring/ssl-expiry-watch reporting/daily-activity-digest; do
  ./install.sh "rituals/$f.toml"
done
```

</details>

<details>
<summary><strong>💾 "I want my data backed up"</strong></summary>

| Ritual | Why |
| --- | --- |
| [`backup/restic-home-snapshot`](rituals/backup/restic-home-snapshot.toml) | Encrypted incremental `$HOME` → S3/B2/local with retention. |
| [`backup/postgres-dump-to-s3`](rituals/backup/postgres-dump-to-s3.toml) | Nightly `pg_dump -Fc` streamed to any S3-compatible bucket. |
| [`database/mysql-dump`](rituals/database/mysql-dump.toml) | Nightly `mysqldump` → gzipped SQL file. |
| [`sync/rclone-cloud-mirror`](rituals/sync/rclone-cloud-mirror.toml) | One-way mirror of a dir to any rclone remote. |
| [`database/postgres-vacuum-analyze`](rituals/database/postgres-vacuum-analyze.toml) | Weekly planner-stats refresh. |
| [`database/sqlite-vacuum`](rituals/database/sqlite-vacuum.toml) | Defrag / reclaim space in SQLite files. |

</details>

<details>
<summary><strong>🎯 "I'm hunting bugs"</strong></summary>

Subdomain monitoring + template freshness + disclosed-writeup sweep + agent-driven recon. The fanout ritual hands a targets file to Claude and lets it spawn parallel `recon-agent` subagents — one per root domain.

| Ritual | Why |
| --- | --- |
| [`security/subdomain-monitor`](rituals/security/subdomain-monitor.toml) | Daily `subfinder` diff (in-scope targets only). |
| [`security/nuclei-template-update`](rituals/security/nuclei-template-update.toml) | Pull latest `projectdiscovery/nuclei-templates`. |
| [`security/h1-disclosed-sweep`](rituals/security/h1-disclosed-sweep.toml) | HackerOne public disclosures via GraphQL. |
| [`security/gitleaks-scan`](rituals/security/gitleaks-scan.toml) | Fail on accidentally committed secrets. |
| [`agents/claude-subagent-fanout`](rituals/agents/claude-subagent-fanout.toml) | One `kind=claude` run spawns N parallel Task-tool subagents over a targets file. |

</details>

<details>
<summary><strong>🧠 "I want AI summaries on a schedule"</strong></summary>

Provider-agnostic. Pick the one matching the API key you already have — or use `ai/llm-cli-any` as the universal entry via [simonw/llm](https://llm.datasette.io/).

| Provider | Ritual |
| --- | --- |
| Anthropic Claude (native `kind=claude`) | [`ai/claude-vault-summary`](rituals/ai/claude-vault-summary.toml), [`ai/claude-repo-audit`](rituals/ai/claude-repo-audit.toml) |
| OpenAI | [`ai/openai-pr-triage`](rituals/ai/openai-pr-triage.toml) |
| Google Gemini | [`ai/gemini-news-digest`](rituals/ai/gemini-news-digest.toml) |
| Groq | [`ai/groq-fast-classify`](rituals/ai/groq-fast-classify.toml) |
| Ollama (local, no cloud) | [`ai/ollama-local-summary`](rituals/ai/ollama-local-summary.toml) |
| **Any provider** (plugin-based) | [`ai/llm-cli-any`](rituals/ai/llm-cli-any.toml) |

Step up to **agentic** (multi-step, tool-using, potentially subagent-spawning):

| Ritual | Why |
| --- | --- |
| [`agents/claude-skill-invoke`](rituals/agents/claude-skill-invoke.toml) | Run any Claude Code `/<skill>` on a schedule. |
| [`agents/claude-subagent-fanout`](rituals/agents/claude-subagent-fanout.toml) | Parallel subagents over a targets file. |
| [`agents/goose-recipe`](rituals/agents/goose-recipe.toml) | Block's [Goose](https://block.github.io/goose/) recipe runner. |
| [`agents/fabric-pattern`](rituals/agents/fabric-pattern.toml) | [danielmiessler/fabric](https://github.com/danielmiessler/fabric) pattern pipeline. |
| [`agents/llm-tools-call`](rituals/agents/llm-tools-call.toml) | simonw/llm with tool-calling plugins (Exec, QuickJS, MCP bridge). |
| [`agents/aider-autocommit`](rituals/agents/aider-autocommit.toml) | [aider](https://aider.chat/) in a scratch workspace — ⚠ commits code. |

</details>

<details>
<summary><strong>📣 "I need to notify people or systems"</strong></summary>

Pick the channel. `apprise-fanout` covers 80+ services in one ritual if you don't want to pick.

| Ritual | Channel |
| --- | --- |
| [`communication/discord-webhook-post`](rituals/communication/discord-webhook-post.toml) | Discord incoming webhook |
| [`communication/telegram-bot-send`](rituals/communication/telegram-bot-send.toml) | Telegram Bot API |
| [`communication/email-smtp-send`](rituals/communication/email-smtp-send.toml) | SMTP via `msmtp` |
| [`communication/mastodon-post`](rituals/communication/mastodon-post.toml) | Mastodon status post |
| [`communication/apprise-fanout`](rituals/communication/apprise-fanout.toml) | 80+ services via [caronc/apprise](https://github.com/caronc/apprise) |
| [`personal/ntfy-habit-reminder`](rituals/personal/ntfy-habit-reminder.toml) | [ntfy.sh](https://ntfy.sh/) push |

</details>

<details>
<summary><strong>✍️ "I'm a writer / creator"</strong></summary>

| Ritual | Why |
| --- | --- |
| [`content/rss-to-mastodon`](rituals/content/rss-to-mastodon.toml) | Auto-toot new RSS items (dedup by GUID). |
| [`content/arxiv-paper-alert`](rituals/content/arxiv-paper-alert.toml) | New arXiv matches → markdown inbox. |
| [`content/markdown-cross-post`](rituals/content/markdown-cross-post.toml) | One `.md` → dev.to + Hashnode + Obsidian mirror. |
| [`data/rss-to-jsonl`](rituals/data/rss-to-jsonl.toml) | Append new RSS items as JSONL for downstream processing. |
| [`reporting/weekly-run-stats`](rituals/reporting/weekly-run-stats.toml) | 7-day rollup of ritual runs (use it for changelog fodder). |

</details>

<details>
<summary><strong>🏠 "I'm running Home Assistant / IoT"</strong></summary>

| Ritual | Why |
| --- | --- |
| [`home/mqtt-publish`](rituals/home/mqtt-publish.toml) | Publish to a topic — any MQTT broker. |
| [`home/ha-script-trigger`](rituals/home/ha-script-trigger.toml) | Fire a HA script / scene / automation via REST. |
| [`personal/ntfy-habit-reminder`](rituals/personal/ntfy-habit-reminder.toml) | Push to your phone at a local time. |

</details>

<details>
<summary><strong>💱 "I track markets"</strong></summary>

| Ritual | Why |
| --- | --- |
| [`finance/exchange-rate-log`](rituals/finance/exchange-rate-log.toml) | Log daily ECB fiat rates to CSV. |
| [`finance/crypto-price-alert`](rituals/finance/crypto-price-alert.toml) | CoinGecko threshold-cross alert via webhook. |

</details>

<details>
<summary><strong>🛠 "I'm a developer keeping my machine tidy"</strong></summary>

| Ritual | Why |
| --- | --- |
| [`maintenance/brew-outdated-report`](rituals/maintenance/brew-outdated-report.toml) | Weekly outdated-package list. |
| [`maintenance/certbot-renewal-check`](rituals/maintenance/certbot-renewal-check.toml) | Dry-run renewal. |
| [`maintenance/docker-prune`](rituals/maintenance/docker-prune.toml) | Weekly `docker system prune -f`. |
| [`sync/git-repo-sync`](rituals/sync/git-repo-sync.toml) | `git fetch --all --prune` on a local repo. |
| [`devops/github-release-watch`](rituals/devops/github-release-watch.toml) | Diff tracked repos' latest releases. |

</details>

<details>
<summary><strong>🎞 "I process images or video in bulk"</strong></summary>

| Ritual | Why |
| --- | --- |
| [`media/image-bulk-resize`](rituals/media/image-bulk-resize.toml) | ImageMagick resize of a dir tree. |
| [`media/ffmpeg-transcode-queue`](rituals/media/ffmpeg-transcode-queue.toml) | Watch dir → H.264/AAC MP4. |

</details>

---

## By `kind`

| Kind | Count | Use when |
| --- | ---: | --- |
| `shell` | 44 | You're running a CLI tool, script, or anything with side effects on disk. |
| `claude` | 4 | You want the Claude CLI to take a prompt (or slash-command skill) and produce output; uses local auth. |
| `http` | 3 | Fire-and-forget HTTP request (webhook ping, deadman check-in). |

Everything under `agents/` that isn't `kind=claude` is still `kind=shell` (the agent framework is the CLI).

---

## LLM provider matrix

| Provider | Ritual(s) | How |
| --- | --- | --- |
| Anthropic Claude | `ai/claude-*`, `agents/claude-*` | Native `kind=claude` — CronLord runs the CLI, auth via the CLI's own config. |
| OpenAI | `ai/openai-pr-triage` | `kind=shell` + curl to api.openai.com |
| Google Gemini | `ai/gemini-news-digest` | `kind=shell` + curl to generativelanguage.googleapis.com |
| Groq | `ai/groq-fast-classify` | `kind=shell` + curl to api.groq.com |
| Ollama (local) | `ai/ollama-local-summary` | `kind=shell` + `ollama run` |
| **Any** | `ai/llm-cli-any`, `agents/llm-tools-call` | simonw/llm CLI — swap model via env, supports OpenAI/Anthropic/Gemini/Mistral/Groq/Ollama/local via plugins |
| fabric-ai | `agents/fabric-pattern` | [danielmiessler/fabric](https://github.com/danielmiessler/fabric) — provider-agnostic via its own config. |
| Goose | `agents/goose-recipe` | Block's agent framework. |
| aider | `agents/aider-autocommit` | Uses OpenAI or Anthropic depending on `--model`. |

Missing Mistral, Cohere, xAI Grok, DeepSeek, OpenRouter, Cloudflare Workers AI, HuggingFace? PR welcome — copy the closest ritual, adjust the endpoint, submit.

---

## Stats

- **54 rituals** across **17 categories** — scanner: 54/54 pass
- All ship `enabled = false` — nothing auto-runs on install
- All shell bodies are `/bin/sh`-compatible unless declared otherwise in the header
- All secrets pass via env vars — grep the repo for `:?required` to see which

See [`rituals/INDEX.md`](rituals/INDEX.md) for the full table.
