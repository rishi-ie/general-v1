import type { Mem0Memory } from "./types";

let mem0Client: unknown = null;
let enabled = false;

function log(msg: string, data?: Record<string, unknown>): void {
  console.log(`[sac] ${msg}`, data ?? {});
}

export async function initMem0Bridge(): Promise<void> {
  try {
    const mem0Module = await import("@mem0/pi-agent-plugin");
    mem0Client = mem0Module;
    enabled = true;
    log("mem0 bridge initialized");
  } catch (err) {
    log("mem0 not available, semantic memory disabled", { error: String(err) });
    enabled = false;
  }
}

export async function addMemory(sessionId: string, messages: Array<{ role: string; content: string }>): Promise<void> {
  if (!enabled || !mem0Client) return;

  try {
    const client = mem0Client as {
      add?: (opts: { user_id: string; messages: Array<{ role: string; content: string }> }) => Promise<unknown>;
    };
    if (client.add) {
      await client.add({ user_id: sessionId, messages });
      log("memory added", { session_id: sessionId, message_count: messages.length });
    }
  } catch (err) {
    log("mem0 add error", { error: String(err) });
  }
}

export async function searchMemories(sessionId: string, query: string, topK = 10): Promise<Mem0Memory[]> {
  if (!enabled || !mem0Client) return [];

  try {
    const client = mem0Client as {
      search?: (opts: { query: string; user_id: string; top_k?: number }) => Promise<{
        results?: Array<{ id?: string; text?: string; metadata?: Record<string, unknown>; created_at?: string }>;
      }>;
    };
    if (client.search) {
      const result = await client.search({ query, user_id: sessionId, top_k: topK });
      const memories: Mem0Memory[] = (result.results ?? []).map((r) => ({
        id: r.id ?? "",
        text: r.text ?? "",
        metadata: r.metadata,
        created_at: r.created_at,
      }));
      log("memories searched", { query, results: memories.length });
      return memories;
    }
  } catch (err) {
    log("mem0 search error", { error: String(err) });
  }
  return [];
}

export async function getRecentMemories(sessionId: string, limit = 20): Promise<Mem0Memory[]> {
  return searchMemories(sessionId, "", limit);
}

export function isMem0Enabled(): boolean {
  return enabled;
}
