import { resolve } from "node:path";
import { DEFAULT_CONFIDENCE } from "./types.js";

export const BASE_DIR = ".mission-control";
export const TICKETS_DIR = `${BASE_DIR}/tickets`;
export const INDEX_FILE = `${BASE_DIR}/index.json`;

export const ID_PREFIX = "MC";
export const ID_DATE_FORMAT = "yyyy-MM-dd";

export const CONFIDENCE = DEFAULT_CONFIDENCE;

export const COMMANDS = {
  NEW: "ticket new",
  LIST: "ticket list",
  SHOW: "ticket show",
  UPDATE: "ticket update",
  CLOSE: "ticket close",
  DELETE: "ticket delete",
  LINK_PLAN: "ticket link-plan",
  IMPORT: "ticket import",
} as const;

export const AUTO_CAPTURE_INFERENCE_PROMPT = `You are a task detection system. Analyze the following conversation and detect any tasks or work items that should be tracked.

Return a JSON object with:
- "detected": boolean (true if any task found)
- "tasks": array of objects with:
  - "title": string (concise task title)
  - "description": string (optional, more detail)
  - "confidence": number (0.0 to 1.0, how sure you are this is a real task)

Rules:
- Only detect explicit or clearly implied tasks
- Skip vague intentions or questions
- Confidence >= 0.7: clearly a task
- Confidence 0.5-0.7: likely a task but ambiguous
- Confidence < 0.5: skip this

Conversation:
{conversation}
`;

export const SESSION_INJECTION_TEMPLATE = `=== MISSION CONTROL ACTIVE TICKETS ===
{active_tickets}
=== {count} active ticket(s) ===

{has_in_progress ? 'In progress: ' + in_progress_titles : 'No tickets in progress'}
`;

export function getProjectRoot(cwd: string): string {
  return cwd;
}

export function getTicketsDir(cwd: string): string {
  return resolve(cwd, TICKETS_DIR);
}

export function getIndexPath(cwd: string): string {
  return resolve(cwd, INDEX_FILE);
}

export function getTicketPath(cwd: string, ticketId: string): string {
  return resolve(cwd, TICKETS_DIR, `${ticketId}.json`);
}
