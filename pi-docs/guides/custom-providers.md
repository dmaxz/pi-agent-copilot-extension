---
type: Guide
title: Custom Providers
description: Register custom OpenAI-compatible LLM endpoints via registerProvider().
tags: [providers, custom, proxy]
timestamp: 2026-07-07T00:00:00Z
---

# Register in Extension

```typescript
pi.on("session_start", async (_event, ctx) => {
  pi.registerProvider("my-proxy", {
    name: "My Proxy",
    baseUrl: "https://proxy.example.com/v1",
    apiKey: "$MY_API_KEY",
    api: "openai-completions",
    models: [{
      id: "my-model", name: "My Model",
      reasoning: false, input: ["text"],
      contextWindow: 128000, maxTokens: 16384,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    }],
    authHeader: true,
  });
});
```

# Override Built-in

Register with same name (e.g. `"openai"`) to redirect.

**Important**: `OPENAI_BASE_URL` does NOT work for plain OpenAI. Use `registerProvider()`.

See: [Providers](/concepts/providers.md), [Extensions](/concepts/extensions.md)
