/**
 * HTML renderer for the workplan approval page.
 *
 * Renders a DAG visualization with task cards, dependency arrows,
 * approve/reject buttons, and a notes field.
 */

import type { Workplan } from "../core/types.js";

export function renderWorkplanPage(workplan: Workplan): string {
  const nodesHtml = workplan.nodes
    .map(
      (node) => {
        const depLabels = node.dependencies
          .map((depId) => {
            const dep = workplan.nodes.find((n) => n.id === depId);
            return dep ? `${dep.role}: ${dep.description.slice(0, 40)}` : depId;
          });
        const statusIcon = {
          pending: "⏳", ready: "🟢", running: "🔄",
          completed: "✅", failed: "❌", skipped: "⏭️",
        }[node.status] ?? "⏳";

        return `
    <div class="node node-${node.status}" id="node-${node.id}">
      <div class="node-header">
        <span class="badge badge-${node.role}">${node.role}</span>
        <span class="node-status">${statusIcon} ${node.status}</span>
      </div>
      <div class="node-desc">${escapeHtml(node.description)}</div>
      <details class="node-details">
        <summary>Task Prompt</summary>
        <pre>${escapeHtml(node.prompt)}</pre>
      </details>
      ${depLabels.length > 0 ? `<div class="deps">⬅ Depends on: ${depLabels.map(l => escapeHtml(l)).join(", ")}</div>` : ""}
    </div>`;
      }
    )
    .join("\n");

  const taskCounts = {
    reader: workplan.nodes.filter(n => n.role === "reader").length,
    writer: workplan.nodes.filter(n => n.role === "writer").length,
    executor: workplan.nodes.filter(n => n.role === "executor").length,
    crawler: workplan.nodes.filter(n => n.role === "crawler").length,
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pi-Copilot Workplan</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; padding: 2rem; max-width: 1000px; margin: 0 auto; }
    h1 { color: #58a6ff; margin-bottom: 0.5rem; }
    .goal { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1rem; margin: 1rem 0; font-size: 1.1rem; line-height: 1.5; }
    .stats { display: flex; gap: 1rem; margin: 1rem 0; flex-wrap: wrap; }
    .stat { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 0.75rem 1rem; text-align: center; min-width: 80px; }
    .stat-num { font-size: 1.5rem; font-weight: 700; }
    .stat-label { color: #8b949e; font-size: 0.75rem; text-transform: uppercase; }
    .nodes { display: flex; flex-direction: column; gap: 1rem; margin: 1.5rem 0; }
    .node { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1rem; transition: border-color 0.2s; }
    .node:hover { border-color: #58a6ff; }
    .node-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
    .badge { padding: 2px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .badge-reader { background: #1f6feb33; color: #58a6ff; }
    .badge-writer { background: #23863633; color: #3fb950; }
    .badge-executor { background: #9e6a0333; color: #d29922; }
    .badge-crawler { background: #8b5cf633; color: #bc8cff; }
    .node-status { font-size: 0.85rem; color: #8b949e; }
    .node-desc { font-weight: 500; margin-bottom: 0.5rem; }
    .node-details summary { cursor: pointer; color: #58a6ff; font-size: 0.85rem; margin-bottom: 0.5rem; }
    .node-details pre { background: #0d1117; padding: 0.75rem; border-radius: 4px; font-size: 0.8rem; overflow-x: auto; white-space: pre-wrap; margin-top: 0.5rem; }
    .deps { color: #8b949e; font-size: 0.8rem; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #21262d; }
    .actions { display: flex; gap: 1rem; margin-top: 1.5rem; align-items: flex-start; flex-wrap: wrap; }
    textarea { width: 100%; background: #0d1117; color: #c9d1d9; border: 1px solid #30363d; border-radius: 6px; padding: 0.75rem; font-size: 0.9rem; resize: vertical; min-height: 80px; margin-top: 1rem; font-family: inherit; }
    textarea:focus { outline: none; border-color: #58a6ff; }
    button { padding: 0.75rem 2rem; border: none; border-radius: 6px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    button:hover { opacity: 0.85; transform: translateY(-1px); }
    .btn-approve { background: #238636; color: white; }
    .btn-reject { background: #da3633; color: white; }
    .submitted { text-align: center; padding: 3rem; }
    .submitted h1 { font-size: 2rem; }
  </style>
</head>
<body>
  <h1>📋 Workplan Approval</h1>
  <div class="goal">${escapeHtml(workplan.goal)}</div>

  <div class="stats">
    <div class="stat"><div class="stat-num">${workplan.nodes.length}</div><div class="stat-label">Tasks</div></div>
    <div class="stat"><div class="stat-num" style="color:#58a6ff">${taskCounts.reader}</div><div class="stat-label">Reader</div></div>
    <div class="stat"><div class="stat-num" style="color:#3fb950">${taskCounts.writer}</div><div class="stat-label">Writer</div></div>
    <div class="stat"><div class="stat-num" style="color:#d29922">${taskCounts.executor}</div><div class="stat-label">Executor</div></div>
    <div class="stat"><div class="stat-num" style="color:#bc8cff">${taskCounts.crawler}</div><div class="stat-label">Crawler</div></div>
  </div>

  <h2>Tasks</h2>
  <div class="nodes">${nodesHtml}</div>

  <h2>Decision</h2>
  <textarea id="notes" placeholder="Add notes or modifications (optional)..."></textarea>

  <div class="actions">
    <button class="btn-approve" onclick="submit(true)">✅ Approve & Execute</button>
    <button class="btn-reject" onclick="submit(false)">❌ Reject</button>
  </div>

  <script>
    async function submit(approved) {
      const notes = document.getElementById('notes').value;
      const btns = document.querySelectorAll('button');
      btns.forEach(b => b.disabled = true);
      try {
        const resp = await fetch('/workplan/${workplan.id}/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approved, notes })
        });
        if (resp.ok) {
          document.body.innerHTML = approved
            ? '<div class="submitted"><h1>✅ Approved</h1><p>Workplan is now executing. You can close this tab.</p></div>'
            : '<div class="submitted"><h1>❌ Rejected</h1><p>Workplan has been rejected. You can close this tab.</p></div>';
        }
      } catch (e) {
        btns.forEach(b => b.disabled = false);
        alert('Failed to submit: ' + e.message);
      }
    }
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
