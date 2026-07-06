/**
 * Global mutable state tree for the Pi-Copilot Harness.
 *
 * All subsystems read/write through this singleton.
 * State is flushed to disk on session_shutdown.
 */

import type {
  ExecutionMode,
  ToolExecutionRecord,
  Workplan,
  AgentDefinition,
} from "./types.js";

export interface CopilotState {
  /** Current zero-trust execution mode. */
  executionMode: ExecutionMode;

  /** The active workplan, if orchestrator is engaged. */
  activeWorkplan: Workplan | null;

  /** All tool executions in this session. */
  toolHistory: ToolExecutionRecord[];

  /** Parsed agent definitions from .pi/agents/. */
  agentDefinitions: Map<string, AgentDefinition>;

  /** Pending workplan approval promise (resolved by HTTP POST). */
  workplanApproval: {
    resolve: (decision: { approved: boolean; notes?: string }) => void;
    reject: (err: Error) => void;
  } | null;

  /** Pending feedback promise (resolved by HTTP POST from summary page). */
  feedbackResolve: ((feedback: string) => void) | null;

  /** HTTP server port (randomized at startup). */
  httpPort: number;

  /** Whether the orchestrator is currently active. */
  orchestratorActive: boolean;
}

function createInitialState(): CopilotState {
  return {
    executionMode: "read_only",
    activeWorkplan: null,
    toolHistory: [],
    agentDefinitions: new Map(),
    workplanApproval: null,
    feedbackResolve: null,
    httpPort: 0,
    orchestratorActive: false,
  };
}

/** Singleton state. */
export const state: CopilotState = createInitialState();

/** Reset all mutable state (used on session_start). */
export function resetState(): void {
  state.activeWorkplan = null;
  state.toolHistory = [];
  state.workplanApproval = null;
  state.feedbackResolve = null;
  state.orchestratorActive = false;
}
