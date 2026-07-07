---
type: Concept
title: Sessions
description: Session format, tree structure, persistence, and management.
tags: [sessions, persistence, jsonl]
timestamp: 2026-07-07T00:00:00Z
---

Sessions are append-only JSONL files forming a tree structure.

# File Format

```jsonl
{"type":"header","version":3,"id":"uuid","timestamp":"ISO","cwd":"/path"}
{"type":"message","id":"1","parentId":null,"message":{"role":"user",...}}
{"type":"message","id":"2","parentId":"1","message":{"role":"assistant",...}}
```

# Entry Types

| Type | Purpose |
|------|---------|
| `message` | user, assistant, or toolResult |
| `thinking_level_change` | Reasoning level change |
| `model_change` | Model switch |
| `compaction` | Context summarization |
| `branch_summary` | Summary of abandoned branch |
| `custom` | Extension-persisted state |
| `custom_message` | Extension message in LLM context |
| `label` | User bookmark |
| `session_info` | Display name |

# Tree Structure

```
[1: user] → [2: assistant] → [3: user] → [4: assistant] (leaf)
                                ↓
                          [branch] → [5: user] → [6: assistant] (new leaf)
```

`/branch` or `/fork` moves the leaf pointer back, creating a new branch.

# ReadonlySessionManager

Access via `ctx.sessionManager` in [extensions](/concepts/extensions.md):

```typescript
ctx.sessionManager.getEntries()      // SessionEntry[]
ctx.sessionManager.getLeafEntry()    // latest entry
ctx.sessionManager.getTree()         // SessionTreeNode[]
```

**Note**: `ReadonlySessionManager` lacks `buildSessionContext()`. Use `getEntries()` with manual filtering.

See: [Compaction](/concepts/compaction.md), [Subagents](/concepts/subagents.md)
