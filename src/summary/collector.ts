/**
 * Post-action summary collector.
 *
 * Maintains the global state tree of all tool_execution_end payloads
 * and assembles the final SessionSummary for the web page.
 */

import type { CopilotState } from "../core/state.js";
import type { SessionSummary, ToolExecutionRecord, Workplan } from "../core/types.js";
import { waitForFeedback } from "../http/server.js";

/** Record a tool execution from the tool_execution_end event. */
export function recordToolExecution(state: CopilotState, event: {
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError: boolean;
}): void {
  state.toolHistory.push({
    toolCallId: event.toolCallId,
    toolName: event.toolName,
    args: {}, // Args come from tool_execution_start
    result: event.result,
    isError: event.isError,
    timestamp: Date.now(),
  });
}

/** Update args for a tool execution from tool_execution_start. */
export function updateToolArgs(state: CopilotState, toolCallId: string, args: unknown): void {
  const record = state.toolHistory.find((r) => r.toolCallId === toolCallId);
  if (record) {
    record.args = args as Record<string, unknown>;
  }
}

/** Build a SessionSummary from the current state. */
export function buildSummary(state: CopilotState, goal: string): SessionSummary {
  return {
    goal,
    workplan: state.activeWorkplan,
    toolExecutions: [...state.toolHistory],
    fileDiffs: extractDiffs(state),
    commandExecutions: extractCommands(state),
    conclusion: buildConclusion(state),
    completedAt: Date.now(),
  };
}

/** Extract file diffs from tool execution records. */
function extractDiffs(state: CopilotState): { path: string; diff: string }[] {
  const diffs: { path: string; diff: string }[] = [];

  for (const record of state.toolHistory) {
    if (record.toolName === "edit") {
      const details = record.result as Record<string, unknown> | undefined;
      const diff = (details as any)?.details?.diff ?? (details as any)?.diff;
      const filePath = (record.args as Record<string, unknown>)?.file_path ?? "unknown";
      diffs.push({
        path: String(filePath),
        diff: typeof diff === "string" ? diff : `[edit] ${String(filePath)}`,
      });
    }
    if (record.toolName === "write") {
      const filePath = (record.args as Record<string, unknown>)?.file_path;
      if (filePath) {
        diffs.push({
          path: String(filePath),
          diff: `[Full write] ${String(filePath)}`,
        });
      }
    }
  }

  return diffs;
}

/** Extract command executions from tool execution records. */
function extractCommands(state: CopilotState): { command: string; explanation: string; exitCode: number }[] {
  const commands: { command: string; explanation: string; exitCode: number }[] = [];

  for (const record of state.toolHistory) {
    if (record.toolName === "bash") {
      const command = String((record.args as Record<string, unknown>)?.command ?? "");
      if (!command) continue;
      const details = record.result as Record<string, unknown> | undefined;
      const exitCode = typeof (details as any)?.exitCode === "number" ? (details as any).exitCode : (record.isError ? 1 : 0);
      commands.push({
        command,
        explanation: record.isError ? "Command failed" : "Command executed successfully",
        exitCode,
      });
    }
  }

  return commands;
}

/** Build a conclusion string from the state. */
function buildConclusion(state: CopilotState): string {
  const total = state.toolHistory.length;
  const errors = state.toolHistory.filter((r) => r.isError).length;
  const files = new Set(state.toolHistory.filter((r) => r.toolName === "edit" || r.toolName === "write").map((r) => String((r.args as Record<string, unknown>)?.file_path ?? ""))).size;

  const parts: string[] = [];
  parts.push(`Executed ${total} tool call(s)`);
  if (errors > 0) parts.push(`${errors} error(s)`);
  if (files > 0) parts.push(`${files} file(s) modified`);
  if (state.activeWorkplan) {
    const completed = state.activeWorkplan.nodes.filter((n) => n.status === "completed").length;
    parts.push(`${completed}/${state.activeWorkplan.nodes.length} tasks completed`);
  }
  return parts.join(". ") + ".";
}

/**
 * Serve summary and inject feedback into the agent loop.
 */
export async function serveSummaryAndFeedback(
  state: CopilotState,
  goal: string,
  port: number,
  sendUserMessage: (content: string) => void
): Promise<void> {
  const summary = buildSummary(state, goal);
  const feedback = await waitForFeedback(summary, port);

  if (feedback) {
    sendUserMessage(`[User Feedback] ${feedback}`);
  }
}
