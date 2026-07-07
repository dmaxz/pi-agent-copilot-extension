---
type: Concept
title: Extensions
description: Extension API, lifecycle events, tool/command registration, and subagent patterns.
tags: [extensions, api, development]
timestamp: 2026-07-07T00:00:00Z
---

Extensions are TypeScript modules that hook into Pi's lifecycle.

# Locations

| Location | Scope |
|----------|-------|
| `~/.pi/agent/extensions/*.ts` | Global (all projects) |
| `.pi/extensions/*.ts` | Project-local |

# Lifecycle Events

```
pi starts
  ├─ project_trust
  ├─ session_start
  └─ resources_discover

user sends prompt
  ├─ input (can intercept/transform)
  ├─ before_agent_start (modify system prompt)
  ├─ agent_start
  │   ┌─── turn loop ───┐
  │   ├─ turn_start
  │   ├─ context (modify messages)
  │   ├─ before_provider_request
  │   ├─ after_provider_response
  │   │   tool calls:
  │   │     ├─ tool_execution_start
  │   │     ├─ tool_call (CAN BLOCK)
  │   │     ├─ tool_result (CAN MODIFY)
  │   │     └─ tool_execution_end
  │   └─ turn_end
  └─ agent_end
```

# Registration APIs

| Method | Purpose |
|--------|---------|
| `pi.registerTool(def)` | LLM-callable tool |
| `pi.registerCommand(name, opts)` | Slash command |
| `pi.registerShortcut(key, opts)` | Keyboard shortcut |
| `pi.registerFlag(name, opts)` | CLI flag |
| `pi.registerProvider(name, config)` | LLM provider |

# Minimal Extension

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default async function (pi: ExtensionAPI): Promise<void> {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Loaded!", "info");
  });

  pi.registerTool({
    name: "greet",
    label: "Greet",
    description: "Greet someone",
    parameters: Type.Object({ name: Type.String() }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return { content: [{ type: "text", text: `Hello, ${params.name}!` }] };
    },
  });
}
```

# Pitfalls

1. **typebox v1.x** — `import { Type } from "typebox"`, NOT `@sinclair/typebox`
2. **ReplacedSessionContext** not exported — let TS infer from callback
3. **ReadonlySessionManager** lacks `buildSessionContext()` — use `getEntries()`
4. **setActiveTools()** is on `pi`, not session context
5. **OPENAI_BASE_URL** doesn't work — use `registerProvider()`
6. **sendUserMessage()** is fire-and-forget — use `ctx.newSession()` for synchronous

See: [Subagents](/concepts/subagents.md), [API Reference](/reference/api.md), [Custom Providers](/guides/custom-providers.md)
