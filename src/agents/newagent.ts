/**
 * /newagent slash command implementation.
 *
 * Interactive wizard to create a new agent definition with optional subagents.
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { getAgentsDir } from "../core/config.js";

const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"];

export function registerNewAgentCommand(pi: ExtensionAPI): void {
  pi.registerCommand("newagent", {
    description: "Create a new agent definition interactively",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      const name = await ctx.ui.input("Agent name (lowercase, hyphens)", "my-agent");
      if (!name) return;

      const description = await ctx.ui.input("Description", "A helpful agent");
      if (!description) return;

      const model = await ctx.ui.input("Default model (optional)", "anthropic/claude-sonnet-4-20250514");
      const thinkingLevel = await ctx.ui.select("Thinking level", THINKING_LEVELS);

      const toolsChoice = await ctx.ui.select("Tool preset", [
        "default (read, write, edit, bash)",
        "read-only",
        "full (all tools)",
        "custom",
      ]);

      let tools: string[];
      switch (toolsChoice) {
        case "read-only":
          tools = ["read", "grep", "find", "ls"];
          break;
        case "full (all tools)":
          tools = ["read", "write", "edit", "bash", "grep", "find", "ls"];
          break;
        case "custom": {
          const customTools = await ctx.ui.input("Tools (comma-separated)", "read, write, edit, bash");
          tools = customTools ? customTools.split(",").map((t: string) => t.trim()) : ["read", "write", "edit", "bash"];
          break;
        }
        default:
          tools = ["read", "write", "edit", "bash"];
      }

      const mcpsInput = await ctx.ui.input("MCP servers (comma-separated, optional)", "");
      const mcps = mcpsInput ? mcpsInput.split(",").map((m: string) => m.trim()).filter(Boolean) : [];

      // Subagent definitions
      const wantSubagents = await ctx.ui.confirm("Subagents", "Define subagents for this agent?");
      const subagentLines: string[] = [];

      if (wantSubagents) {
        let adding = true;
        while (adding) {
          const saName = await ctx.ui.input("Subagent name (empty to stop)", "");
          if (!saName) { adding = false; break; }
          const saDesc = await ctx.ui.input("Subagent description", `Helper: ${saName}`);
          const saModel = await ctx.ui.input("Subagent model (empty = inherit)", "");
          const saToolsInput = await ctx.ui.input("Subagent tools (comma-separated)", "read, write, edit, bash");
          const saTools = saToolsInput ? saToolsInput.split(",").map((t: string) => t.trim()) : ["read", "write", "edit", "bash"];
          const saPrompt = await ctx.ui.input("Subagent system prompt", `You are ${saName}. ${saDesc}`);

          subagentLines.push(`    - name: ${saName}`);
          subagentLines.push(`      description: ${saDesc}`);
          if (saModel) subagentLines.push(`      default_model: ${saModel}`);
          subagentLines.push(`      tools: [${saTools.join(", ")}]`);
          if (saPrompt) subagentLines.push(`      system_prompt: "${saPrompt.replace(/"/g, "\"")}"`);

          const more = await ctx.ui.confirm("Subagents", "Add another subagent?");
          if (!more) adding = false;
        }
      }

      const systemPrompt = await ctx.ui.editor("System Prompt", `You are ${name}. ${description}`);

      const frontmatterLines = [
        "---",
        `name: ${name}`,
        `description: ${description}`,
        model ? `default_model: ${model}` : null,
        thinkingLevel ? `thinking_level: ${thinkingLevel}` : null,
        `tools: [${tools.join(", ")}]`,
        mcps.length > 0 ? `mcps: [${mcps.join(", ")}]` : null,
        subagentLines.length > 0 ? "subagents:" : null,
        ...subagentLines,
        "---",
      ].filter(Boolean);

      const content = `${frontmatterLines.join("\n")}\n\n${systemPrompt ?? `You are ${name}. ${description}`}\n`;

      const agentsDir = getAgentsDir(ctx.cwd);
      mkdirSync(agentsDir, { recursive: true });
      const filePath = join(agentsDir, `${name}.md`);

      if (existsSync(filePath)) {
        const overwrite = await ctx.ui.confirm("File exists", `Overwrite ${filePath}?`);
        if (!overwrite) return;
      }

      writeFileSync(filePath, content, "utf-8");
      ctx.ui.notify(`Agent "${name}" created at ${filePath}`, "info");
    },
  });
}
