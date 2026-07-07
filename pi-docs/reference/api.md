---
type: Reference
title: API Reference
description: Complete ExtensionAPI, ExtensionContext, and type definitions for Pi v0.80.3.
tags: [api, reference, types]
timestamp: 2026-07-07T00:00:00Z
resource: node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts
---

# ExtensionAPI (pi.*)

| Method | Signature |
|--------|-----------|
| `on` | `(event, handler) => void` |
| `registerTool` | `(definition: ToolDefinition) => void` |
| `registerCommand` | `(name, options) => void` |
| `registerShortcut` | `(key, options) => void` |
| `registerFlag` | `(name, options) => void` |
| `registerProvider` | `(name, config: ProviderConfig) => void` |
| `unregisterProvider` | `(name) => void` |
| `sendMessage` | `(message) => void` |
| `sendUserMessage` | `(content, options?) => void` |
| `appendEntry` | `(type, data?) => void` |
| `setModel` | `(model) => Promise<boolean>` |
| `setThinkingLevel` | `(level) => void` |
| `getFlag` | `(name) => boolean \| string \| undefined` |
| `getActiveTools` | `() => string[]` |
| `setActiveTools` | `(names: string[]) => void` |
| `exec` | `(cmd, args, opts?) => Promise<ExecResult>` |
| `events` | `EventBus` |

# ExtensionContext (ctx.*)

| Property | Type |
|----------|------|
| `ui` | `ExtensionUIContext` |
| `mode` | `"tui" \| "rpc" \| "json" \| "print"` |
| `cwd` | `string` |
| `model` | `Model \| undefined` |
| `sessionManager` | `ReadonlySessionManager` |
| `modelRegistry` | `ModelRegistry` |
| `isIdle()` | `boolean` |
| `signal` | `AbortSignal \| undefined` |
| `getContextUsage()` | `ContextUsage \| undefined` |
| `getSystemPrompt()` | `string` |

# ExtensionCommandContext (extends ExtensionContext)

| Method | Purpose |
|--------|---------|
| `waitForIdle()` | Wait for streaming to finish |
| `newSession(opts?)` | Create fresh session with `withSession` callback |
| `fork(entryId, opts?)` | Fork from session entry |
| `switchSession(path, opts?)` | Swap to different session file |
| `reload()` | Reload extensions, skills, themes |

# ExtensionUIContext (ctx.ui.*)

| Method | Signature |
|--------|-----------|
| `select` | `(title, options, opts?) => Promise<string \| undefined>` |
| `confirm` | `(title, message, opts?) => Promise<boolean>` |
| `input` | `(title, placeholder?, opts?) => Promise<string \| undefined>` |
| `editor` | `(title, prefill?) => Promise<string \| undefined>` |
| `notify` | `(message, type?) => void` |
| `custom` | `(factory, options?) => Promise<T>` |
| `setStatus` | `(key, text \| undefined) => void` |
| `setTheme` | `(name \| Theme) => { success, error? }` |
| `getAllThemes` | `() => { name, path }[]` |

# ToolDefinition

```typescript
interface ToolDefinition {
  name: string;
  label: string;
  description: string;
  parameters: TSchema;
  executionMode?: "sequential" | "parallel";
  async execute(toolCallId, params, signal, onUpdate, ctx): Promise<AgentToolResult>;
}
```

# ProviderConfig

```typescript
interface ProviderConfig {
  name?: string;
  baseUrl?: string;
  apiKey?: string;
  api?: "openai-completions" | "openai-responses" | "anthropic-messages";
  models?: ProviderModelConfig[];
  headers?: Record<string, string>;
  authHeader?: boolean;
}
```

# Events

| Event | Can Block/Modify |
|-------|-----------------|
| `session_start` | No |
| `session_shutdown` | No |
| `input` | Yes (transform/handle) |
| `before_agent_start` | Yes (modify prompt) |
| `agent_start` | No |
| `tool_call` | Yes (block) |
| `tool_execution_start/end` | No |
| `tool_result` | Yes (modify) |
| `agent_end` | No |

See: [Extensions](/concepts/extensions.md), [Subagents](/concepts/subagents.md)
