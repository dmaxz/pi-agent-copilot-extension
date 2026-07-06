/**
 * Zero-trust tool_call interceptor.
 *
 * Hooks into pi.on("tool_call") to gate tool execution based on
 * the current ExecutionMode.
 */

import type { ExtensionAPI, ExtensionContext, ToolCallEvent, ToolCallEventResult } from "@earendil-works/pi-coding-agent";
import type { CopilotState } from "../core/state.js";
import { isDangerousBashCommand, isHighlyDestructive, explainDanger } from "./modes.js";

/**
 * Register the tool_call interceptor on the extension API.
 */
export function registerToolInterceptor(pi: ExtensionAPI, state: CopilotState): void {
  pi.on("tool_call", async (event: ToolCallEvent, ctx: ExtensionContext): Promise<ToolCallEventResult | void> => {
    const mode = state.executionMode;

    // Bypass: allow everything.
    if (mode === "bypass") return;

    // Strict: intercept ALL tools, demand confirmation.
    if (mode === "strict") {
      const argsStr = JSON.stringify(event.input, null, 2).slice(0, 500);
      const confirmed = await ctx.ui.confirm(
        `[Strict] Tool: ${event.toolName}`,
        `Allow execution of ${event.toolName}?\nArgs: ${argsStr}`
      );
      if (!confirmed) {
        return { block: true, reason: "Blocked by user (strict mode)" };
      }
      return;
    }

    // read_only: allow read/write/edit/grep/find/ls, intercept bash and dangerous ops.
    if (mode === "read_only") {
      const safeTools = ["read", "write", "edit", "grep", "find", "ls"];
      if (!safeTools.includes(event.toolName)) {
        // Non-safe tool — check if bash with dangerous command
        if (event.toolName === "bash") {
          const command = (event.input as Record<string, unknown>)?.command ?? "";
          if (typeof command === "string" && isDangerousBashCommand(command)) {
            const explanation = explainDanger(command);
            const confirmed = await ctx.ui.confirm(
              `[Read-Only] Dangerous command detected`,
              `Command: ${command}\n\nReason: ${explanation}\n\nAllow execution?`
            );
            if (!confirmed) {
              return { block: true, reason: `Blocked: ${explanation}` };
            }
          }
        }
        // Also intercept destructive file operations
        if (event.toolName === "bash") {
          const cmd = String((event.input as Record<string, unknown>)?.command ?? "");
          if (/\brm\b|\bmv\b.*\//.test(cmd)) {
            const confirmed = await ctx.ui.confirm(
              `[Read-Only] File operation intercepted`,
              `Command: ${cmd}\nThis modifies the filesystem. Allow?`
            );
            if (!confirmed) {
              return { block: true, reason: "Blocked: destructive file operation in read_only mode" };
            }
          }
        }
      }
      return;
    }

    // execute: allow most things, intercept highly destructive bash.
    if (mode === "execute") {
      if (event.toolName === "bash") {
        const command = (event.input as Record<string, unknown>)?.command ?? "";
        if (typeof command === "string" && isHighlyDestructive(command)) {
          const confirmed = await ctx.ui.confirm(
            `[Execute] Highly destructive command`,
            `Command: ${command}\n\nThis command is flagged as highly destructive. Allow?`
          );
          if (!confirmed) {
            return { block: true, reason: "Blocked: highly destructive command" };
          }
        }
      }
      return;
    }
  });
}
