---
type: Concept
title: Providers
description: LLM provider system, model management, and custom provider registration.
tags: [providers, models, api-keys]
timestamp: 2026-07-07T00:00:00Z
---

Pi supports 20+ LLM providers. Each maps to an API backend and exposes models.

# Built-in Providers

| Provider | Auth | Env Var |
|----------|------|---------|
| OpenAI | API key | `OPENAI_API_KEY` |
| Anthropic | API key | `ANTHROPIC_API_KEY` |
| Google Gemini | API key | `GOOGLE_API_KEY` |
| DeepSeek | API key | `DEEPSEEK_API_KEY` |
| xAI / Grok | API key | `XAI_API_KEY` |
| GitHub Copilot | Token | `COPILOT_GITHUB_TOKEN` |
| OpenRouter | API key | `OPENROUTER_API_KEY` |

# API Types

| Type | When to Use |
|------|-------------|
| `openai-completions` | Most OpenAI-compatible proxies |
| `openai-responses` | Native OpenAI Responses API |
| `anthropic-messages` | Anthropic native API |

# ModelRegistry

Access via `ctx.modelRegistry` in [extensions](/concepts/extensions.md):

```typescript
ctx.modelRegistry.getAvailable()           // Model[] — only with auth
ctx.modelRegistry.getAll()                 // all models
ctx.modelRegistry.find(provider, modelId)  // Model | undefined
```

See: [Custom Providers](/guides/custom-providers.md), [API Reference](/reference/api.md)
