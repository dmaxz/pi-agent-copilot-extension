---
type: Guide
title: Quickstart
description: Install Pi Agent and run your first session.
tags: [setup, install]
timestamp: 2026-07-07T00:00:00Z
---

# Install

```bash
npm install -g @earendil-works/pi-coding-agent
pi --version
```

# First Run

```bash
pi                                    # interactive
pi --print "Explain this codebase"    # non-interactive
pi --model anthropic/claude-sonnet-4  # specific model
pi --continue                         # resume last session
```

# Auth

```bash
pi                # prompts for provider login
/export OPENAI_API_KEY=sk-...
pi --api-key sk-... --provider openai
```

See: [Configuration](/guides/configuration.md), [Custom Providers](/guides/custom-providers.md)
