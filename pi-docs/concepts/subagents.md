---
type: Concept
title: Subagents
description: Spawning worker sessions via ctx.newSession() for in-process subagent orchestration.
tags: [subagents, sessions, orchestration]
timestamp: 2026-07-07T00:00:00Z
---

`ExtensionAPI` has no `spawnSubagent()`. Use `ctx.newSession()` for in-process worker sessions.

# Synchronous Pattern

```typescript
async function executeWorker(ctx, workerPrompt) {
  let output = "";
  await ctx.newSession({
    withSession: async (sessionCtx) => {
      await sessionCtx.sendUserMessage(workerPrompt);
      await sessionCtx.waitForIdle();
      const entries = sessionCtx.sessionManager.getEntries();
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (entry.type !== "message") continue;
        const msg = entry.message;
        if (!msg || msg.role !== "assistant") continue;
        output = msg.content.filter(c => c.type === "text").map(c => c.text).join("\n");
        break;
      }
    },
  });
  return output;
}
```

# Fire-and-Forget

```typescript
pi.sendUserMessage("Run the tests");  // void — no result
```

# Important

- `ReplacedSessionContext` is NOT exported — TS infers from callback
- `sessionCtx.setActiveTools()` does NOT exist — include restrictions in prompt
- `waitForIdle()` blocks until agent finishes all tool calls
- Each session is isolated — no shared context between workers

See: [Extensions](/concepts/extensions.md), [Sessions](/concepts/sessions.md)
