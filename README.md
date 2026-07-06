# Pi-Copilot Harness

A Pi Agent extension that replicates VSCode GitHub Copilot functionality entirely within the terminal.

## Features

### 1. Model Selector (`/model-selector` or `Ctrl+M`)
- TUI modal showing all available models grouped by provider
- Click or keyboard selection to switch models instantly
- Add custom OpenAI-compatible providers via `.pi/copilot/providers.json`

### 2. Agent System (`/agents`, `/newagent`)
- Define agents as Markdown files with YAML frontmatter in `.pi/agents/`
- Each agent supports: `default_model`, `thinking_level`, `tools`, `mcps`, `subagents`
- `/newagent` wizard for interactive agent creation
- MCP client bridge auto-discovers and registers MCP tools

**Predefined agents:**
- **ask** — Read-only Q&A agent (like Copilot Chat)
- **agent** — General-purpose coding agent (like Copilot inline agent)
- **orchestrator** — Project manager with DAG-based task decomposition

### 3. Orchestrator (`/orchestrate <goal>`)
- Decomposes complex goals into a dependency graph (DAG)
- 4 specialized workers: **reader**, **writer**, **executor**, **crawler**
- Each worker runs in an **isolated Pi session** via `ctx.newSession()`
- Workplan served as HTML at `localhost:<port>` for approve/reject with notes
- Automatic retry (2x) on worker failure, dependency-aware scheduling

### 4. Zero-Trust Security (`/security`)
- **strict** — Every tool call requires TUI confirmation
- **read_only** — File ops allowed; dangerous bash intercepted with explanation
- **execute** — Most ops allowed; highly destructive commands (sudo, dd, iptables) intercepted
- **bypass** — Full autonomy (YOLO mode)

### 5. Post-Action Summary
- Automatic summary web page on session completion
- Shows: file diffs, command execution logs, workplan task status
- Feedback form injects suggestions back into the agent loop via `pi.sendUserMessage()`

## Installation

```bash
# Copy to your Pi extensions directory
cp -r pi-copilot ~/.pi/extensions/

# Or link it
ln -s $(pwd) ~/.pi/extensions/pi-copilot
```

## Configuration

### Custom Providers (`.pi/copilot/providers.json`)

```json
[
  {
    "name": "my-proxy",
    "displayName": "My API Proxy",
    "baseUrl": "https://api.example.com/v1",
    "apiKey": "$MY_API_KEY",
    "api": "openai-completions",
    "models": [
      {
        "id": "gpt-4o",
        "name": "GPT-4o (Proxy)",
        "reasoning": false,
        "input": ["text", "image"],
        "contextWindow": 128000,
        "maxTokens": 16384,
        "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
      }
    ]
  }
]
```

### MCP Servers (`.pi/copilot/mcp.json`)

```json
{
  "servers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
    }
  }
}
```

### Agent Definitions (`.pi/agents/*.md`)

```markdown
---
name: my-agent
description: Does something useful
default_model: anthropic/claude-sonnet-4-20250514
thinking_level: medium
tools: [read, write, edit, bash]
mcps: [filesystem]
subagents:
  - name: helper
    description: Helper subagent
    tools: [read, bash]
    system_prompt: "You are a helper. Read files and report findings."
---

You are my-agent. Your system prompt goes here.
```

## Slash Commands

| Command | Description |
|---------|-------------|
| `/model-selector` | Open model picker (or `Ctrl+M`) |
| `/orchestrate <goal>` | Run orchestrator on a goal |
| `/security [mode]` | View/change execution mode |
| `/agents` | List loaded agent definitions |
| `/newagent` | Create a new agent interactively |
| `/theme [name]` | Switch TUI theme |
| `/copilot-status` | Show harness status |

## Architecture

```
src/
├── index.ts              # Extension entry point
├── core/
│   ├── types.ts          # Shared type definitions
│   ├── state.ts          # Global mutable state singleton
│   └── config.ts         # Config file loaders
├── tui/
│   ├── model-selector.ts # Model picker TUI
│   └── theme-manager.ts  # Theme discovery and switching
├── agents/
│   ├── parser.ts         # Markdown+YAML agent definition parser
│   ├── mcp-bridge.ts     # MCP client bridge (JSON-RPC over stdio)
│   └── newagent.ts       # /newagent wizard
├── orchestrator/
│   ├── orchestrator.ts   # DAG engine + session-based worker execution
│   ├── dag.ts            # Dependency resolution, parallel scheduling
│   └── workers.ts        # Worker role definitions (reader/writer/executor/crawler)
├── security/
│   ├── interceptor.ts    # tool_call event interceptor
│   └── modes.ts          # Destructive command heuristics
├── summary/
│   └── collector.ts      # Tool execution tracking + summary builder
└── http/
    ├── server.ts         # Express server (workplan approval + summary)
    ├── workplan-page.ts  # Workplan HTML renderer
    └── summary-page.ts   # Summary HTML renderer
```

## Development

```bash
npm install
npm run build        # Compile TypeScript
npm run typecheck    # Type-check only
npm run dev          # Watch mode
```

## Requirements

- Pi Agent (`@earendil-works/pi-coding-agent` ^0.80.3)
- Node.js >= 18
