---
type: Concept
title: Compaction
description: Context compaction and session summarization when token limit approaches.
tags: [compaction, context, tokens]
timestamp: 2026-07-07T00:00:00Z
---

Compaction summarizes older messages when the context window fills up.

# How It Works

1. Context usage crosses threshold (~50%)
2. Older messages summarized into compaction entry
3. Recent messages kept intact
4. Session tree structure preserved

# Commands

| Command | Purpose |
|---------|---------|
| `/compact` | Manual compaction |
| `ctx.getContextUsage()` | Check token usage |

See: [Sessions](/concepts/sessions.md)
