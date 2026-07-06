/**
 * HTTP server for workplan approval and post-action summary.
 *
 * Serves on a random high port. Two endpoints:
 * - GET /workplan/:id — workplan approval page
 * - POST /workplan/:id/approve — user approves/rejects workplan
 * - GET /summary/:id — post-action summary page
 * - POST /summary/:id/feedback — user feedback injection
 */

import express from "express";
import type { Server } from "node:http";
import type { Workplan, SessionSummary } from "../core/types.js";
import { renderWorkplanPage } from "./workplan-page.js";
import { renderSummaryPage } from "./summary-page.js";

let server: Server | null = null;
const approvalCallbacks = new Map<string, (decision: { approved: boolean; notes?: string }) => void>();
const feedbackCallbacks = new Map<string, (feedback: string) => void>();

/**
 * Find a free port in the high range.
 */
async function findFreePort(): Promise<number> {
  const { createServer } = await import("node:net");
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

/**
 * Start the HTTP server. Returns the port number.
 */
export async function startHttpServer(): Promise<number> {
  if (server) {
    const addr = server.address();
    if (typeof addr === "object" && addr) return addr.port;
  }

  const port = await findFreePort();
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Workplan approval page
  app.get("/workplan/:id", (req, res) => {
    const workplan = activeWorkplans.get(req.params.id);
    if (!workplan) { res.status(404).send("Workplan not found"); return; }
    res.type("html").send(renderWorkplanPage(workplan));
  });

  // Workplan approval endpoint
  app.post("/workplan/:id/approve", (req, res) => {
    const callback = approvalCallbacks.get(req.params.id);
    if (!callback) { res.status(404).send("Workplan not found or already processed"); return; }
    const { approved, notes } = req.body;
    callback({ approved: !!approved, notes });
    approvalCallbacks.delete(req.params.id);
    res.json({ ok: true });
  });

  // Summary page
  app.get("/summary/:id", (req, res) => {
    const summary = activeSummaries.get(req.params.id);
    if (!summary) { res.status(404).send("Summary not found"); return; }
    res.type("html").send(renderSummaryPage(summary));
  });

  // Feedback endpoint
  app.post("/summary/:id/feedback", (req, res) => {
    const callback = feedbackCallbacks.get(req.params.id);
    if (!callback) { res.status(404).send("Summary not found or feedback not accepted"); return; }
    const { feedback } = req.body;
    if (feedback && typeof feedback === "string") {
      callback(feedback);
      feedbackCallbacks.delete(req.params.id);
    }
    res.json({ ok: true });
  });

  return new Promise((resolve) => {
    server = app.listen(port, "127.0.0.1", () => {
      resolve(port);
    });
  });
}

/** Stop the HTTP server. */
export function stopHttpServer(): void {
  if (server) {
    server.close();
    server = null;
  }
  approvalCallbacks.clear();
  feedbackCallbacks.clear();
}

// ─── Workplan Approval ───

const activeWorkplans = new Map<string, Workplan>();

/**
 * Serve workplan and wait for user approval.
 */
export function waitForApproval(
  workplan: Workplan,
  port: number
): Promise<{ approved: boolean; notes?: string }> {
  activeWorkplans.set(workplan.id, workplan);
  const url = `http://127.0.0.1:${port}/workplan/${workplan.id}`;

  return new Promise((resolve, reject) => {
    approvalCallbacks.set(workplan.id, (decision) => {
      activeWorkplans.delete(workplan.id);
      resolve(decision);
    });

    console.log(`\n📋 Workplan ready for review: ${url}\n`);

    setTimeout(() => {
      if (approvalCallbacks.has(workplan.id)) {
        approvalCallbacks.delete(workplan.id);
        activeWorkplans.delete(workplan.id);
        reject(new Error("Workplan approval timed out after 5 minutes"));
      }
    }, 300_000);
  });
}

// ─── Summary Feedback ───

const activeSummaries = new Map<string, SessionSummary>();

/**
 * Serve summary and wait for user feedback.
 */
export function waitForFeedback(
  summary: SessionSummary,
  port: number
): Promise<string | null> {
  const id = `summary_${Date.now()}`;
  activeSummaries.set(id, summary);
  const url = `http://127.0.0.1:${port}/summary/${id}`;

  return new Promise((resolve) => {
    feedbackCallbacks.set(id, (feedback) => {
      activeSummaries.delete(id);
      resolve(feedback);
    });

    console.log(`\n📊 Session summary: ${url}\n`);

    setTimeout(() => {
      if (feedbackCallbacks.has(id)) {
        feedbackCallbacks.delete(id);
        activeSummaries.delete(id);
        resolve(null);
      }
    }, 180_000);
  });
}
