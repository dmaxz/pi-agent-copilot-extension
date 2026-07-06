/**
 * Configuration loader for providers.json and agent definitions.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ProviderEntry } from "./types.js";

/** Resolve the pi-copilot config directory. */
export function getConfigDir(cwd: string): string {
  return resolve(cwd, ".pi", "copilot");
}

/** Load providers.json from the config directory. */
export function loadProvidersConfig(cwd: string): ProviderEntry[] {
  const configPath = join(getConfigDir(cwd), "providers.json");
  if (!existsSync(configPath)) return [];

  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ProviderEntry[];
  } catch {
    return [];
  }
}

/** Get the agents directory path. */
export function getAgentsDir(cwd: string): string {
  return resolve(cwd, ".pi", "agents");
}
