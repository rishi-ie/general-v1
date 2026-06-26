import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { detectProviderInfo } from "./embedder";
import type { Indexer, Retriever } from "./index";
import type { LanceStore } from "./store";
import type { LanceDBConfig } from "./types";

export function registerCommands(
  pi: ExtensionAPI,
  store: LanceStore,
  indexer: Indexer,
  retriever: Retriever,
  config: LanceDBConfig,
): void {
  pi.registerCommand({
    name: "semantic-search",
    description: "Search semantic memory across indexed decisions, epochs, and events",
    execute: async (ctx: ExtensionContext, args: string) => {
      const parsed = parseArgs(args);
      const hits = await retriever.searchAll(parsed.query, { limit: parsed.limit });
      if (hits.length === 0) {
        ctx.ui.notify("[lancedb] No results found", "info");
        return;
      }
      const lines = hits.map(
        (h, i) => `[${i + 1}] ${h.title} (${h.source}, score: ${h.score.toFixed(3)})\n   ${h.content.slice(0, 150)}`,
      );
      ctx.ui.notify(`[lancedb] Found ${hits.length} results:\n${lines.join("\n")}`, "info");
    },
  });

  pi.registerCommand({
    name: "semantic-add",
    description: "Manually add a fact to semantic memory",
    execute: async (ctx: ExtensionContext, args: string) => {
      if (!args.trim()) {
        ctx.ui.notify("[lancedb] Usage: /semantic-add <text>", "info");
        return;
      }
      await indexer.indexManual(args);
      ctx.ui.notify("[lancedb] Added to semantic memory", "info");
    },
  });

  pi.registerCommand({
    name: "semantic-tour",
    description: "Browse all indexed semantic memory records",
    execute: async (ctx: ExtensionContext, args: string) => {
      const parsed = parseArgs(args);
      const records = await retriever.tour({ limit: parsed.limit });
      if (records.length === 0) {
        ctx.ui.notify("[lancedb] No records indexed yet", "info");
        return;
      }
      const lines = records.map((r, i) => `[${i + 1}] ${r.title} (${r.source})\n   ${r.content.slice(0, 150)}`);
      ctx.ui.notify(`[lancedb] Indexed records:\n${lines.join("\n")}`, "info");
    },
  });

  pi.registerCommand({
    name: "semantic-status",
    description: "Show semantic memory status and statistics",
    execute: async (ctx: ExtensionContext) => {
      const providerInfo = detectProviderInfo();
      const counts = await Promise.all([
        store.count("decisions"),
        store.count("epochs"),
        store.count("events"),
        store.count("snapshots"),
      ]);
      const lines = [
        "[lancedb] Status",
        `Provider: ${providerInfo.provider || "none (offline)"}`,
        `Model: ${providerInfo.model}`,
        `Dimensions: ${providerInfo.dimensions}`,
        `Decisions: ${counts[0]}`,
        `Epochs: ${counts[1]}`,
        `Events: ${counts[2]}`,
        `Snapshots: ${counts[3]}`,
        `Total: ${counts.reduce((a, b) => a + b, 0)}`,
      ];
      ctx.ui.notify(lines.join("\n"), "info");
    },
  });

  pi.registerCommand({
    name: "semantic-forget",
    description: "Delete records matching a query from semantic memory",
    execute: async (ctx: ExtensionContext, args: string) => {
      if (!args.trim()) {
        ctx.ui.notify("[lancedb] Usage: /semantic-forget <query>", "info");
        return;
      }
      const deleted = await retriever.deleteByQuery(args);
      ctx.ui.notify(`[lancedb] Deleted ${deleted} record(s)`, "info");
    },
  });
}

function parseArgs(args: string): { query: string; limit: number } {
  const parts = args.trim().split(/\s+/);
  let limit = 10;
  const remaining: string[] = [];
  for (const part of parts) {
    if (part === "--limit" || part === "-n") {
      continue;
    }
    const num = Number.parseInt(part, 10);
    if (!Number.isNaN(num) && part === String(num)) {
      limit = num;
    } else {
      remaining.push(part);
    }
  }
  return { query: remaining.join(" "), limit };
}
