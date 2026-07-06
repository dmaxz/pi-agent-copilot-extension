/**
 * TUI Model Selector with dynamic provider support.
 *
 * Queries the ModelRegistry for all available models and presents them
 * in a searchable selection dialog. On selection, switches the active model.
 */

import type { ExtensionAPI, ExtensionContext, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { Model } from "@earendil-works/pi-ai";

interface ModelDisplayEntry {
  label: string;
  model: Model<any>;
}

/**
 * Show a model selector and switch to the chosen model.
 */
export async function showModelSelector(
  pi: ExtensionAPI,
  ctx: ExtensionContext
): Promise<string | undefined> {
  const registry = ctx.modelRegistry;

  // Get all models that have auth configured
  const available = registry.getAvailable();
  if (available.length === 0) {
    ctx.ui.notify("No models with configured auth found. Add providers in .pi/copilot/providers.json", "warning");
    return undefined;
  }

  // Group models by provider for display
  const entries: ModelDisplayEntry[] = available.map((model) => {
    const providerDisplay = registry.getProviderDisplayName(model.provider);
    const reasoning = model.reasoning ? " [thinking]" : "";
    const current = ctx.model?.id === model.id ? " ●" : "";
    return {
      label: `${providerDisplay} / ${model.name}${reasoning}${current}`,
      model,
    };
  });

  // Sort: current model first, then by provider
  entries.sort((a, b) => {
    if (a.model.id === ctx.model?.id) return -1;
    if (b.model.id === ctx.model?.id) return 1;
    return a.label.localeCompare(b.label);
  });

  const labels = entries.map((e) => e.label);

  const choice = await ctx.ui.select("Select Model", labels);

  if (!choice) return undefined;

  const selected = entries.find((e) => e.label === choice);
  if (!selected) return undefined;

  const success = await pi.setModel(selected.model);
  if (success) {
    ctx.ui.notify(`Model: ${selected.model.name}`, "info");
    return selected.model.id;
  } else {
    ctx.ui.notify(`Failed to set model: ${selected.model.name} (no API key?)`, "error");
    return undefined;
  }
}

/**
 * Register the /model-selector command and keyboard shortcut.
 */
export function registerModelSelectorCommand(pi: ExtensionAPI): void {
  pi.registerCommand("model-selector", {
    description: "Open model selector (TUI modal)",
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      await showModelSelector(pi, ctx);
    },
  });

  // Register a keyboard shortcut: Ctrl+M
  pi.registerShortcut("ctrl+m", {
    description: "Open model selector",
    handler: async (ctx) => {
      await showModelSelector(pi, ctx);
    },
  });
}
