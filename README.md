# Pi-Copilot Extension

A Pi Agent extension that replicates VSCode GitHub Copilot entirely in the terminal. Adds a model selector, agent system with subagents, orchestrator with DAG-based task decomposition, zero-trust security, and post-action summary with feedback loop.

## Requirements

- **Node.js 22+** (Pi CLI requires it — `undici@8.5.0` crashes on Node 20)
- Pi Agent: `@earendil-works/pi-coding-agent` ^0.80.3

## Install

```bash
# 1. Clone
git clone https://github.com/dmaxz/pi-agent-copilot-extension.git
cd pi-agent-copilot-extension

# 2. Install and build
npm install
npm run build

# 3. Install extension globally (loads on every pi session)
pi install ./dist/index.js
```

Verify it's loaded:

```bash
pi --print "hello" --no-tools
```

If you see no extension errors, it's working.

## Quick Start

Once installed, these commands are available in any `pi` session:

```
/model-selector          Pick a model from TUI (or Ctrl+M)
/agents                  List loaded agent definitions
/newagent                Create a custom agent interactively
/orchestrate <goal>      Run the orchestrator on a complex task
/security                View or change execution mode
/copilot-status          Show extension status
/theme [name]            Switch TUI theme
```

## Features

### 1. Model Selector

`/model-selector` or `Ctrl+M` opens a TUI modal showing all available models grouped by provider. Select with arrow keys + Enter.

Add custom providers via `.pi/copilot/providers.json` in your project root (see Configuration below).

### 2. Agent System

Define agents as Markdown files with YAML frontmatter in `.pi/agents/`:

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

**Predefined agents** (in `.pi/agents/`):

| Agent | Purpose |
|-------|---------|
| `ask` | Read-only Q&A (like Copilot Chat) |
| `agent` | General-purpose coding (like Copilot inline) |
| `orchestrator` | Project manager with DAG decomposition |
| `code-reviewer` | Code review specialist |

Use `/newagent` to create new agents interactively.

### 3. Orchestrator

`/orchestrate <goal>` decomposes a complex task into a dependency graph:

1. Analyzes the goal and creates a **workplan** (DAG of tasks)
2. Serves the workplan as a web page at `localhost:<port>`
3. You **approve or reject** (with optional notes) in the browser
4. Executes workers in dependency order, parallelizing where possible

**4 worker roles:**

| Worker | Tools | Purpose |
|--------|-------|---------|
| reader | read, grep, find, ls | Read and analyze files |
| writer | read, write, edit, ls, grep, find | Create or modify files |
| executor | bash, read, ls | Run commands and MCP tools |
| crawler | bash, read | Web search and content fetching |

Each worker runs in an **isolated Pi session** via `ctx.newSession()`. Failed workers retry up to 2 times. Dependent tasks are skipped if their dependency fails.

### 4. Zero-Trust Security

`/security` toggles between 4 execution modes:

| Mode | Behavior |
|------|----------|
| `strict` | Every tool call requires TUI confirmation |
| `read_only` | File ops allowed; dangerous bash intercepted with explanation |
| `execute` | Most ops allowed; `sudo`, `dd`, `iptables` intercepted |
| `bypass` | Full autonomy (YOLO) |

Set via `/security bypass` or `pi --flag execution-mode=bypass`.

**What gets intercepted in `read_only` mode:**
- `rm -rf`, `mv` with paths, `drop table/database`
- `sudo`, `dd if=`, `iptables`, `mkfs`, `format`
- `kill -9`, `pkill`, `systemctl stop/disable`
- Network calls: `curl`, `wget`, `ssh`, `scp`

### 5. Post-Action Summary

When a session completes, the extension serves a summary web page showing:
- File diffs (what changed)
- Command execution logs (what ran)
- Workplan task status (if orchestrator was used)
- A **feedback form** where you type suggestions that get injected back into the agent loop

## Configuration

### Custom Providers

Create `.pi/copilot/providers.json` in your project root:

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

The extension reads this on `session_start` and calls `pi.registerProvider()` to inject the providers. You can also override built-in providers by using the same name (e.g. `"openai"`).

**Important**: `OPENAI_BASE_URL` does NOT work for the plain OpenAI provider. Use `registerProvider()` via this config instead.

### MCP Servers

Create `.pi/copilot/mcp.json` in your project root:

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

The extension auto-discovers MCP tools and registers them as `mcp_<server>_<tool>`.

### Agent Definitions

Create `.pi/agents/*.md` files with YAML frontmatter:

```markdown
---
name: reviewer
description: Reviews code for quality
default_model: anthropic/claude-sonnet-4-20250514
thinking_level: high
tools: [read, grep, find, ls]
mcps: [github]
subagents:
  - name: searcher
    description: Searches for patterns
    tools: [grep, find, ls]
    system_prompt: "Search the codebase and report findings."
---

You are a senior code reviewer. Be thorough and constructive.
```

## Usage Examples

### Basic coding task

```bash
pi
> Refactor src/utils.ts to use async/await instead of callbacks
```

### Orchestrated multi-step task

```bash
pi
> /orchestrate Add a REST API with GET/POST endpoints for users, write tests, and run them
```

This will:
1. Decompose into reader → writer → executor tasks
2. Show you a workplan web page for approval
3. Execute workers in order (reader analyzes, writer creates files, executor runs tests)
4. Show a summary page when done

### Using a custom provider

```bash
# Set up .pi/copilot/providers.json first, then:
pi --provider my-proxy --model gpt-4o
```

### Switching security mode

```bash
pi
> /security strict    # every tool needs approval
> /security bypass    # full autonomy
```

## Architecture

```
src/
├── index.ts              # Extension entry point (wires all subsystems)
├── core/
│   ├── types.ts          # Shared type definitions
│   ├── state.ts          # Global mutable state singleton
│   └── config.ts         # Config file loaders
├── tui/
│   ├── model-selector.ts # Model picker TUI (Ctrl+M)
│   └── theme-manager.ts  # Theme discovery and switching
├── agents/
│   ├── parser.ts         # Markdown+YAML agent definition parser
│   ├── mcp-bridge.ts     # MCP client bridge (JSON-RPC over stdio)
│   └── newagent.ts       # /newagent interactive wizard
├── orchestrator/
│   ├── orchestrator.ts   # DAG engine + session-based worker execution
│   ├── dag.ts            # Dependency resolution and scheduling
│   └── workers.ts        # Worker role definitions
├── security/
│   ├── interceptor.ts    # tool_call event interceptor
│   └── modes.ts          # Destructive command pattern matching
├── summary/
│   └── collector.ts      # Tool execution tracking + summary builder
└── http/
    ├── server.ts         # Express server (workplan + summary pages)
    ├── workplan-page.ts  # Workplan approval HTML
    └── summary-page.ts   # Post-action summary HTML
```

## Development

```bash
npm install
npm run build        # Compile TypeScript
npm run typecheck    # Type-check only (no output)
npm run dev          # Watch mode
```

## Pi Agent Docs

See the `pi-docs/` directory for a complete OKF-format knowledge bundle covering Pi Agent's extension API, sessions, providers, security, and more.

## License

MIT
