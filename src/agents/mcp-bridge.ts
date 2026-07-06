/**
 * MCP Client Bridge.
 *
 * Dynamically binds MCP server tool declarations to pi.registerTool(),
 * translating JSON-RPC execution payloads to MCP tool calls.
 */

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getConfigDir } from "../core/config.js";

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface McpToolDeclaration {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface McpJsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: Record<string, unknown>;
}

interface McpJsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

const NL = String.fromCharCode(10);

export async function bridgeMcpServers(pi: ExtensionAPI, cwd: string): Promise<number> {
  const configPath = join(getConfigDir(cwd), "mcp.json");
  if (!existsSync(configPath)) return 0;

  let config: { servers?: Record<string, McpServerConfig> };
  try {
    config = JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return 0;
  }

  if (!config.servers) return 0;
  let registered = 0;

  for (const [serverName, serverConfig] of Object.entries(config.servers)) {
    try {
      const tools = await discoverMcpTools(serverConfig);
      for (const tool of tools) {
        const qualifiedName = `mcp_${serverName}_${tool.name}`;
        pi.registerTool({
          name: qualifiedName,
          label: `MCP: ${serverName}/${tool.name}`,
          description: tool.description ?? `MCP tool ${tool.name} from ${serverName}`,
          parameters: tool.inputSchema ? (Type.Unknown() as any) : Type.Object({}),
          async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
            const result = await callMcpTool(serverConfig, tool.name, params as Record<string, unknown>);
            return {
              content: [{ type: "text" as const, text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
              details: result,
            };
          },
        });
        registered++;
      }
    } catch { /* skip */ }
  }

  return registered;
}

async function discoverMcpTools(config: McpServerConfig): Promise<McpToolDeclaration[]> {
  return new Promise((resolve, _reject) => {
    const proc = spawn(config.command, config.args ?? [], {
      env: { ...process.env, ...config.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) { settled = true; proc.kill(); resolve([]); }
    }, 10000);

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      const lines = stdout.split(NL).filter(Boolean);
      for (const line of lines) {
        try {
          const msg = JSON.parse(line) as McpJsonRpcResponse;
          if (msg.result && typeof msg.result === "object" && "tools" in (msg.result as any)) {
            settled = true; clearTimeout(timer); proc.kill();
            resolve((msg.result as any).tools as McpToolDeclaration[]);
            return;
          }
        } catch { /* not valid JSON yet */ }
      }
    });

    proc.on("error", () => { if (!settled) { settled = true; clearTimeout(timer); resolve([]); } });
    proc.on("exit", () => { if (!settled) { settled = true; clearTimeout(timer); resolve([]); } });

    const initMsg: McpJsonRpcRequest = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "pi-copilot", version: "0.1.0" } } };
    const listMsg: McpJsonRpcRequest = { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} };
    proc.stdin.write(JSON.stringify(initMsg) + NL);
    proc.stdin.write(JSON.stringify(listMsg) + NL);
  });
}

async function callMcpTool(config: McpServerConfig, toolName: string, args: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, _reject) => {
    const proc = spawn(config.command, config.args ?? [], {
      env: { ...process.env, ...config.env },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) { settled = true; proc.kill(); resolve("MCP tool call timed out"); }
    }, 30000);

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
      const lines = stdout.split(NL).filter(Boolean);
      for (const line of lines) {
        try {
          const msg = JSON.parse(line) as McpJsonRpcResponse;
          if (msg.result !== undefined || msg.error) {
            settled = true; clearTimeout(timer); proc.kill();
            if (msg.error) { resolve(`MCP error: ${msg.error.message}`); }
            else { resolve(msg.result); }
            return;
          }
        } catch { /* not valid JSON yet */ }
      }
    });

    proc.on("error", () => { if (!settled) { settled = true; clearTimeout(timer); resolve("MCP process error"); } });
    proc.on("exit", () => { if (!settled) { settled = true; clearTimeout(timer); resolve("MCP process exited unexpectedly"); } });

    const initMsg: McpJsonRpcRequest = { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "pi-copilot", version: "0.1.0" } } };
    const callMsg: McpJsonRpcRequest = { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: toolName, arguments: args } };
    proc.stdin.write(JSON.stringify(initMsg) + NL);
    proc.stdin.write(JSON.stringify(callMsg) + NL);
  });
}
