---
type: Concept
title: Security
description: Trust modes, tool approval, and extension-based security interceptors.
tags: [security, trust, approval]
timestamp: 2026-07-07T00:00:00Z
---

# Trust Modes

| Mode | Behavior |
|------|----------|
| `ask` (default) | Prompt for each tool call |
| `trust` | Auto-approve safe tools |
| `yolo` | Approve everything |

# Extension Interceptor

```typescript
pi.on("tool_call", async (event, ctx) => {
  if (event.toolName === "bash") {
    const cmd = event.input.command;
    if (/sudo|rm -rf/.test(cmd)) {
      const ok = await ctx.ui.confirm("Dangerous!", cmd);
      if (!ok) return { block: true, reason: "Denied" };
    }
  }
});
```

See: [Extensions](/concepts/extensions.md)
