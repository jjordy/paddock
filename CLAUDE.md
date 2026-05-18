# Claude Code instructions

Project conventions for this repo live in [`AGENTS.md`](./AGENTS.md). Read it before editing code.

`AGENTS.md` is the canonical source — Codex, Aider, and other agents read it directly. This file exists so Claude Code auto-loads the same conventions without duplicating them.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `jjordy/paddock`. Use the `gh` CLI. See [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md).

### Triage labels

Canonical defaults — `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See [`docs/agents/triage-labels.md`](./docs/agents/triage-labels.md).

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root. See [`docs/agents/domain.md`](./docs/agents/domain.md).
