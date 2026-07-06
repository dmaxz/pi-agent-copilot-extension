/**
 * HTML renderer for the post-action summary page.
 *
 * Shows: file diffs, command executions, tool call log, conclusion,
 * and a feedback form that injects back into the agent loop.
 */

import type { SessionSummary } from "../core/types.js";

export function renderSummaryPage(summary: SessionSummary): string {
  const toolRows = summary.toolExecutions
    .map(
      (t) => `
    <tr>
      <td><code class="tool-name">${escapeHtml(t.toolName)}</code></td>
      <td><pre class="args-pre">${escapeHtml(JSON.stringify(t.args, null, 2)).slice(0, 300)}</pre></td>
      <td class="${t.isError ? "error" : "success"}">${t.isError ? "❌ Error" : "✅ OK"}</td>
      <td>${t.durationMs ? t.durationMs + "ms" : "—"}</td>
    </tr>`
    )
    .join("\n");

  const diffBlocks = summary.fileDiffs
    .map(
      (d) => `
    <div class="diff-block">
      <h3>📄 ${escapeHtml(d.path)}</h3>
      <pre class="diff">${escapeHtml(d.diff)}</pre>
    </div>`
    )
    .join("\n");

  const cmdRows = summary.commandExecutions
    .map(
      (c) => `
    <tr>
      <td><code>${escapeHtml(c.command)}</code></td>
      <td>${escapeHtml(c.explanation)}</td>
      <td class="${c.exitCode !== 0 ? "error" : "success"}">${c.exitCode}</td>
    </tr>`
    )
    .join("\n");

  const workplanSummary = summary.workplan ? `
    <h2>Workplan</h2>
    <div class="workplan-block">
      <p><strong>Goal:</strong> ${escapeHtml(summary.workplan.goal)}</p>
      <p><strong>Status:</strong> ${summary.workplan.status}</p>
      <table>
        <thead><tr><th>Role</th><th>Description</th><th>Status</th></tr></thead>
        <tbody>
          ${summary.workplan.nodes.map(n => `
            <tr>
              <td><span class="badge badge-${n.role}">${n.role}</span></td>
              <td>${escapeHtml(n.description)}</td>
              <td>${n.status === "completed" ? "✅" : n.status === "failed" ? "❌" : "⏳"} ${n.status}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>` : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pi-Copilot Session Summary</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d1117; color: #c9d1d9; padding: 2rem; max-width: 1200px; margin: 0 auto; }
    h1 { color: #58a6ff; margin-bottom: 0.5rem; }
    h2 { color: #c9d1d9; margin: 1.5rem 0 0.5rem; border-bottom: 1px solid #21262d; padding-bottom: 0.5rem; }
    .goal { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1rem; margin: 1rem 0; line-height: 1.5; }
    .conclusion { background: #161b22; border: 1px solid #238636; border-radius: 8px; padding: 1rem; margin: 1rem 0; color: #3fb950; font-weight: 500; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { text-align: left; padding: 0.5rem; border-bottom: 1px solid #21262d; }
    th { color: #8b949e; font-weight: 600; font-size: 0.85rem; text-transform: uppercase; }
    pre { background: #0d1117; padding: 0.5rem; border-radius: 4px; font-size: 0.8rem; overflow-x: auto; max-height: 300px; }
    .args-pre { max-height: 100px; }
    .diff { color: #c9d1d9; white-space: pre-wrap; }
    .tool-name { background: #1f6feb33; padding: 2px 6px; border-radius: 3px; font-size: 0.85rem; }
    .error { color: #f85149; }
    .success { color: #3fb950; }
    .diff-block { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1rem; margin: 0.5rem 0; }
    .diff-block h3 { margin-bottom: 0.5rem; font-size: 0.95rem; }
    .workplan-block { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1rem; margin: 0.5rem 0; }
    .badge { padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; }
    .badge-reader { background: #1f6feb33; color: #58a6ff; }
    .badge-writer { background: #23863633; color: #3fb950; }
    .badge-executor { background: #9e6a0333; color: #d29922; }
    .badge-crawler { background: #8b5cf633; color: #bc8cff; }
    .stats { display: flex; gap: 1rem; margin: 1rem 0; flex-wrap: wrap; }
    .stat { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1rem; flex: 1; text-align: center; min-width: 100px; }
    .stat-num { font-size: 2rem; font-weight: 700; color: #58a6ff; }
    .stat-label { color: #8b949e; font-size: 0.8rem; }
    textarea { width: 100%; background: #0d1117; color: #c9d1d9; border: 1px solid #30363d; border-radius: 6px; padding: 0.75rem; font-size: 0.9rem; resize: vertical; min-height: 120px; margin-top: 0.5rem; font-family: inherit; }
    textarea:focus { outline: none; border-color: #58a6ff; }
    button { padding: 0.75rem 2rem; border: none; border-radius: 6px; font-size: 1rem; font-weight: 600; cursor: pointer; background: #238636; color: white; margin-top: 0.5rem; transition: all 0.2s; }
    button:hover { opacity: 0.85; transform: translateY(-1px); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .feedback-result { margin-top: 1rem; padding: 1rem; border-radius: 6px; display: none; }
  </style>
</head>
<body>
  <h1>📊 Session Summary</h1>
  <div class="goal">${escapeHtml(summary.goal)}</div>

  <div class="conclusion">${escapeHtml(summary.conclusion)}</div>

  <div class="stats">
    <div class="stat"><div class="stat-num">${summary.toolExecutions.length}</div><div class="stat-label">Tool Calls</div></div>
    <div class="stat"><div class="stat-num" style="color:${summary.toolExecutions.filter(t => t.isError).length > 0 ? '#f85149' : '#3fb950'}">${summary.toolExecutions.filter(t => t.isError).length}</div><div class="stat-label">Errors</div></div>
    <div class="stat"><div class="stat-num">${summary.fileDiffs.length}</div><div class="stat-label">Files Changed</div></div>
    <div class="stat"><div class="stat-num">${summary.commandExecutions.length}</div><div class="stat-label">Commands Run</div></div>
  </div>

  ${workplanSummary}

  <h2>File Changes</h2>
  ${diffBlocks || "<p style='color:#8b949e'>No file changes recorded</p>"}

  <h2>Command Executions</h2>
  ${cmdRows ? `<table><thead><tr><th>Command</th><th>Explanation</th><th>Exit Code</th></tr></thead><tbody>${cmdRows}</tbody></table>` : "<p style='color:#8b949e'>No commands executed</p>"}

  <h2>Tool Call Log</h2>
  <table>
    <thead><tr><th>Tool</th><th>Arguments</th><th>Status</th><th>Duration</th></tr></thead>
    <tbody>${toolRows || "<tr><td colspan='4' style='color:#8b949e'>No tool executions recorded</td></tr>"}</tbody>
  </table>

  <h2>💬 Feedback</h2>
  <p style="color:#8b949e;margin-bottom:0.5rem">Your feedback will be injected as a new prompt for the agent to act on.</p>
  <textarea id="feedback" placeholder="Suggest improvements, revisions, or next steps..."></textarea>
  <br>
  <button id="submitBtn" onclick="submitFeedback()">💬 Submit Feedback</button>
  <div id="feedbackResult" class="feedback-result"></div>

  <script>
    async function submitFeedback() {
      const textarea = document.getElementById('feedback');
      const btn = document.getElementById('submitBtn');
      const result = document.getElementById('feedbackResult');
      const feedback = textarea.value.trim();
      if (!feedback) return;

      btn.disabled = true;
      btn.textContent = 'Submitting...';

      try {
        const resp = await fetch('/summary/${summary.completedAt}/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ feedback })
        });
        if (resp.ok) {
          result.style.display = 'block';
          result.style.background = '#23863622';
          result.style.border = '1px solid #238636';
          result.style.color = '#3fb950';
          result.innerHTML = '✅ Feedback submitted — the agent will process your feedback next.';
          textarea.disabled = true;
          btn.textContent = '✅ Submitted';
        } else {
          throw new Error('Server returned ' + resp.status);
        }
      } catch (e) {
        btn.disabled = false;
        btn.textContent = '💬 Submit Feedback';
        result.style.display = 'block';
        result.style.background = '#da363322';
        result.style.border = '1px solid #da3633';
        result.style.color = '#f85149';
        result.innerHTML = '❌ Failed: ' + e.message;
      }
    }
  </script>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
