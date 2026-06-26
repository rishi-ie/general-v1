import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { ulid } from "ulid";
import { registerCommands } from "./commands";
import { createEmbedder } from "./embedder";
import { Indexer } from "./indexer";
import { Retriever } from "./retriever";
import { registerSearchTool } from "./search-tool";
import { LanceStore } from "./store";
import type { LanceDBConfig } from "./types";

function log(msg: string, data?: Record<string, unknown>): void {
  console.log(`[lancedb] ${msg}`, data ?? {});
}

export class LanceDBExtension {
  private store: LanceStore;
  private indexer: Indexer | null = null;
  private retriever: Retriever | null = null;
  private config: LanceDBConfig | null = null;
  private offline = false;

  constructor() {
    this.store = new LanceStore();
  }

  async init(pi: ExtensionAPI, offline: boolean): Promise<void> {
    this.offline = offline;

    const defaultConfig: LanceDBConfig = {
      storagePath: "~/.general-v1/vectors/",
      enabled: true,
      embedding: {
        provider: "auto",
        model: "auto",
        dimensions: 1536,
        maxRetries: 3,
        batchSize: 20,
        timeoutMs: 10000,
      },
      indexing: {
        decisions: true,
        epochs: true,
        agentResponses: true,
        toolResults: true,
        maxContentLength: 8000,
      },
      search: {
        defaultLimit: 10,
        minScore: 0.7,
        hybridWeight: 0.5,
      },
    };

    this.config = defaultConfig;

    if (offline) {
      log("indexing disabled (offline mode)");
      return;
    }

    const embedder = createEmbedder(this.config.embedding);
    if (!embedder) {
      log(
        "no embedding provider detected (MINIMAX_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or VOYAGE_API_KEY required)",
      );
      return;
    }

    try {
      await this.store.init(this.config.storagePath, this.config.embedding.dimensions);
      this.indexer = new Indexer(this.store, embedder, this.config.indexing);
      this.retriever = new Retriever(
        this.store,
        embedder,
        this.config.search.defaultLimit,
        this.config.search.minScore,
        this.config.search.hybridWeight,
      );
      log("initialized", {
        provider: embedder.provider,
        model: embedder.model,
        dimensions: embedder.dimensions,
        storagePath: this.config.storagePath,
      });
    } catch (err) {
      log("init failed, disabling", { error: String(err) });
    }
  }

  setSessionId(sessionId: string): void {
    if (this.indexer) {
      this.indexer.setSessionId(sessionId);
    }
  }

  isAvailable(): boolean {
    return !this.offline && this.indexer !== null && this.retriever !== null;
  }

  getIndexer(): Indexer | null {
    return this.indexer;
  }

  getRetriever(): Retriever | null {
    return this.retriever;
  }

  getStore(): LanceStore {
    return this.store;
  }

  getConfig(): LanceDBConfig | null {
    return this.config;
  }
}

const extension = new LanceDBExtension();
let initialized = false;

export default async function (pi: ExtensionAPI): Promise<void> {
  if (initialized) return;
  initialized = true;

  const isOffline = Boolean(process.env.PI_OFFLINE) || process.argv.includes("--offline");

  await extension.init(pi, isOffline);

  if (!extension.isAvailable()) {
    log("lancedb not available, semantic memory disabled");
    return;
  }

  registerSearchTool(pi, extension.getRetriever()!);
  registerCommands(
    pi,
    extension.getStore(),
    extension.getIndexer()!,
    extension.getRetriever()!,
    extension.getConfig()!,
  );

  pi.on("session_start", async (_event: unknown, ctx: ExtensionContext) => {
    const sessionId =
      (
        ctx as ExtensionContext & { sessionManager?: { getSessionFile?: () => string } }
      ).sessionManager?.getSessionFile?.() || ulid();
    extension.setSessionId(sessionId);
    log("session registered", { session_id: sessionId });
  });

  pi.on("agent_end", async (event: { messages: Array<{ role: string; content?: string }> }, _ctx: ExtensionContext) => {
    const indexer = extension.getIndexer();
    if (!indexer || indexer.isDisabled()) return;
    const messages = event.messages ?? [];
    for (const msg of messages) {
      if (msg.role === "assistant" && msg.content) {
        await indexer.indexAgentResponse(msg.content.slice(0, 8000));
      }
    }
  });

  pi.on("tool_result", async (event: { toolName: string; result: unknown }, _ctx: ExtensionContext) => {
    const indexer = extension.getIndexer();
    if (!indexer || indexer.isDisabled()) return;
    const content = typeof event.result === "string" ? event.result : JSON.stringify(event.result).slice(0, 8000);
    await indexer.indexToolResult(event.toolName, content);
  });

  pi.on(
    "session_compact",
    async (event: { compactionEntry?: { id: string; summary?: string } }, _ctx: ExtensionContext) => {
      const indexer = extension.getIndexer();
      if (!indexer || indexer.isDisabled()) return;
      const summary = event.compactionEntry?.summary ?? "Compacted context";
      await indexer.indexEpoch(event.compactionEntry?.id || ulid(), summary);
    },
  );

  log("registered all event handlers");
}
