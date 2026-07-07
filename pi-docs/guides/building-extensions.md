---
type: Guide
title: Building Extensions
description: Create Pi extensions with tools, commands, and lifecycle hooks.
tags: [extensions, development, tutorial]
timestamp: 2026-07-07T00:00:00Z
---

# Minimal Extension

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default async function (pi: ExtensionAPI): Promise<void> {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Extension loaded!", "info");
  });

  pi.registerTool({
    name: "greet", label: "Greet",
    description: "Greet someone",
    parameters: Type.Object({ name: Type.String() }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return { content: [{ type: "text", text: `Hello, ${params.name}!` }] };
    },
  });

  pi.registerCommand("hello", {
    description: "Say hello",
    handler: async (args, ctx) => { ctx.ui.notify(`Hello ${args}!`, "info"); },
  });
}
```

# Install

```bash
pi install ./my-extension.ts   # global
pi -e ./my-extension.ts        # per-session
```

See: [Extensions](/concepts/extensions.md), [API Reference](/reference/api.md)
