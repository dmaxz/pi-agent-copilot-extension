/**
 * /copilot — Provider setup and management command.
 *
 * Subcommands:
 *   /copilot              Show status
 *   /copilot setup        Configure server URL and API key via TUI
 *   /copilot sync         Fetch models from /v1/models and register
 *   /copilot models       Browse available models
 *   /copilot test <model> Smoke-test a model
 *   /copilot config       Show config paths
 *   /copilot help         Show help
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

// ─── Types ─────────────────────────────────────────────────────────────────

interface CopilotConfig {
  serverUrl: string;
  apiKey: string;
  providerName: string;
}

interface DiscoveredModel {
  id: string;
  name: string;
  reasoning: boolean;
  input: string[];
  contextWindow: number;
  maxTokens: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const PROVIDER_API = "openai-completions";
const DEFAULT_CONFIG: CopilotConfig = {
  serverUrl: "https://ai.afterbluesoft.com/v1",
  apiKey: "",
  providerName: "openai",
};

function getConfigPath(cwd: string): string {
  return join(cwd, ".pi", "copilot", "config.json");
}

function getGlobalConfigPath(): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "/root";
  return join(home, ".pi", "agent", "copilot-config.json");
}

// ─── Config I/O ────────────────────────────────────────────────────────────

function sanitize(input: Partial<CopilotConfig>): CopilotConfig {
  let url = (input.serverUrl ?? DEFAULT_CONFIG.serverUrl).trim().replace(/\/+$/, "");
  if (url.endsWith("/v1")) url = url.slice(0, -3);
  return {
    serverUrl: url || DEFAULT_CONFIG.serverUrl,
    apiKey: String(input.apiKey ?? ""),
    providerName: String(input.providerName ?? DEFAULT_CONFIG.providerName).trim() || DEFAULT_CONFIG.providerName,
  };
}

function loadConfig(cwd: string): CopilotConfig {
  // Env vars override file
  const env: Partial<CopilotConfig> = {};
  if (process.env.COPILOT_SERVER_URL) env.serverUrl = process.env.COPILOT_SERVER_URL;
  if (process.env.COPILOT_API_KEY) env.apiKey = process.env.COPILOT_API_KEY;

  // Try project-local first, then global
  for (const path of [getConfigPath(cwd), getGlobalConfigPath()]) {
    try {
      return sanitize({ ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(path, "utf8")), ...env });
    } catch {}
  }
  return sanitize({ ...DEFAULT_CONFIG, ...env });
}

function saveConfig(cwd: string, config: CopilotConfig, global = false): void {
  const path = global ? getGlobalConfigPath() : getConfigPath(cwd);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(sanitize(config), null, 2) + "\n");
}

// ─── HTTP ──────────────────────────────────────────────────────────────────

function authHeaders(config: CopilotConfig): Record<string, string> {
  return config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {};
}

async function checkHealth(config: CopilotConfig): Promise<boolean> {
  try {
    const res = await fetch(`${config.serverUrl}/v1/models`, {
      headers: authHeaders(config),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function discoverModels(config: CopilotConfig): Promise<DiscoveredModel[]> {
  const res = await fetch(`${config.serverUrl}/v1/models`, {
    headers: authHeaders(config),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
  const data = await res.json() as any;
  const raw: any[] = Array.isArray(data?.data) ? data.data : [];

  return raw
    .filter((m: any) => {
      const id = typeof m === "string" ? m : m?.id;
      return !!id;
    })
    .map((m: any) => ({
      id: typeof m === "string" ? m : m.id,
      name: m.name ?? (typeof m === "string" ? m : m.id),
      reasoning: !!(m.reasoning || m.capabilities?.reasoning || m.capabilities?.thinking),
      input: Array.isArray(m.input_modalities) ? m.input_modalities.map(String) : ["text"],
      contextWindow: m.context_length || m.max_input_tokens || 128000,
      maxTokens: m.max_output_tokens || m.max_tokens || 16384,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

async function testChat(config: CopilotConfig, model: string): Promise<string> {
  const res = await fetch(`${config.serverUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(config) },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with exactly: ok" }],
      stream: false,
      max_tokens: 8,
    }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json() as any;
  return data?.choices?.[0]?.message?.content?.trim() ?? JSON.stringify(data).slice(0, 200);
}

// ─── Display ───────────────────────────────────────────────────────────────

function statusText(config: CopilotConfig, healthy: boolean, modelCount: number): string {
  return [
    "Pi-Copilot Status",
    "",
    `Server:   ${config.serverUrl}`,
    `Provider: ${config.providerName}`,
    `Health:   ${healthy ? "reachable" : "unreachable"}`,
    `Models:   ${modelCount}`,
    `Config:   ${existsSync(getConfigPath(".")) ? "project" : existsSync(getGlobalConfigPath()) ? "global" : "none"}`,
  ].join("\n");
}

function helpText(): string {
  return [
    "Pi-Copilot commands",
    "",
    "/copilot              Show status",
    "/copilot setup        Configure server URL and API key",
    "/copilot sync         Fetch models from proxy and register",
    "/copilot models       Browse available models",
    "/copilot test <model> Smoke-test a model",
    "/copilot config       Show config paths",
    "/copilot help         Show this help",
  ].join("\n");
}

// ─── Registration ──────────────────────────────────────────────────────────

let cachedModels: DiscoveredModel[] = [];

async function syncProvider(pi: ExtensionAPI, config: CopilotConfig): Promise<number> {
  cachedModels = await discoverModels(config);
  pi.registerProvider(config.providerName, {
    name: config.providerName,
    baseUrl: `${config.serverUrl}/v1`,
    apiKey: config.apiKey || "none",
    api: PROVIDER_API,
    authHeader: true,
    models: cachedModels.map((m) => ({
      id: m.id,
      name: m.name,
      reasoning: m.reasoning,
      input: m.input as ("text" | "image")[],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: m.contextWindow,
      maxTokens: m.maxTokens,
    })),
  });
  return cachedModels.length;
}

// ─── Command ───────────────────────────────────────────────────────────────

export function registerCopilotCommand(pi: ExtensionAPI): void {
  pi.registerCommand("copilot", {
    description: "Pi-Copilot: /copilot [setup|sync|models|test|config|help]",
    getArgumentCompletions(prefix: string) {
      return ["setup", "sync", "models", "test", "config", "help"]
        .filter((v) => v.startsWith(prefix))
        .map((v) => ({ value: v, label: v }));
    },
    async handler(args: string, ctx: ExtensionCommandContext) {
      const [subRaw, ...rest] = args.trim().split(/\s+/).filter(Boolean);
      const sub = subRaw?.toLowerCase() ?? "";
      const cwd = ctx.cwd || process.cwd();
      let config = loadConfig(cwd);

      try {
        // No subcommand — show status
        if (!sub) {
          const healthy = await checkHealth(config);
          ctx.ui.notify(statusText(config, healthy, cachedModels.length), healthy ? "info" : "warning");
          return;
        }

        if (sub === "help") {
          ctx.ui.notify(helpText(), "info");
          return;
        }

        // ── setup ──
        if (sub === "setup") {
          const serverUrl = await ctx.ui.input("Server URL (e.g. https://ai.afterbluesoft.com/v1)", config.serverUrl);
          if (serverUrl === undefined) return;

          const apiKey = await ctx.ui.input(
            "API Key",
            config.apiKey ? "(press enter to keep current)" : "(optional)"
          );
          if (apiKey === undefined) return;

          const providerName = await ctx.ui.input("Provider name", config.providerName);
          if (providerName === undefined) return;

          const next = sanitize({
            serverUrl,
            apiKey: (apiKey && !apiKey.startsWith("(")) ? apiKey : config.apiKey,
            providerName: providerName || config.providerName,
          });

          // Check health
          const healthy = await checkHealth(next);
          if (!healthy) {
            ctx.ui.notify(`Cannot reach ${next.serverUrl}/v1/models. Check URL and try again.`, "error");
            return;
          }

          // Ask where to save
          const saveChoice = await ctx.ui.select("Save config to", [
            "  Project (.pi/copilot/config.json)",
            "  Global (~/.pi/agent/copilot-config.json)",
          ]);
          const isGlobal = saveChoice?.includes("Global") ?? false;
          saveConfig(ctx.cwd || process.cwd(), next, isGlobal);

          // Sync models
          const count = await syncProvider(pi, next);
          ctx.ui.notify(`Saved. Synced ${count} model(s). Restart Pi to use them.`, "info");
          ctx.ui.setStatus("copilot", `${next.providerName} (${count} models)`);
          return;
        }

        // ── sync ──
        if (sub === "sync") {
          const count = await syncProvider(pi, config);
          ctx.ui.notify(`Synced ${count} model(s) from ${config.serverUrl}`, "info");
          ctx.ui.setStatus("copilot", `${config.providerName} (${count} models)`);
          return;
        }

        // ── models ──
        if (sub === "models") {
          const query = rest.join(" ").toLowerCase();
          let models = cachedModels;
          if (models.length === 0) {
            ctx.ui.notify("No models synced yet. Run /copilot sync first.", "warning");
            return;
          }
          if (query) models = models.filter((m) => `${m.id} ${m.name}`.toLowerCase().includes(query));
          const lines = models.slice(0, 50).map((m) => {
            const tags = [m.reasoning ? "reasoning" : "", m.input.includes("image") ? "vision" : ""].filter(Boolean);
            return `  ${m.id}${tags.length ? ` [${tags.join(", ")}]` : ""}`;
          });
          if (models.length > 50) lines.push(`  ... ${models.length} total`);
          ctx.ui.notify([`Models (${models.length})`, "", ...lines].join("\n"), "info");
          return;
        }

        // ── test ──
        if (sub === "test") {
          const model = rest.join(" ");
          if (!model) {
            ctx.ui.notify("Usage: /copilot test <model>", "warning");
            return;
          }
          ctx.ui.notify(`Testing ${model}...`, "info");
          const result = await testChat(config, model);
          ctx.ui.notify(`Test ${model}: ${result}`, "info");
          return;
        }

        // ── config ──
        if (sub === "config") {
          ctx.ui.notify(
            [
              `Project config: ${getConfigPath(cwd)}`,
              `Global config:  ${getGlobalConfigPath()}`,
              `Project exists: ${existsSync(getConfigPath(cwd))}`,
              `Global exists:  ${existsSync(getGlobalConfigPath())}`,
              `Server:         ${config.serverUrl}`,
              `Provider:       ${config.providerName}`,
              `API Key:        ${config.apiKey ? config.apiKey.slice(0, 8) + "..." : "(not set)"}`,
            ].join("\n"),
            "info"
          );
          return;
        }

        ctx.ui.notify(`Unknown command '/copilot ${sub}'.\n\n${helpText()}`, "warning");
      } catch (error) {
        ctx.ui.notify(`Error: ${(error as Error).message}`, "error");
      }
    },
  });
}
