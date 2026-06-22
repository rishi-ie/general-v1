import type { SACConfig } from "./types";

let config: SACConfig["memoryQuestionDetection"] = {
  enabled: true,
  patterns: [],
};

function log(msg: string, data?: Record<string, unknown>): void {
  console.log(`[sac] ${msg}`, data ?? {});
}

export function initMemoryQuestionRouter(cfg: SACConfig["memoryQuestionDetection"]): void {
  config = cfg;
}

export function isMemoryQuestion(input: string): boolean {
  if (!config.enabled) return false;

  const lower = input.toLowerCase().trim();

  for (const pattern of config.patterns) {
    if (lower.includes(pattern.toLowerCase())) {
      log("memory question detected", { pattern, input: input.slice(0, 50) });
      return true;
    }
  }

  return false;
}

export function extractMemoryQuestionDetails(input: string): {
  type: string;
  subject: string;
} | null {
  const lower = input.toLowerCase().trim();

  if (lower.includes("why did we decide")) {
    return { type: "decision_reasoning", subject: extractSubject(lower, "why did we decide") };
  }
  if (lower.includes("what happened")) {
    return { type: "event_history", subject: extractSubject(lower, "what happened") };
  }
  if (lower.includes("what were we working on")) {
    return { type: "project_history", subject: extractSubject(lower, "what were we working on") };
  }
  if (lower.includes("what changed")) {
    return { type: "change_history", subject: extractSubject(lower, "what changed") };
  }
  if (lower.includes("what are our active goals")) {
    return { type: "active_goals", subject: "" };
  }
  if (lower.includes("who is")) {
    return { type: "relationship", subject: extractSubject(lower, "who is") };
  }
  if (lower.includes("when did we")) {
    return { type: "temporal", subject: extractSubject(lower, "when did we") };
  }
  if (lower.includes("what is the history of")) {
    return { type: "lineage", subject: extractSubject(lower, "what is the history of") };
  }

  return null;
}

function extractSubject(lower: string, prefix: string): string {
  const idx = lower.indexOf(prefix);
  if (idx < 0) return "";
  const after = lower.slice(idx + prefix.length).trim();
  const endChars = [".", "?", "!"];
  let endIdx = after.length;
  for (const char of endChars) {
    const pos = after.indexOf(char);
    if (pos > 0 && pos < endIdx) endIdx = pos;
  }
  return after.slice(0, endIdx).trim();
}
