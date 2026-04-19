# Contributing

One ritual per PR. Keep them small, focused, and usable without reading the source.

## Checklist before you open a PR

- [ ] File lives under the right category folder (`monitoring`, `hunting`, `maintenance`, `claude`, `reporting`). New category? Propose it in the PR.
- [ ] Filename is the `id` field: `id = "ssl-expiry-watch"` → `ssl-expiry-watch.toml`.
- [ ] `id` is kebab-case, unique across the grimoire, stable across PRs.
- [ ] `enabled = false`.
- [ ] `timezone = "UTC"` unless the task is inherently local (human wakeup time, regional business hours).
- [ ] `timeout_sec` is set and realistic — not 0 for long-running jobs.
- [ ] Shell snippets run under `/bin/sh` (or declare a bash dependency in the header comment).
- [ ] Secrets come from env vars, never hard-coded.
- [ ] Header comment (3-8 lines) explains: what it does, required tools, required env vars, any path assumptions.
- [ ] You ran it on your box at least once and it produced the expected output.
- [ ] No external-service credentials in the file or commit history.

## Style

- Terse prose in header comments. No hype. No emoji.
- `command` is either a single-line string or a `'''` block. Not a heredoc.
- Claude rituals pin a model in `[jobs.args]`. Prefer Haiku unless the task genuinely needs Sonnet.
- HTTP rituals: scheme must be `http`/`https`. No `file://`, `gopher://`, etc. CronLord will reject them anyway.

## Testing

Install into a local CronLord, trigger a one-off run via the UI or:

```bash
curl -sS -X POST http://127.0.0.1:7070/api/jobs/<id>/run
```

Paste a trimmed run log into the PR description.

## Review

Maintainer merges on green. Bad actors get their rituals quarantined and their PRs closed without reply.
