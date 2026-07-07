---
type: Guide
title: Configuration
description: Settings file, CLI flags, environment variables, and prompt templates.
tags: [configuration, settings, cli]
timestamp: 2026-07-07T00:00:00Z
---

# Settings File

`~/.pi/agent/settings.json` — UI preferences, model defaults, extension settings.

# Key CLI Flags

| Flag | Purpose |
|------|---------|
| `--model, -m` | Model (e.g. `anthropic/claude-sonnet-4`) |
| `--provider` | Force provider |
| `--api-key` | API key override |
| `--thinking <level>` | off/minimal/low/medium/high/xhigh |
| `--no-tools, -nt` | Disable all tools |
| `--tools, -t <list>` | Comma-separated allowlist |
| `--extension, -e` | Load extension file |
| `--print, -p` | Non-interactive mode |
| `--continue, -c` | Resume most recent session |
| `--no-session` | Ephemeral (don't save) |

See: [Quickstart](/guides/quickstart.md)
