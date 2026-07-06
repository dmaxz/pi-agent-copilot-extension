/**
 * The Orchestrator — automated Project Manager.
 *
 * Decomposes a user prompt into a DAG of tasks, serves a workplan
 * approval page, then executes workers in dependency order with
 * parallel execution where the DAG permits.
 *
 * Each worker runs in an isolated Pi session via ctx.newSession(),
 * ensuring clean context separation and proper result capture.
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { CopilotState } from "../core/state.js";
import type { Workplan, DagNode, WorkerRole, WorkerResult } from "../core/types.js";
import { generateWorkplanId, generateNodeId, getReadyNodes, isWorkplanComplete, propagateFailures } from "./dag.js";
import { WORKER_CONFIGS } from "./workers.js";
import { waitForApproval } from "../http/server.js";

const MAX_RETRIES = 2;
const WORKER_TIMEOUT_MS = 180_000; // 3 minutes per worker

/**
 * Run the orchestrator on a user goal.
 */
export async function runOrchestrator(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  state: CopilotState,
  goal: string
): Promise<string> {
  state.orchestratorActive = true;

  try {
    // Phase 1: Decompose goal into tasks via heuristic analysis.
    ctx.ui.setStatus("orchestrator", "Decomposing goal...");
    const tasks = decomposeGoal(goal);

    // Phase 2: Build workplan DAG with dependencies.
    const workplan = buildWorkplan(goal, tasks);
    state.activeWorkplan = workplan;

    // Phase 3: Serve workplan for user approval via HTTP.
    ctx.ui.setStatus("orchestrator", "Awaiting approval...");
    const port = state.httpPort;

    if (port <= 0) {
      return "Error: HTTP server not started. Cannot serve workplan for approval.";
    }

    const approval = await waitForApproval(workplan, port);

    if (!approval.approved) {
      state.activeWorkplan = null;
      return "Workplan rejected by user." + (approval.notes ? ` Notes: ${approval.notes}` : "");
    }

    if (approval.notes) {
      workplan.userNotes = approval.notes;
    }

    workplan.status = "running";
    ctx.ui.setStatus("orchestrator", "Executing workplan...");

    // Phase 4: Execute workers in DAG order.
    // Independent nodes in the same layer execute sequentially (UI session constraint).
    // Dependencies are strictly enforced — a node only runs after all its deps complete.
    const allResults: WorkerResult[] = [];
    const maxIterations = workplan.nodes.length * 3; // safety bound
    let iteration = 0;

    while (!isWorkplanComplete(workplan) && iteration++ < maxIterations) {
      propagateFailures(workplan);
      const ready = getReadyNodes(workplan);

      if (ready.length === 0 && !isWorkplanComplete(workplan)) {
        // Deadlock — mark remaining pending as failed
        for (const node of workplan.nodes) {
          if (node.status === "pending") {
            node.status = "failed";
            node.error = "Deadlock: unresolvable dependency";
          }
        }
        break;
      }

      // Execute ready nodes one at a time (session UI constraint).
      // Each runs in its own isolated session.
      for (const node of ready) {
        ctx.ui.setStatus(`worker:${node.role}`, `${WORKER_CONFIGS[node.role].description}...`);

        const result = await executeNode(pi, ctx, state, node, goal);
        allResults.push(result);

        if (result.success) {
          node.status = "completed";
          node.result = result.output;
          node.completedAt = Date.now();
        } else {
          if ((node.retries ?? 0) < MAX_RETRIES) {
            node.status = "pending";
            node.retries = (node.retries ?? 0) + 1;
            node.error = undefined;
          } else {
            node.status = "failed";
            node.error = result.output;
            node.completedAt = Date.now();
          }
        }

        ctx.ui.setStatus(`worker:${node.role}`, undefined);
      }
    }

    workplan.status = isWorkplanComplete(workplan) ? "completed" : "failed";
    state.activeWorkplan = null;

    // Format results
    const lines: string[] = ["## Orchestrator Results\n"];
    for (const wr of allResults) {
      const status = wr.success ? "✅" : "❌";
      lines.push(`${status} [${wr.role}] ${wr.output.slice(0, 500)}`);
    }
    const failed = workplan.nodes.filter((n) => n.status === "failed");
    if (failed.length > 0) {
      lines.push(`\n⚠️ ${failed.length} task(s) failed:`);
      for (const n of failed) lines.push(`  - ${n.description}: ${n.error}`);
    }

    return lines.join("\n");
  } finally {
    state.orchestratorActive = false;
    ctx.ui.setStatus("orchestrator", undefined);
  }
}

/**
 * Decompose a goal into worker tasks using keyword analysis.
 */
function decomposeGoal(
  goal: string
): { role: WorkerRole; description: string; prompt: string; dependsOn?: number }[] {
  const tasks: { role: WorkerRole; description: string; prompt: string; dependsOn?: number }[] = [];
  const lower = goal.toLowerCase();

  // Phase 1: Always start with reading/analysis
  tasks.push({
    role: "reader",
    description: "Read and analyze relevant files in the codebase",
    prompt: `Analyze the codebase to gather context for: ${goal}. Identify relevant files, their structure, and key information needed. Return a structured summary.`,
  });

  // Phase 2: Web research if needed
  const needsWeb = lower.includes("search") || lower.includes("web") || lower.includes("fetch") ||
    lower.includes("download") || lower.includes("documentation") || lower.includes("npm") || lower.includes("package");
  if (needsWeb) {
    tasks.push({
      role: "crawler",
      description: "Search the web for relevant documentation or packages",
      prompt: `Search the web for information needed to accomplish: ${goal}. Find documentation, API references, or package information.`,
      dependsOn: 0,
    });
  }

  // Phase 3: Write/create/modify
  const needsWrite = lower.includes("create") || lower.includes("write") || lower.includes("modify") ||
    lower.includes("edit") || lower.includes("implement") || lower.includes("build") || lower.includes("add") ||
    lower.includes("fix") || lower.includes("update") || lower.includes("refactor");
  if (needsWrite) {
    const readDep = 0;
    const webDep = needsWeb ? 1 : undefined;
    tasks.push({
      role: "writer",
      description: "Create or modify files based on analysis",
      prompt: `Based on the analysis, create or modify files to accomplish: ${goal}`,
      dependsOn: webDep ?? readDep,
    });
  }

  // Phase 4: Execute/test
  const needsExec = lower.includes("run") || lower.includes("test") || lower.includes("build") ||
    lower.includes("install") || lower.includes("execute") || lower.includes("deploy") || lower.includes("start");
  if (needsExec) {
    const writeDep = needsWrite ? tasks.length - 1 : (needsWeb ? 1 : 0);
    tasks.push({
      role: "executor",
      description: "Run necessary commands, tests, or builds",
      prompt: `Run commands to verify and accomplish: ${goal}`,
      dependsOn: writeDep,
    });
  }

  // Fallback
  if (tasks.length === 1) {
    tasks.push({
      role: "writer",
      description: "Implement the requested changes",
      prompt: `Implement: ${goal}`,
      dependsOn: 0,
    });
  }

  return tasks;
}

/**
 * Build a Workplan DAG from decomposed tasks.
 */
function buildWorkplan(
  goal: string,
  tasks: { role: WorkerRole; description: string; prompt: string; dependsOn?: number }[]
): Workplan {
  const nodes: DagNode[] = tasks.map((task) => ({
    id: generateNodeId(),
    role: task.role,
    description: task.description,
    prompt: task.prompt,
    dependencies: [],
    status: "pending" as const,
  }));

  // Wire dependencies by index reference
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]!;
    if (task.dependsOn !== undefined && task.dependsOn < nodes.length) {
      nodes[i]!.dependencies = [nodes[task.dependsOn]!.id];
    }
  }

  return {
    id: generateWorkplanId(),
    goal,
    nodes,
    createdAt: Date.now(),
    status: "pending_approval",
  };
}

/**
 * Execute a single DAG node by spawning an isolated Pi session.
 *
 * Uses ctx.newSession() with a withSession callback to:
 * 1. Create a fresh session with no prior context
 * 2. Send the worker prompt as a user message
 * 3. Wait for the agent to finish processing
 * 4. Extract the last assistant message as the result
 */
async function executeNode(
  _pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  state: CopilotState,
  node: DagNode,
  goal: string
): Promise<WorkerResult> {
  node.status = "running";
  node.startedAt = Date.now();

  const config = WORKER_CONFIGS[node.role];
  const startMs = Date.now();
  let capturedOutput = "";

  try {
    // Build a self-contained prompt for the worker
    const workerPrompt = [
      `[ORCHESTRATOR TASK: ${node.description}]`,
      `[WORKER ROLE: ${node.role}]`,
      `[ALLOWED TOOLS: ${config.allowedTools.join(", ")}]`,
      "",
      node.prompt,
      "",
      `Original goal: ${goal}`,
      state.activeWorkplan?.userNotes ? `\nUser notes: ${state.activeWorkplan.userNotes}` : "",
    ].filter(Boolean).join("\n");

    // Create an isolated session for this worker
    const { cancelled } = await ctx.newSession({
      withSession: async (sessionCtx) => {
        // Send the worker prompt — triggers a full agent turn
        await sessionCtx.sendUserMessage(workerPrompt);

        // Wait for the agent to finish processing all tool calls
        await sessionCtx.waitForIdle();

        // Extract the result from the session entries
        try {
          const entries = sessionCtx.sessionManager.getEntries();

          // Walk entries in reverse to find the last assistant message
          for (let i = entries.length - 1; i >= 0; i--) {
            const entry = entries[i]!;
            if (entry.type !== "message") continue;
            const msg = (entry as any).message;
            if (!msg || msg.role !== "assistant") continue;

            const msgContent = msg.content;
            if (typeof msgContent === "string") {
              capturedOutput = msgContent;
            } else if (Array.isArray(msgContent)) {
              const textParts = msgContent
                .filter((c: any) => c.type === "text")
                .map((c: any) => c.text);
              capturedOutput = textParts.join("\n");
            }
            break;
          }
        } catch {
          capturedOutput = `[${node.role}] Task completed but result extraction failed`;
        }
      },
    });

    if (cancelled) {
      return {
        role: node.role,
        nodeId: node.id,
        success: false,
        output: "Worker session was cancelled by user",
        toolCalls: [],
        durationMs: Date.now() - startMs,
      };
    }

    return {
      role: node.role,
      nodeId: node.id,
      success: true,
      output: capturedOutput || `[${node.role}] Task completed: ${node.description}`,
      toolCalls: [],
      durationMs: Date.now() - startMs,
    };
  } catch (err) {
    return {
      role: node.role,
      nodeId: node.id,
      success: false,
      output: err instanceof Error ? err.message : String(err),
      toolCalls: [],
      durationMs: Date.now() - startMs,
    };
  }
}
