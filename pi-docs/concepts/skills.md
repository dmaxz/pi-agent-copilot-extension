---
type: Concept
title: Skills
description: Skill system for reusable knowledge documents loaded into the system prompt.
tags: [skills, knowledge]
timestamp: 2026-07-07T00:00:00Z
---

Skills are markdown documents loaded into the system prompt.

# Locations

| Location | Scope |
|----------|-------|
| `~/.pi/skills/` | Global |
| `.pi/skills/` | Project-local |

# Commands

| Command | Purpose |
|---------|---------|
| `/skills` | Browse and install |
| `/skill <name>` | Load into session |
| `/reload-skills` | Rescan directories |

See: [Extensions](/concepts/extensions.md)
