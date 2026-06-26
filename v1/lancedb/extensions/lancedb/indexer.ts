import { ulid } from "ulid";
import type { LanceStore } from "./store";
import type { IndexedRecord, IndexerConfig, SourceType } from "./types";
import type { Embedder } from "./types";

export class Indexer {
  private store: LanceStore;
  private embedder: Embedder;
  private config: IndexerConfig;
  private disabled = false;
  private sessionId = "";

  constructor(store: LanceStore, embedder: Embedder, config: IndexerConfig) {
    this.store = store;
    this.embedder = embedder;
    this.config = config;
  }

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  disable(): void {
    this.disabled = true;
  }

  isDisabled(): boolean {
    return this.disabled;
  }

  async indexDecision(id: string, title: string, reasoning: string, decision: string, project?: string): Promise<void> {
    if (!this.config.decisions || this.disabled) return;
    await this.indexRecord({
      id,
      type: "decision",
      title,
      content: `Decision: ${decision}\nReasoning: ${reasoning}`,
      source: "decision",
      source_id: id,
      project,
      session_id: this.sessionId,
      created_at: Date.now(),
    });
  }

  async indexEpoch(id: string, summary: string, project?: string): Promise<void> {
    if (!this.config.epochs || this.disabled) return;
    const content = summary.slice(0, this.config.maxContentLength);
    await this.indexRecord({
      id,
      type: "epoch",
      title: `Epoch ${id.slice(-6)}`,
      content,
      source: "epoch",
      source_id: id,
      project,
      session_id: this.sessionId,
      created_at: Date.now(),
    });
  }

  async indexAgentResponse(content: string): Promise<void> {
    if (!this.config.agentResponses || this.disabled) return;
    const trimmed = content.slice(0, this.config.maxContentLength);
    const id = ulid();
    await this.indexRecord({
      id,
      type: "event",
      title: "Agent response",
      content: trimmed,
      source: "event",
      source_id: id,
      session_id: this.sessionId,
      created_at: Date.now(),
    });
  }

  async indexToolResult(toolName: string, content: string): Promise<void> {
    if (!this.config.toolResults || this.disabled) return;
    const trimmed = content.slice(0, this.config.maxContentLength);
    const id = ulid();
    await this.indexRecord({
      id,
      type: "event",
      title: `Tool: ${toolName}`,
      content: `[${toolName}] ${trimmed}`,
      source: "event",
      source_id: id,
      session_id: this.sessionId,
      created_at: Date.now(),
    });
  }

  async indexManual(content: string, title?: string): Promise<void> {
    if (this.disabled) return;
    const id = ulid();
    const trimmed = content.slice(0, this.config.maxContentLength);
    await this.indexRecord({
      id,
      type: "event",
      title: title || "Manual entry",
      content: trimmed,
      source: "event",
      source_id: id,
      session_id: this.sessionId,
      created_at: Date.now(),
    });
  }

  private async indexRecord(record: Omit<IndexedRecord, "vector">): Promise<void> {
    try {
      const text = `${record.title} ${record.content}`;
      const vector = await this.embedder.embed(text);
      await this.store.add(record.source, [{ ...record, vector }]);
    } catch (err) {
      console.error(`[lancedb] failed to index ${record.source}/${record.source_id}:`, err);
    }
  }

  async indexBatch(
    records: Array<{
      type: SourceType;
      id: string;
      title: string;
      content: string;
      project?: string;
    }>,
  ): Promise<void> {
    if (this.disabled || records.length === 0) return;
    const texts = records.map((r) => `${r.title} ${r.content}`);
    try {
      const vectors = await this.embedder.embedBatch(texts);
      const indexed: IndexedRecord[] = records.map((r, i) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        content: r.content.slice(0, this.config.maxContentLength),
        source: r.type,
        source_id: r.id,
        project: r.project,
        session_id: this.sessionId,
        created_at: Date.now(),
        vector: vectors[i],
      }));
      for (const rec of indexed) {
        await this.store.add(rec.source, [rec]);
      }
    } catch (err) {
      console.error("[lancedb] batch indexing failed:", err);
    }
  }
}
