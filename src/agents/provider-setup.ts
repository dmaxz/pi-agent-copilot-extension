/**
 * /provider-setup — Interactive TUI wizard for global provider configuration.
 *
 * Walks the user through setting up a provider and writes to:
 * - ~/.pi/agent/auth.json (API key)
 * - ~/.pi/agent/settings.json (default provider + model)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

function getHome(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? "/root";
}

function getAuthPath(): string {
  return join(getHome(), ".pi", "agent", "auth.json");
}

function getSettingsPath(): string {
  return join(getHome(), ".pi", "agent", "settings.json");
}

function readJson(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, "utf-8")); } catch { return {}; }
}

function writeJson(path: string, data: Record<string, unknown>): void {
  const dir = path.substring(0, path.lastIndexOf("/"));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

const PROVIDER_PRESETS: Record<string, { baseUrl: string; api: string; envKey: string }> = {
  openai: { baseUrl: "https://api.openai.com/v1", api: "openai-responses", envKey: "OPENAI_API_KEY" },
  anthropic: { baseUrl: "https://api.anthropic.com", api: "anthropic-messages", envKey: "ANTHROPIC_API_KEY" },
  deepseek: { baseUrl: "https://api.deepseek.com/v1", api: "openai-completions", envKey: "DEEPSEEK_API_KEY" },
  google: { baseUrl: "https://generativelanguage.googleapis.com/v1beta", api: "openai-completions", envKey: "GEMINI_API_KEY" },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", api: "openai-completions", envKey: "OPENROUTER_API_KEY" },
  xai: { baseUrl: "https://api.x.ai/v1", api: "openai-completions", envKey: "XAI_API_KEY" },
  custom: { baseUrl: "", api: "openai-completions", envKey: "" },
};

export function registerProviderSetupCommand(pi: ExtensionAPI): void {
  pi.registerCommand("provider-setup", {
    description: "Interactive TUI wizard to configure provider (writes auth.json + settings.json)",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      // Step 1: Select provider
      const providerNames = Object.keys(PROVIDER_PRESETS);
      const providerChoice = await ctx.ui.select(
        "Select Provider",
        providerNames.map((p) => p === "custom" ? "  custom (OpenAI-compatible proxy)" : `  ${p}`),
        { timeout: 60000 }
      );
      if (!providerChoice) { ctx.ui.notify("Cancelled", "warning"); return; }

      const providerKey = providerChoice.trim();
      const preset = PROVIDER_PRESETS[providerKey];

      // Step 2: Base URL (for custom or override)
      let baseUrl = preset.baseUrl;
      if (providerKey === "custom") {
        const url = await ctx.ui.input("Base URL (e.g. https://my-proxy.com/v1)", "https://", { timeout: 60000 });
        if (!url) { ctx.ui.notify("Cancelled", "warning"); return; }
        baseUrl = url;
      } else {
        const useCustom = await ctx.ui.confirm("Override URL?", `Use ${preset.baseUrl}?`);
        if (!useCustom) {
          const url = await ctx.ui.input("Custom Base URL", preset.baseUrl, { timeout: 60000 });
          if (url) baseUrl = url;
        }
      }

      // Step 3: API key
      const apiKey = await ctx.ui.input("API Key", "", { timeout: 60000 });
      if (!apiKey) { ctx.ui.notify("Cancelled — no API key provided", "warning"); return; }

      // Step 4: API type
      const apiTypes = ["openai-completions", "openai-responses", "anthropic-messages"];
      const defaultApiIdx = apiTypes.indexOf(preset.api);
      const apiChoice = await ctx.ui.select(
        "API Type",
        apiTypes.map((t, i) => i === defaultApiIdx ? `=> ${t}` : `   ${t}`),
        { timeout: 60000 }
      );
      const apiType = apiChoice ? apiChoice.replace(/^[=> ]+/, "").trim() : preset.api;

      // Step 5: Model ID
      const modelId = await ctx.ui.input("Default Model ID (e.g. gpt-4o, claude-sonnet-4, mimo-bansos)", "", { timeout: 60000 });
      if (!modelId) { ctx.ui.notify("Cancelled — no model provided", "warning"); return; }

      // Step 6: Model display name
      const modelName = await ctx.ui.input("Model Display Name", modelId, { timeout: 60000 }) || modelId;

      // Step 7: Reasoning model?
      const isReasoning = await ctx.ui.confirm("Reasoning Model?", "Does this model support extended thinking?");

      // Step 8: Confirm and write
      const summary = [
        `Provider: ${providerKey === "custom" ? baseUrl : providerKey}`,
        `Base URL: ${baseUrl}`,
        `API Type: ${apiType}`,
        `Model: ${modelId} (${modelName})`,
        `Reasoning: ${isReasoning ? "yes" : "no"}`,
        `API Key: ${apiKey.slice(0, 8)}...`,
        "",
        `Auth file: ${getAuthPath()}`,
        `Settings: ${getSettingsPath()}`,
      ].join("\n");

      const confirmed = await ctx.ui.confirm("Save Configuration?", summary);
      if (!confirmed) { ctx.ui.notify("Cancelled", "warning"); return; }

      // Write auth.json
      const authEntry = providerKey === "custom" ? "openai" : providerKey;
      const auth = readJson(getAuthPath());
      auth[authEntry] = { type: "api_key", key: apiKey };
      writeJson(getAuthPath(), auth);

      // Write settings.json
      const settings = readJson(getSettingsPath());
      settings.defaultProvider = authEntry;
      settings.defaultModel = modelId;
      writeJson(getSettingsPath(), settings);

      // Also create .pi/copilot/providers.json if it's a custom proxy
      if (providerKey === "custom") {
        const providersConfig = [{
          name: "openai",
          displayName: modelName,
          baseUrl: baseUrl,
          apiKey: apiKey,
          api: apiType,
          models: [{
            id: modelId,
            name: modelName,
            reasoning: isReasoning,
            input: ["text"],
            contextWindow: 128000,
            maxTokens: 16384,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          }],
        }];
        const providersDir = join(ctx.cwd, ".pi", "copilot");
        mkdirSync(providersDir, { recursive: true });
        writeFileSync(join(providersDir, "providers.json"), JSON.stringify(providersConfig, null, 2) + "\n");
      }

      ctx.ui.notify("Configuration saved! Restart Pi to apply.", "info");
      ctx.ui.setStatus("copilot", `${providerKey}/${modelId}`);
    },
  });
}
