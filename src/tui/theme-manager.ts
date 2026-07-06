/**
 * Theme Manager - custom theme loading, switching, and registration.
 *
 * Provides:
 * - Auto-discovery of .json themes in project themes/ dir and ~/.pi/themes/
 * - /theme slash command for interactive switching
 * - resources_discover hook to register custom themes with Pi
 * - Runtime theme switching via ctx.ui.setTheme()
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";

/** Metadata for a discovered theme file. */
interface DiscoveredTheme {
  name: string;
  filePath: string;
  source: "project" | "user";
}

function getUserHome(): string {
  return process.env.HOME ?? process.env.USERPROFILE ?? "/root";
}

/**
 * Scan theme directories for .json files.
 * Priority: <cwd>/themes/ then ~/.pi/themes/
 */

/** Load a custom theme JSON file by name from the project themes/ dir. */
export function loadCustomTheme(cwd: string, name: string): string | undefined {
  const filePath = path.join(cwd, "themes", `${name}.json`);
  if (!fs.existsSync(filePath)) return undefined;
  return name;
}

export function discoverThemes(cwd: string): DiscoveredTheme[] {
  const discovered: DiscoveredTheme[] = [];
  const seen = new Set<string>();

  const dirs = [
    { dir: path.join(cwd, "themes"), source: "project" as const },
    { dir: path.join(getUserHome(), ".pi", "themes"), source: "user" as const },
  ];

  for (const { dir, source } of dirs) {
    if (!fs.existsSync(dir)) continue;
    let files: string[];
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    } catch {
      continue;
    }
    for (const file of files) {
      const name = path.basename(file, ".json");
      if (seen.has(name)) continue;
      seen.add(name);
      discovered.push({ name, filePath: path.join(dir, file), source });
    }
  }

  return discovered;
}

/**
 * Get theme file paths for resources_discover registration.
 */
export function getThemePaths(cwd: string): string[] {
  return discoverThemes(cwd).map((t) => t.filePath);
}

/**
 * Register the /theme slash command.
 * Uses ctx.ui.setTheme() for both built-in and custom themes.
 * Custom themes are registered via resources_discover, so Pi
 * can resolve them by name.
 */
export function registerThemeCommand(pi: ExtensionAPI): void {
  pi.registerCommand("theme", {
    description:
      "Switch TUI theme. Usage: /theme [name] or /theme list",
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const cwd = ctx.cwd;
      const arg = args.trim();

      // /theme list — show all available themes
      if (arg === "list" || arg === "ls") {
        const builtins = ctx.ui.getAllThemes();
        const custom = discoverThemes(cwd);
        const lines: string[] = ["Available themes:"];

        for (const t of builtins) {
          const marker = t.name === (ctx.ui.theme.name ?? "") ? " *" : "";
          lines.push(`  [builtin] ${t.name}${marker}`);
        }
        for (const t of custom) {
          const marker = t.name === (ctx.ui.theme.name ?? "") ? " *" : "";
          lines.push(`  [${t.source}] ${t.name}${marker}`);
        }

        lines.push("\n* = active");
        ctx.ui.notify(lines.join("\n"), "info");
        return;
      }

      // /theme <name> — switch to named theme
      if (arg) {
        const result = ctx.ui.setTheme(arg);
        if (result.success) {
          ctx.ui.notify(`Theme: ${arg}`, "info");
        } else {
          ctx.ui.notify(`Theme not found: ${arg}  (use /theme list)`, "error");
        }
        return;
      }

      // /theme (no args) — interactive selector
      const builtins = ctx.ui.getAllThemes();
      const custom = discoverThemes(cwd);
      const allNames = [
        ...builtins.map((t) => t.name),
        ...custom.map((t) => t.name),
      ];

      const currentName = ctx.ui.theme.name ?? "unknown";
      const choice = await ctx.ui.select(
        `Current theme: ${currentName}`,
        allNames.map((n) =>
          n === currentName ? `=> ${n}` : `   ${n}`
        ),
      );

      if (!choice) return;
      const selected = choice.replace(/^[=> ]+/, "").trim();

      const result = ctx.ui.setTheme(selected);
      if (result.success) {
        ctx.ui.notify(`Theme: ${selected}`, "info");
      } else {
        ctx.ui.notify(`Failed: ${result.error}`, "error");
      }
    },
  });
}
