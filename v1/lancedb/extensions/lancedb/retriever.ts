import type { LanceStore } from "./store";
import type { Embedder, SearchHit, SearchOptions } from "./types";

const TABLE_MAP: Record<string, string> = {
  decision: "decisions",
  epoch: "epochs",
  event: "events",
  snapshot: "snapshots",
  all: "decisions",
};

export class Retriever {
  private store: LanceStore;
  private embedder: Embedder;
  private defaultLimit: number;
  private minScore: number;
  private hybridWeight: number;

  constructor(store: LanceStore, embedder: Embedder, defaultLimit: number, minScore: number, hybridWeight: number) {
    this.store = store;
    this.embedder = embedder;
    this.defaultLimit = defaultLimit;
    this.minScore = minScore;
    this.hybridWeight = hybridWeight;
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchHit[]> {
    const limit = options.limit || this.defaultLimit;
    const tableName = options.source && options.source !== "all" ? TABLE_MAP[options.source] : "decisions";

    try {
      const vector = await this.embedder.embed(query);
      const filter = this.buildFilter(options);
      const results = await this.store.hybridSearch(tableName, vector, query, limit * 3, this.hybridWeight);
      return results.filter((r) => r.score >= this.minScore).slice(0, limit);
    } catch (err) {
      console.error("[lancedb] search failed:", err);
      return [];
    }
  }

  async searchAll(query: string, options: SearchOptions = {}): Promise<SearchHit[]> {
    const limit = options.limit || this.defaultLimit;
    try {
      const vector = await this.embedder.embed(query);
      const allHits: SearchHit[] = [];
      for (const tableName of ["decisions", "epochs", "events", "snapshots"]) {
        const hits = await this.store.hybridSearch(tableName, vector, query, limit, this.hybridWeight);
        allHits.push(...hits);
      }
      allHits.sort((a, b) => b.score - a.score);
      return allHits.filter((r) => r.score >= this.minScore).slice(0, limit);
    } catch (err) {
      console.error("[lancedb] search failed:", err);
      return [];
    }
  }

  async tour(options: SearchOptions = {}): Promise<SearchHit[]> {
    const limit = options.limit || this.defaultLimit;
    const tableName = options.source && options.source !== "all" ? TABLE_MAP[options.source] : "decisions";
    try {
      return await this.store.listAll(tableName, limit);
    } catch (err) {
      console.error("[lancedb] tour failed:", err);
      return [];
    }
  }

  async deleteByQuery(query: string, options: SearchOptions = {}): Promise<number> {
    const hits = await this.search(query, { ...options, limit: 50 });
    let deleted = 0;
    for (const hit of hits) {
      try {
        await this.store.deleteById(TABLE_MAP[hit.source] || hit.source, hit.id);
        deleted++;
      } catch (err) {
        console.error(`[lancedb] delete failed for ${hit.id}:`, err);
      }
    }
    return deleted;
  }

  private buildFilter(options: SearchOptions): string | undefined {
    const parts: string[] = [];
    if (options.source && options.source !== "all") {
      parts.push(`source = '${options.source}'`);
    }
    if (options.project) {
      parts.push(`project = '${options.project}'`);
    }
    return parts.length > 0 ? parts.join(" AND ") : undefined;
  }
}
