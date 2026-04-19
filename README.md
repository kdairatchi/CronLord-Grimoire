# cronlord-grimoire

A curated collection of [CronLord](https://github.com/kdairatchi/CronLord) jobs — ready-to-run TOML entries for monitoring, hunting, maintenance, reporting, and Claude-powered rituals.

Every ritual ships `enabled = false`. You read it, edit the parts you care about (domain, target, webhook), then enable.

## Install one ritual

```bash
# From a running CronLord instance on localhost:7070:
./install.sh rituals/monitoring/ssl-expiry-watch.toml
```

Or copy the `[[jobs]]` block into your `cronlord.toml` and restart.

## Catalog

### Monitoring (`rituals/monitoring/`)
- **ssl-expiry-watch** — warn when a cert has <14 days left
- **disk-space-alert** — fail when root usage exceeds threshold
- **deadman-heartbeat** — ping healthchecks.io every 5 min
- **port-baseline-diff** — nmap drift detection vs. stored baseline

### Hunting (`rituals/hunting/`)
- **nuclei-template-update** — pull latest projectdiscovery templates
- **subdomain-monitor** — daily subfinder diff, surfaces new hosts
- **h1-disclosed-sweep** — pull HackerOne disclosures via GraphQL

### Maintenance (`rituals/maintenance/`)
- **git-repo-sync** — `git fetch --all --prune` on a local repo
- **brew-outdated-report** — weekly outdated-package list
- **certbot-renewal-check** — dry-run renewal

### Claude (`rituals/claude/`)
- **daily-vault-summary** — weekly digest of Obsidian daily notes (Haiku)
- **weekly-repo-audit** — repo audit written to `./audits/YYYY-MM-DD.md` (Sonnet)

### Reporting (`rituals/reporting/`)
- **daily-activity-digest** — post yesterday's run summary to Slack

## File format

Each ritual is a single `[[jobs]]` block matching the CronLord TOML schema. See `cronlord/docs/job-kinds.md` for the full field list. Grimoire rules:

- `enabled = false` by default — never auto-run on paste
- `timezone = "UTC"` unless the ritual is genuinely local
- Shell snippets must work under `/bin/sh` (no bashisms unless declared)
- Secrets via env vars (`SLACK_WEBHOOK`, `TARGET`, etc.) — never hard-coded

## Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md). Short version: one ritual per PR, follow the existing file header comment pattern, prove it runs on your box.

## License

MIT. See [LICENSE](LICENSE).
