---
type: Concept
title: Architecture
description: Pi Agent system architecture, package structure, and runtime model.
tags: [architecture, packages, core]
timestamp: 2026-07-07T00:00:00Z
---

Pi Agent is a terminal-based AI coding assistant composed of four packages:

| Package | Purpose |
|---------|---------|
| `@earendil-works/pi-coding-agent` | CLI, extensions, TUI, session management |
| `@earendil-works/pi-agent-core` | Agent loop, state, message types |
| `@earendil-works/pi-tui` | TUI primitives (Component, TUI, Editor) |
| `@earendil-works/pi-ai` | Model/provider types, streaming API |

# Runtime Flow

```
User Input
  → Extension input event (can intercept/transform)
  → before_agent_start (modify system prompt)
  → Agent Loop
      → LLM call (streaming)
      → Tool calls (parallel or sequential)
      → Repeat until text response
  → agent_end
  → Render in TUI
```

Each turn: LLM produces text and/or tool calls. Tool calls execute, results feed back. Loop continues until LLM produces a final text response with no tool calls.

Part of the [Pi Agent bundle](/index.md). See: [Extensions](/concepts/extensions.md), [Providers](/concepts/providers.md)
