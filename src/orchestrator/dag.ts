/**
 * DAG (Directed Acyclic Graph) engine for task orchestration.
 *
 * Manages dependency resolution, parallel execution scheduling,
 * and state transitions for orchestrator workplans.
 */

import type { DagNode, Workplan, WorkerRole } from "../core/types.js";

let nextId = 1;
export function generateWorkplanId(): string {
  return `wp_${Date.now()}_${nextId++}`;
}

export function generateNodeId(): string {
  return `node_${Date.now()}_${nextId++}`;
}

/**
 * Determine which nodes are ready to execute (all dependencies completed).
 */
export function getReadyNodes(workplan: Workplan): DagNode[] {
  return workplan.nodes.filter((node) => {
    if (node.status !== "pending") return false;
    return node.dependencies.every((depId) => {
      const dep = workplan.nodes.find((n) => n.id === depId);
      return dep?.status === "completed";
    });
  });
}

/**
 * Check if all nodes are complete (or failed).
 */
export function isWorkplanComplete(workplan: Workplan): boolean {
  return workplan.nodes.every((n) => n.status === "completed" || n.status === "failed" || n.status === "skipped");
}

/**
 * Mark nodes whose dependencies failed as skipped.
 */
export function propagateFailures(workplan: Workplan): void {
  for (const node of workplan.nodes) {
    if (node.status !== "pending") continue;
    const hasFailedDep = node.dependencies.some((depId) => {
      const dep = workplan.nodes.find((n) => n.id === depId);
      return dep?.status === "failed";
    });
    if (hasFailedDep) {
      node.status = "skipped";
    }
  }
}

/**
 * Create a simple linear workplan from a goal decomposition.
 */
export function createLinearWorkplan(goal: string, steps: { role: WorkerRole; description: string; prompt: string }[]): Workplan {
  const nodes: DagNode[] = [];
  let prevId: string | null = null;

  for (const step of steps) {
    const id = generateNodeId();
    nodes.push({
      id,
      role: step.role,
      description: step.description,
      prompt: step.prompt,
      dependencies: prevId ? [prevId] : [],
      status: "pending",
    });
    prevId = id;
  }

  return {
    id: generateWorkplanId(),
    goal,
    nodes,
    createdAt: Date.now(),
    status: "pending_approval",
  };
}

