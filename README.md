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
```

### Option A: Install globally (loads on every pi session)

```bash
pi install ./dist/index.js
```

This registers the extension in Pi's settings. Every `pi` session will load it automatically.

### Option B: Load for one session only (no install)

```bash
pi -e ./dist/index.js
```

Or with a specific model:

```bash
pi -e ./dist/index.js --provider openai --model gpt-4o
```

The extension loads only for that session. Next time you run `pi` without `-e`, it won't be there.

### Option C: Symlink for development (auto-picks up rebuilds)

```bash
ln -sf $(pwd)/dist/index.js ~/.pi/agent/extensions/pi-copilot.js
```

After each `npm run build`, the extension updates automatically. Remove the symlink to uninstall:

```bash
rm ~/.pi/agent/extensions/pi-copilot.js
```

## Uninstall

```bash
pi remove ./dist/index.js
```

Or if you used the symlink approach:

```bash
rm ~/.pi/agent/extensions/pi-copilot.js
```

To verify it's removed:

```bash
pi list
```

### Windows

```powershell
# Clone
git clone https://github.com/dmaxz/pi-agent-copilot-extension.git
cd pi-agent-copilot-extension

# Install and build
npm install
npm run build

# Option A: Install globally
pi install .\dist\index.js

# Option B: One-time load
pi -e .\dist\index.js

# Option C: Symlink (run PowerShell as Admin)
mkdir -Force "$env:USERPROFILE\.pigent\extensions" | Out-Null
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.pi\agent\extensions\pi-copilot.js" -Target "$(Get-Location)\dist\index.js"

# Uninstall
pi remove .\dist\index.js
# or remove symlink:
Remove-Item "$env:USERPROFILE\.pi\agent\extensions\pi-copilot.js"

# Verify
pi list
```

**Windows notes:**
- Use `\` or `/` in paths — Pi accepts both
- Symlink requires PowerShell **Run as Administrator**
- `Alt+Enter` doesn't insert newline in Pi — use `Ctrl+Enter`
- Node.js 22+ required: `node --version` to check

## Test the Extension

### Step 1: Verify it loads

Run a simple non-interactive session. If the extension loads, you'll see no import errors:

```bash
pi --print "hello" --no-tools
```

Expected: a greeting response. If you see `Failed to load extension`, check Node.js version (`node --version` must be 22+).

### Step 2: Check extension status

```bash
pi
> /copilot-status
```

Expected output:
```
Execution Mode: read_only
HTTP Port: <port number>
Agents: <count>
Tool History: 0 calls
Orchestrator: idle
```

### Step 3: Test the model selector

```bash
pi
> /model-selector
```

A TUI modal opens showing available models. Pick one with arrow keys + Enter. You should see a notification: `Model: <name>`.

Also try `Ctrl+M` as a keyboard shortcut.

### Step 4: Test agent definitions

```bash
pi
> /agents
```

Expected: lists the predefined agents (ask, agent, orchestrator, code-reviewer) with their descriptions.

Create a new agent:
```bash
pi
> /newagent
```

Follow the prompts to create a custom agent. Verify it appears in `.pi/agents/`.

### Step 5: Test security interceptor

```bash
pi
> Run the command: rm -rf /tmp/test_dir_12345
```

In `read_only` mode (default), the extension should **block** the `rm -rf` command and show:
```
Blocked: Matches destructive pattern: \brm\s+(-[rfR]*\s+)*
```

Then try a safe command:
```bash
pi
> Run: echo "hello world"
```

This should execute normally.

Switch modes:
```bash
pi
> /security strict    # every tool needs confirmation
> /security bypass    # full autonomy
> /security           # interactive selector
```

### Step 6: Test custom providers

Create `.pi/copilot/providers.json` in your working directory:

```json
[
  {
    "name": "my-proxy",
    "displayName": "My API Proxy",
    "baseUrl": "https://your-proxy.com/v1",
    "apiKey": "$YOUR_API_KEY",
    "api": "openai-completions",
    "models": [
      {
        "id": "your-model",
        "name": "Your Model",
        "reasoning": false,
        "input": ["text"],
        "contextWindow": 128000,
        "maxTokens": 16384,
        "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
      }
    ]
  }
]
```

Launch with the custom provider:
```bash
pi --provider my-proxy --model your-model
> /model-selector   # should show "Your Model"
> What is 2+2?
```

If the model responds, provider injection is working.

### Step 7: Test the orchestrator

```bash
pi
> /orchestrate Read the file package.json and tell me the project name and version
```

Expected flow:
1. Extension decomposes the goal into tasks (reader → executor)
2. A workplan web page opens at `http://127.0.0.1:<port>/workplan/<id>`
3. Open that URL in your browser
4. Review the tasks, optionally add notes
5. Click **Approve & Execute**
6. Workers execute in order
7. A summary page appears when done

If the HTTP server doesn't start, check that port isn't blocked.

### Step 8: Test post-action summary

After any session where tools were used, the extension serves a summary page:

```bash
pi
> List files in the current directory
> /copilot-status
```

Check the terminal output for a line like:
```
Session summary: http://127.0.0.1:<port>/summary/<id>
```

Open in browser to see tool execution history, file changes, and the feedback form.

### Step 9: Test with --mode json (programmatic)

For integration testing or scripting:

```bash
pi --mode json --print "What is 2+2?" --no-tools 2>&1 | python3 -c "
import sys, json
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    try:
        d = json.loads(line)
        if d.get('type') == 'agent_end':
            for m in d.get('messages', []):
                if m.get('role') == 'assistant':
                    for c in m.get('content', []):
                        if c.get('type') == 'text':
                            print(c['text'])
    except: pass
"
```

### Step 10: Test with a real coding task

```bash
cd /path/to/your/project
pi
> Read the main source file and explain what it does in 3 bullet points
```

The extension should:
- Allow the `read` tool (safe in read_only mode)
- Block any dangerous commands if the model tries them
- Show a summary page when the turn completes

### Troubleshooting

| Problem | Fix |
|---------|-----|
| `Failed to load extension` | Upgrade Node.js to 22+ |
| `No API key found` | Set env var or configure provider in `.pi/copilot/providers.json` |
| `Model not found` | Use `--provider` and `--model` matching your providers.json config |
| `rm -rf` not blocked | Check `/copilot-status` — mode must be `read_only` (not `bypass`) |
| Workplan page won't open | Check the port in `/copilot-status`, try `http://127.0.0.1:<port>` |
| `/model-selector` empty | No providers configured — add `.pi/copilot/providers.json` |

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

## Quick Provider Setup

Don't want to edit JSON files? Use the interactive wizard:



It walks you through:
1. Select provider (OpenAI, Anthropic, DeepSeek, Google, OpenRouter, xAI, or custom)
2. Enter base URL (for custom proxies)
3. Enter API key
4. Select API type
5. Enter model ID and display name
6. Confirm reasoning model capability
7. Saves to  + 

For custom proxies, it also creates  in your current project.



## Configuration

Pi has a layered configuration system. Settings cascade: **project overrides global**.

### Layer 1: System-wide (all projects)

#### Auth file — `~/.pi/agent/auth.json`

Store API keys for built-in providers:

```json
{
  "openai": { "type": "api_key", "key": "sk-..." },
  "anthropic": { "type": "api_key", "key": "sk-ant-..." },
  "deepseek": { "type": "api_key", "key": "sk-..." },
  "google": { "type": "api_key", "key": "..." }
}
```

Or use `/login` interactively to add keys:

```bash
pi
> /login
# Select provider → enter API key → saved to auth.json
```

#### Settings file — `~/.pi/agent/settings.json`

Set default provider and model globally:

```json
{
  "defaultProvider": "openai",
  "defaultModel": "gpt-4o",
  "defaultThinkingLevel": "medium"
}
```

Or use `/settings` interactively:

```bash
pi
> /settings
# Navigate to change default provider/model
```

#### Environment variables

```bash
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export DEEPSEEK_API_KEY=sk-...
```

**Auth resolution order**: CLI flag `--api-key` → environment variable → `auth.json`

### Layer 2: Project-local (overrides system-wide)

#### Pi settings — `.pi/settings.json`

Override `defaultProvider`, `defaultModel`, etc. for this project only:

```json
{
  "defaultProvider": "my-proxy",
  "defaultModel": "executor"
}
```

#### Extension providers — `.pi/copilot/providers.json`

This is the Pi-Copilot extension's config. It registers custom providers on `session_start` via `pi.registerProvider()`. Use this for providers that aren't built-in (custom proxies, vLLM, Ollama, etc.):

```json
[
  {
    "name": "my-proxy",
    "displayName": "My API Proxy",
    "baseUrl": "https://your-proxy.com/v1",
    "apiKey": "$YOUR_API_KEY",
    "api": "openai-completions",
    "models": [
      {
        "id": "your-model",
        "name": "Your Model",
        "reasoning": false,
        "input": ["text"],
        "contextWindow": 128000,
        "maxTokens": 16384,
        "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
      }
    ]
  }
]
```

**You can override built-in providers** by registering with the same name (e.g. `"openai"`). This redirects the built-in OpenAI provider to your custom endpoint.

**`$ENV_VAR` interpolation** works in `apiKey` — set `YOUR_API_KEY` in your environment or `.env` file.

**Important**: `OPENAI_BASE_URL` does NOT work for the plain OpenAI provider. Use this config instead.

### How to set a provider globally and use it everywhere

**Step 1**: Add your API key to `~/.pi/agent/auth.json`:

```json
{
  "openai": { "type": "api_key", "key": "sk-c71381a4..." }
}
```

**Step 2**: Set default model in `~/.pi/agent/settings.json`:

```json
{
  "defaultProvider": "openai",
  "defaultModel": "gpt-4o"
}
```

**Step 3**: Now `pi` uses that model everywhere without flags:

```bash
pi                    # uses openai/gpt-4o
pi --model claude-3    # override for this session
```

### How to set a custom proxy per-project

**Step 1**: Create `.pi/copilot/providers.json` in your project:

```json
[
  {
    "name": "openai",
    "displayName": "My Proxy",
    "baseUrl": "https://my-proxy.com/v1",
    "apiKey": "$MY_PROXY_KEY",
    "api": "openai-completions",
    "models": [
      { "id": "gpt-4o", "name": "GPT-4o", "reasoning": false,
        "input": ["text"], "contextWindow": 128000, "maxTokens": 16384,
        "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 } }
    ]
  }
]
```

**Step 2**: Create `.pi/settings.json` to use it:

```json
{
  "defaultProvider": "openai",
  "defaultModel": "gpt-4o"
}
```

**Step 3**: Run `pi` from that directory — it automatically uses your proxy:

```bash
cd /path/to/project
pi                    # uses project-local proxy
```

### In-session commands

| Command | Purpose |
|---------|---------|
| `/login` | Add API key (OAuth or API key) interactively |
| `/logout` | Clear saved credentials |
| `/model` | Change model for current session |
| `/settings` | View/change common settings |
| `/model-selector` | TUI model picker (Pi-Copilot extension) |
| `/copilot-status` | Check extension and provider status |

### Config file locations

| File | Scope | Purpose |
|------|-------|---------|
| `~/.pi/agent/auth.json` | Global | API keys for built-in providers |
| `~/.pi/agent/settings.json` | Global | Default provider, model, UI prefs |
| `.pi/settings.json` | Project | Override global settings |
| `.pi/copilot/providers.json` | Project | Custom providers (extension) |
| `.pi/copilot/mcp.json` | Project | MCP servers (extension) |
| `.pi/agents/*.md` | Project | Agent definitions (extension) |

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
