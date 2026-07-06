/**
 * Agent definition parser.
 *
 * Reads Markdown files with YAML frontmatter from .pi/agents/.
 * Supports nested subagent definitions.
 *
 * Schema:
 *   ---
 *   name: my-agent
 *   description: Does something useful
 *   default_model: anthropic/claude-sonnet-4-20250514
 *   thinking_level: medium
 *   tools: [read, write, edit, bash]
 *   mcps: [filesystem, github]
 *   subagents:
 *     - name: my-subagent
 *       description: Helper agent
 *       tools: [read, bash]
 *   ---
 *   System prompt content goes here...
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import matter from "gray-matter";
import type { AgentDefinition, SubagentDefinition } from "../core/types.js";
import { getAgentsDir } from "../core/config.js";

/**
 * Parse all .md agent definitions from the agents directory.
 */
export function parseAgentDefinitions(cwd: string): AgentDefinition[] {
  const agentsDir = getAgentsDir(cwd);
  if (!existsSync(agentsDir)) return [];

  const entries = readdirSync(agentsDir, { withFileTypes: true });
  const definitions: AgentDefinition[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || extname(entry.name) !== ".md") continue;

    const filePath = join(agentsDir, entry.name);
    const raw = readFileSync(filePath, "utf-8");

    try {
      const { data, content } = matter(raw);

      if (!data.name) continue;

      // Parse subagents if present
      const subagents: SubagentDefinition[] | undefined = Array.isArray(data.subagents)
        ? data.subagents.map((sa: any) => ({
            name: sa.name ?? "unnamed",
            description: sa.description ?? "",
            defaultModel: sa.default_model ?? sa.defaultModel,
            tools: Array.isArray(sa.tools) ? sa.tools : undefined,
            mcps: Array.isArray(sa.mcps) ? sa.mcps : undefined,
            systemPrompt: sa.system_prompt ?? sa.systemPrompt ?? "",
          }))
        : undefined;

      definitions.push({
        name: data.name as string,
        description: (data.description as string) ?? "",
        defaultModel: data.default_model as string | undefined,
        thinkingLevel: data.thinking_level as string | undefined,
        tools: Array.isArray(data.tools) ? (data.tools as string[]) : undefined,
        mcps: Array.isArray(data.mcps) ? (data.mcps as string[]) : undefined,
        systemPrompt: content.trim(),
        filePath,
        subagents,
      });
    } catch {
      // Skip unparseable files.
    }
  }

  return definitions;
}
