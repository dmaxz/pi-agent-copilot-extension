/**
 * Zero-trust execution mode definitions and heuristics.
 */

import type { ExecutionMode } from "../core/types.js";

/** Patterns that indicate destructive bash commands. */
const DESTRUCTIVE_PATTERNS: RegExp[] = [
  /\brm\s+(-[rfR]*\s+)*/i,
  /\bmv\s+.*\//i,
  /\bdrop\s+(table|database|index)/i,
  /\bsudo\b/i,
  /\bdd\s+if=/i,
  /\biptables\b/i,
  /\bchmod\s+777/i,
  /\bmkfs\b/i,
  /\bformat\b/i,
  /\bkill\s+-9/i,
  /\bpkill\b/i,
  /\bsystemctl\s+(stop|disable|mask)/i,
  /\breboot\b/i,
  /\bshutdown\b/i,
];

/** Patterns that indicate network calls (potential data exfiltration). */
const NETWORK_PATTERNS: RegExp[] = [
  /\bcurl\b/i,
  /\bwget\b/i,
  /\bssh\b/i,
  /\bscp\b/i,
  /\brsync\b.*:/i,
  /\bnc\s+-/i,
  /\bnetcat\b/i,
];

/**
 * Classify a bash command for read_only mode.
 * Returns true if the command should be intercepted.
 */
export function isDangerousBashCommand(command: string): boolean {
  for (const pattern of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(command)) return true;
  }
  for (const pattern of NETWORK_PATTERNS) {
    if (pattern.test(command)) return true;
  }
  return false;
}

/**
 * Classify a bash command for execute mode.
 * Returns true only for highly destructive commands.
 */
export function isHighlyDestructive(command: string): boolean {
  const severe: RegExp[] = [
    /\bsudo\b/i,
    /\bdd\s+if=/i,
    /\biptables\b/i,
    /\bmkfs\b/i,
    /\bformat\b/i,
    /\breboot\b/i,
    /\bshutdown\b/i,
    /\bchmod\s+777/i,
  ];
  for (const pattern of severe) {
    if (pattern.test(command)) return true;
  }
  return false;
}

/** Human-readable reason for why a command was flagged. */
export function explainDanger(command: string): string {
  const reasons: string[] = [];

  for (const p of DESTRUCTIVE_PATTERNS) {
    if (p.test(command)) {
      reasons.push(`Matches destructive pattern: ${p.source}`);
    }
  }
  for (const p of NETWORK_PATTERNS) {
    if (p.test(command)) {
      reasons.push(`Matches network pattern: ${p.source}`);
    }
  }

  return reasons.join("; ") || "Command flagged by security policy";
}
