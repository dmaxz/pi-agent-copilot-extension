/**
 * Worker definitions for the Orchestrator.
 *
 * Each worker is a specialized subagent that handles a specific domain:
 * - Reader: reads and analyzes files
 * - Writer: creates or modifies files
 * - Executor: runs bash commands and MCP tools
 * - Crawler: web search and content fetching
 */

import type { WorkerRole } from "../core/types.js";

export interface WorkerConfig {
  role: WorkerRole;
  description: string;
  systemPromptPrefix: string;
  allowedTools: string[];
}

export const WORKER_CONFIGS: Record<WorkerRole, WorkerConfig> = {
  reader: {
    role: "reader",
    description: "Reads and analyzes files, returns structured content",
    systemPromptPrefix:
      "You are a Reader agent. Your job is to read files and extract relevant information. " +
      "Return concise, structured summaries. Do not modify any files.",
    allowedTools: ["read", "grep", "find", "ls"],
  },
  writer: {
    role: "writer",
    description: "Creates or modifies files based on specifications",
    systemPromptPrefix:
      "You are a Writer agent. Your job is to create or modify files. " +
      "Follow the specification exactly. Use edit for surgical changes, write for new files.",
    allowedTools: ["read", "write", "edit", "ls", "grep", "find"],
  },
  executor: {
    role: "executor",
    description: "Runs bash commands and MCP tools",
    systemPromptPrefix:
      "You are an Executor agent. Your job is to run bash commands and MCP tools. " +
      "Report exact stdout/stderr. Do not modify files unless instructed.",
    allowedTools: ["bash", "read", "ls"],
  },
  crawler: {
    role: "crawler",
    description: "Fetches web content and performs searches",
    systemPromptPrefix:
      "You are a Crawler agent. Your job is to search the web and extract content. " +
      "Return relevant URLs, code snippets, and documentation.",
    allowedTools: ["bash", "read"],
  },
};

