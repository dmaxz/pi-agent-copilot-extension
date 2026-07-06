/**
 * Shared type definitions for the Pi-Copilot Harness.
 */

/** Execution security modes for zero-trust tool gating. */
export type ExecutionMode = "strict" | "read_only" | "execute" | "bypass";

/** Orchestrator worker roles. */
export type WorkerRole = "reader" | "writer" | "executor" | "crawler";

/** DAG node status. */
export type DagNodeStatus = "pending" | "ready" | "running" | "completed" | "failed" | "skipped";

/** A single node in the orchestrator's DAG. */
export interface DagNode {
  id: string;
  role: WorkerRole;
  description: string;
  prompt: string;
  dependencies: string[];
  status: DagNodeStatus;
  result?: string;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  retries?: number;
}

/** The full workplan DAG. */
export interface Workplan {
  id: string;
  goal: string;
  nodes: DagNode[];
  createdAt: number;
  status: "pending_approval" | "approved" | "rejected" | "running" | "completed" | "failed";
  userNotes?: string;
}

/** Agent definition parsed from markdown frontmatter. */
export interface AgentDefinition {
  name: string;
  description: string;
  defaultModel?: string;
  thinkingLevel?: string;
  tools?: string[];
  mcps?: string[];
  systemPrompt: string;
  filePath: string;
  subagents?: SubagentDefinition[];
}

/** Subagent definition nested within an agent. */
export interface SubagentDefinition {
  name: string;
  description: string;
  defaultModel?: string;
  tools?: string[];
  mcps?: string[];
  systemPrompt: string;
}

/** Provider configuration from providers.json. */
export interface ProviderEntry {
  name: string;
  displayName?: string;
  baseUrl: string;
  apiKey: string;
  api: "openai-completions" | "openai-responses" | "anthropic-messages";
  models: ProviderModelEntry[];
  headers?: Record<string, string>;
  authHeader?: boolean;
}

export interface ProviderModelEntry {
  id: string;
  name: string;
  reasoning: boolean;
  input: ("text" | "image")[];
  contextWindow: number;
  maxTokens: number;
  cost?: { input: number; output: number; cacheRead: number; cacheWrite: number };
}

/** Recorded tool execution for post-action summary. */
export interface ToolExecutionRecord {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  isError: boolean;
  timestamp: number;
  durationMs?: number;
  agentSource?: string;
}

/** Summary data for the final web page. */
export interface SessionSummary {
  goal: string;
  workplan: Workplan | null;
  toolExecutions: ToolExecutionRecord[];
  fileDiffs: { path: string; diff: string }[];
  commandExecutions: { command: string; explanation: string; exitCode: number }[];
  conclusion: string;
  completedAt: number;
}

/** Worker execution result. */
export interface WorkerResult {
  role: WorkerRole;
  nodeId: string;
  success: boolean;
  output: string;
  toolCalls: { toolName: string; args: Record<string, unknown>; result: string }[];
  durationMs: number;
}
