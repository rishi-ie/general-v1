import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Retriever } from "./retriever";
import type { SearchHit } from "./types";

export function registerSearchTool(pi: ExtensionAPI, retriever: Retriever): void {
  pi.registerTool({
    name: "semantic_search",
    description:
      "Search long-term semantic memory across all indexed events, decisions, and tool results. Use when the user asks a memory-style question that needs semantic (not exact) matching. Returns top results with relevance scores.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Natural language search query",
        },
        source: {
          type: "string",
          enum: ["decision", "epoch", "event", "snapshot", "all"],
          default: "all",
          description: "Filter by source type",
        },
        limit: {
          type: "number",
          default: 10,
          minimum: 1,
          maximum: 50,
          description: "Maximum number of results to return",
        },
      },
      required: ["query"],
    },
    execute: async (params: {
      query: string;
      source?: string;
      limit?: number;
    }): Promise<string> => {
      try {
        const hits = await retriever.search(params.query, {
          source: params.source as "decision" | "epoch" | "event" | "snapshot" | "all" | undefined,
          limit: params.limit,
        });
        if (hits.length === 0) {
          return "No semantic memory results found.";
        }
        const lines = hits.map(
          (h: SearchHit, i: number) =>
            `[${i + 1}] (${h.source}, score: ${h.score.toFixed(3)}) ${h.title}\n   ${h.content.slice(0, 200)}`,
        );
        return `Semantic memory results:\n${lines.join("\n")}`;
      } catch (err) {
        return `[lancedb] search error: ${String(err)}`;
      }
    },
  });
}
