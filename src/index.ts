/**
 * Pi-Copilot Harness - Extension Entry Point.
 */

import type {
  ExtensionAPI,
  ExtensionContext,
  SessionStartEvent,
  AgentEndEvent,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";

import { state, resetState } from "./core/state.js";
import { parseAgentDefinitions } from "./agents/parser.js";
import { injectProviders } from "./providers/loader.js";
import { bridgeMcpServers } from "./agents/mcp-bridge.js";
import { registerNewAgentCommand } from "./agents/newagent.js";
import { registerToolInterceptor } from "./security/interceptor.js";
import { startHttpServer, stopHttpServer, waitForFeedback } from "./http/server.js";
import { runOrchestrator } from "./orchestrator/orchestrator.js";
import { recordToolExecution, updateToolArgs, buildSummary } from "./summary/collector.js";
import { registerModelSelectorCommand } from "./tui/model-selector.js";
import {
  registerThemeCommand,
  getThemePaths,
  loadCustomTheme,
} from "./tui/theme-manager.js";

export default async function piCopilotHarness(pi: ExtensionAPI): Promise<void> {
  // ─── session_start: bootstrap subsystems ───
  pi.on("session_start", async (_event: SessionStartEvent, ctx: ExtensionContext) => {
    resetState();

    // 1. Inject custom providers from providers.json (non-blocking)
    try {
      const providerCount = injectProviders(pi, ctx.cwd);
      if (providerCount > 0) {
        ctx.ui.notify("Injected " + providerCount + " custom provider(s)", "info");
      }
    } catch {}

    // 2. Parse agent definitions
    try {
      const agents = parseAgentDefinitions(ctx.cwd);
      for (const agent of agents) state.agentDefinitions.set(agent.name, agent);
      if (agents.length > 0) ctx.ui.notify("Loaded " + agents.length + " agent definition(s)", "info");
    } catch {}

    // 3. Bridge MCP servers (non-blocking)
    try {
      const mcpCount = await bridgeMcpServers(pi, ctx.cwd);
      if (mcpCount > 0) ctx.ui.notify("Bridged " + mcpCount + " MCP tool(s)", "info");
    } catch {}

    // 4. Start HTTP server for workplan/summary pages
    try {
      const port = await startHttpServer();
      state.httpPort = port;
      ctx.ui.setStatus("copilot", "HTTP :" + port);
    } catch {}

    // 5. Apply custom theme
    try {
      const customTheme = loadCustomTheme(ctx.cwd, "neon");
      if (customTheme) {
        const result = ctx.ui.setTheme(customTheme);
        if (result.success) ctx.ui.notify("Theme: neon", "info");
      }
    } catch {}

    // 6. Read execution mode from CLI flag
    try {
      const flagValue = pi.getFlag("execution-mode");
      if (flagValue && typeof flagValue === "string") {
        const valid = ["strict", "read_only", "execute", "bypass"];
        if (valid.includes(flagValue)) state.executionMode = flagValue as typeof state.executionMode;
      }
    } catch {}
  });

  // ─── CLI flags ───
  pi.registerFlag("execution-mode", {
    description: "Zero-trust execution mode: strict, read_only, execute, bypass",
    type: "string",
    default: "read_only",
  });

  // ─── Zero-trust tool interceptor ───
  registerToolInterceptor(pi, state);

  // ─── Tool execution tracking ───
  pi.on("tool_execution_start", async (event) => {
    updateToolArgs(state, event.toolCallId, event.args);
  });

  pi.on("tool_execution_end", async (event) => {
    recordToolExecution(state, {
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      result: event.result,
      isError: event.isError,
    });
  });

  // ─── Post-action summary on agent_end ───
  pi.on("agent_end", async (_event: AgentEndEvent, ctx: ExtensionContext) => {
    if (state.orchestratorActive) return;
    if (state.toolHistory.length > 0 && state.httpPort > 0) {
      try {
        const summary = buildSummary(state, ctx.getSystemPrompt().slice(0, 200));
        const feedback = await waitForFeedback(summary, state.httpPort);
        if (feedback) pi.sendUserMessage("[User Feedback] " + feedback);
      } catch {}
    }
  });

  // ─── Cleanup on shutdown ───
  pi.on("session_shutdown", async () => { stopHttpServer(); });

  // ─── Register commands ───
  registerNewAgentCommand(pi);
  registerThemeCommand(pi);
  registerModelSelectorCommand(pi);

  // ─── Register custom themes ───
  pi.on("resources_discover", (event) => {
    try {
      const themePaths = getThemePaths(event.cwd);
      if (themePaths.length > 0) return { themePaths };
    } catch {}
    return undefined;
  });

  // ─── /orchestrate command ───
  pi.registerCommand("orchestrate", {
    description: "Run the orchestrator on a goal. Usage: /orchestrate <goal>",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      if (!args.trim()) { ctx.ui.notify("Usage: /orchestrate <goal>", "warning"); return; }
      await runOrchestrator(pi, ctx, state, args);
      ctx.ui.notify("Orchestration complete", "info");
    },
  });

  // ─── /security command ───
  pi.registerCommand("security", {
    description: "View or change zero-trust execution mode",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const modes = ["strict", "read_only", "execute", "bypass"];
      if (args.trim() && modes.includes(args.trim())) {
        state.executionMode = args.trim() as typeof state.executionMode;
        ctx.ui.notify("Mode: " + state.executionMode, "info");
      } else {
        const choice = await ctx.ui.select(
          "Current: " + state.executionMode,
          modes.map(m => (m === state.executionMode ? "=> " : "   ") + m)
        );
        if (choice) {
          const mode = choice.replace(/^[=> ]+/, "").trim();
          if (modes.includes(mode)) {
            state.executionMode = mode as typeof state.executionMode;
            ctx.ui.notify("Mode: " + state.executionMode, "info");
          }
        }
      }
    },
  });

  // ─── /agents command ───
  pi.registerCommand("agents", {
    description: "List loaded agent definitions",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const agents = Array.from(state.agentDefinitions.values());
      if (agents.length === 0) { ctx.ui.notify("No agents found. Use /newagent to create one.", "info"); return; }
      const lines = agents.map(a => {
        const sub = a.subagents ? " (" + a.subagents.length + " subagent(s))" : "";
        return "  " + a.name + ": " + a.description + sub;
      });
      ctx.ui.notify("Agents:\n" + lines.join("\n"), "info");
    },
  });

  // ─── /copilot-status command ───
  pi.registerCommand("copilot-status", {
    description: "Show Pi-Copilot Harness status",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const lines = [
        "Execution Mode: " + state.executionMode,
        "HTTP Port: " + (state.httpPort || "not started"),
        "Agents: " + state.agentDefinitions.size,
        "Tool History: " + state.toolHistory.length + " calls",
        "Orchestrator: " + (state.orchestratorActive ? "active" : "idle"),
      ];
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}
