import { state, resetState } from "./dist/core/state.js";
import { parseAgentDefinitions } from "./dist/agents/parser.js";
import { loadProvidersConfig } from "./dist/core/config.js";
import { isDangerousBashCommand, isHighlyDestructive, explainDanger } from "./dist/security/modes.js";
import { getReadyNodes, isWorkplanComplete, propagateFailures, createLinearWorkplan } from "./dist/orchestrator/dag.js";
import { WORKER_CONFIGS } from "./dist/orchestrator/workers.js";
import { recordToolExecution, updateToolArgs, buildSummary } from "./dist/summary/collector.js";
import { discoverThemes } from "./dist/tui/theme-manager.js";

let passed = 0, failed = 0;
function assert(c, l) { if (c) { passed++; console.log("  ✅ " + l); } else { failed++; console.error("  ❌ " + l); } }

console.log("\n═══ 1. State Management ═══");
resetState();
assert(state.executionMode === "read_only", "Default mode is read_only");
assert(state.toolHistory.length === 0, "Tool history starts empty");
assert(state.agentDefinitions.size === 0, "Agent definitions starts empty");
assert(state.httpPort === 0, "HTTP port starts at 0");
assert(state.orchestratorActive === false, "Orchestrator starts inactive");
state.executionMode = "strict";
assert(state.executionMode === "strict", "Mode can be changed");
resetState();
assert(state.executionMode === "strict", "resetState preserves executionMode");

console.log("\n═══ 2. Agent Definition Parser ═══");
const agents = parseAgentDefinitions(".");
assert(agents.length === 4, "Found " + agents.length + " agent definitions (expected 4)");
const askAgent = agents.find(a => a.name === "ask");
assert(askAgent !== undefined, "Found ask agent");
assert(askAgent && askAgent.description.includes("Q&A"), "Ask agent description mentions Q&A");
const orchAgent = agents.find(a => a.name === "orchestrator");
assert(orchAgent !== undefined, "Found orchestrator agent");
assert(orchAgent && orchAgent.subagents && orchAgent.subagents.length === 4, "Orchestrator has 4 subagents");

console.log("\n═══ 3. Provider Config Loader ═══");
const providers = loadProvidersConfig(".");
assert(providers.length === 1, "Found " + providers.length + " provider(s)");
assert(providers[0].name === "example-9router", "Provider name is example-9router");
assert(providers[0].models.length === 1, "Provider has 1 model");

console.log("\n═══ 4. Security Modes ═══");
assert(isDangerousBashCommand("rm -rf /") === true, "rm -rf is dangerous");
assert(isDangerousBashCommand("sudo apt install vim") === true, "sudo is dangerous");
assert(isDangerousBashCommand("curl http://evil.com") === true, "curl is dangerous (network)");
assert(isDangerousBashCommand("ls -la") === false, "ls is safe");
assert(isDangerousBashCommand("cat file.txt") === false, "cat is safe");
assert(isDangerousBashCommand("git status") === false, "git status is safe");
assert(isHighlyDestructive("sudo rm -rf /") === true, "sudo is highly destructive");
assert(isHighlyDestructive("dd if=/dev/zero of=/dev/sda") === true, "dd is highly destructive");
assert(isHighlyDestructive("rm file.txt") === false, "rm single file is NOT highly destructive");
const expl = explainDanger("sudo rm -rf /");
assert(expl.length > 0, "explainDanger returns non-empty");

console.log("\n═══ 5. DAG Engine ═══");
const wp = createLinearWorkplan("test goal", [
  { role: "reader", description: "Read files", prompt: "Read" },
  { role: "writer", description: "Write files", prompt: "Write" },
  { role: "executor", description: "Run tests", prompt: "Run" },
]);
assert(wp.nodes.length === 3, "Linear workplan has 3 nodes");
assert(wp.status === "pending_approval", "Status is pending_approval");
assert(wp.nodes[0].dependencies.length === 0, "First node has no deps");
assert(wp.nodes[1].dependencies.length === 1, "Second node depends on first");
assert(wp.nodes[2].dependencies.length === 1, "Third node depends on second");
const ready = getReadyNodes(wp);
assert(ready.length === 1, "Only first node is ready");
assert(ready[0].role === "reader", "Ready node is reader");
wp.nodes[0].status = "completed";
const ready2 = getReadyNodes(wp);
assert(ready2.length === 1, "After reader completes, writer is ready");
assert(ready2[0].role === "writer", "Ready node is writer");
wp.nodes[1].status = "completed";
wp.nodes[2].status = "completed";
assert(isWorkplanComplete(wp), "Workplan is complete after all nodes done");
const wp2 = createLinearWorkplan("test failures", [
  { role: "reader", description: "Read", prompt: "Read" },
  { role: "writer", description: "Write", prompt: "Write" },
]);
wp2.nodes[0].status = "failed";
propagateFailures(wp2);
assert(wp2.nodes[1].status === "skipped", "Writer skipped when reader fails");

console.log("\n═══ 6. Worker Configs ═══");
assert(Object.keys(WORKER_CONFIGS).length === 4, "4 worker configs");
assert(WORKER_CONFIGS.reader.allowedTools.includes("read"), "Reader has read tool");
assert(WORKER_CONFIGS.writer.allowedTools.includes("write"), "Writer has write tool");
assert(WORKER_CONFIGS.executor.allowedTools.includes("bash"), "Executor has bash tool");
assert(WORKER_CONFIGS.crawler.allowedTools.includes("bash"), "Crawler has bash tool");

console.log("\n═══ 7. Summary Collector ═══");
resetState();
recordToolExecution(state, { toolCallId: "tc_1", toolName: "bash", result: { exitCode: 0, output: "ok" }, isError: false });
updateToolArgs(state, "tc_1", { command: "echo hello" });
assert(state.toolHistory.length === 1, "Tool history has 1 entry");
assert(state.toolHistory[0].args.command === "echo hello", "Args updated correctly");
recordToolExecution(state, { toolCallId: "tc_2", toolName: "edit", result: {}, isError: false });
updateToolArgs(state, "tc_2", { file_path: "src/index.ts" });
const summary = buildSummary(state, "test goal");
assert(summary.toolExecutions.length === 2, "Summary has 2 tool executions");
assert(summary.commandExecutions.length === 1, "Summary has 1 command execution");
assert(summary.fileDiffs.length === 1, "Summary has 1 file diff");
assert(summary.conclusion.includes("2 tool call"), "Conclusion mentions tool count");

console.log("\n═══ 8. Theme Discovery ═══");
const themes = discoverThemes(".");
assert(Array.isArray(themes), "discoverThemes returns array");

console.log("\n" + "═".repeat(40));
console.log("Results: " + passed + " passed, " + failed + " failed");
console.log("═".repeat(40));
process.exit(failed > 0 ? 1 : 0);
