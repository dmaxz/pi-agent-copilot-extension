/**
 * Dynamic provider injection from providers.json.
 *
 * Reads the local config and calls pi.registerProvider() for each entry
 * during session_start.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadProvidersConfig } from "../core/config.js";
import type { ProviderEntry } from "../core/types.js";

/**
 * Inject all providers from .pi/copilot/providers.json into the pi runtime.
 */
export function injectProviders(pi: ExtensionAPI, cwd: string): number {
  const entries = loadProvidersConfig(cwd);
  let injected = 0;

  for (const entry of entries) {
    try {
      const apiKey = interpolateEnvVars(entry.apiKey);
      pi.registerProvider(entry.name, {
        name: entry.displayName ?? entry.name,
        baseUrl: entry.baseUrl,
        apiKey,
        api: entry.api,
        models: entry.models.map((m) => ({
          id: m.id,
          name: m.name,
          reasoning: m.reasoning,
          input: m.input,
          cost: m.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: m.contextWindow,
          maxTokens: m.maxTokens,
        })),
        headers: entry.headers,
        authHeader: entry.authHeader ?? true,
      });
      injected++;
    } catch {
      // Provider registration failure is non-fatal.
    }
  }

  return injected;
}

/**
 * Interpolate environment variable references in the form $VAR or ${VAR}.
 */
function interpolateEnvVars(value: string): string {
  return value.replace(/\$\{?(\w+)\}?/g, (_, varName: string) => process.env[varName] ?? "");
}
