import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as lancedb from "@lancedb/lancedb";
import * as arrow from "apache-arrow";
import type { IndexedRecord, SearchHit, SourceType } from "./types";

const DEFAULT_DIMENSIONS = 1536;

function getSchema(dimensions: number): arrow.Schema {
  return new arrow.Schema([
    new arrow.Field("id", new arrow.Utf8()),
    new arrow.Field("type", new arrow.Utf8()),
    new arrow.Field("title", new arrow.Utf8()),
    new arrow.Field("content", new arrow.Utf8()),
    new arrow.Field("source", new arrow.Utf8()),
    new arrow.Field("source_id", new arrow.Utf8()),
    new arrow.Field("project", new arrow.Utf8()),
    new arrow.Field("session_id", new arrow.Utf8()),
    new arrow.Field("created_at", new arrow.Int64()),
    new arrow.Field("vector", new arrow.FixedSizeList(dimensions, new arrow.Field("item", new arrow.Float32()))),
  ]);
}

function resolvePath(storagePath: string): string {
  return storagePath.replace("~", os.homedir());
}

export class LanceStore {
  private db: lancedb.Connection | null = null;
  private initPromise: Promise<void> | null = null;
  private dimensions: number = DEFAULT_DIMENSIONS;

  async init(storagePath: string, dimensions: number = DEFAULT_DIMENSIONS): Promise<void> {
    this.dimensions = dimensions;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._init(storagePath);
    return this.initPromise;
  }

  private async _init(storagePath: string): Promise<void> {
    const resolved = resolvePath(storagePath);
    await fs.promises.mkdir(resolved, { recursive: true });
    this.db = await lancedb.connect(resolved);
    await this.ensureTables();
  }

  private async ensureTables(): Promise<void> {
    if (!this.db) return;
    const schema = getSchema(this.dimensions);
    const tableNames = ["decisions", "epochs", "events", "snapshots"];
    for (const name of tableNames) {
      try {
        await this.db.openTable(name);
      } catch {
        await this.db.createTable(name, [], { schema });
      }
    }
  }

  isReady(): boolean {
    return this.db !== null;
  }

  async add(tableName: string, records: IndexedRecord[]): Promise<void> {
    if (!this.db || records.length === 0) return;
    const table = await this.db.openTable(tableName);
    const schema = getSchema(this.dimensions);
    const flatRecords = records.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      content: r.content,
      source: r.source,
      source_id: r.source_id,
      project: r.project ?? "",
      session_id: r.session_id,
      created_at: r.created_at,
      vector: r.vector,
    }));
    await table.add(flatRecords, { schema });
  }

  async vectorSearch(tableName: string, vector: number[], limit: number, filter?: string): Promise<SearchHit[]> {
    if (!this.db) return [];
    const table = await this.db.openTable(tableName);
    let query = table.search(vector).limit(limit);
    if (filter) {
      query = query.where(filter);
    }
    const results = await query.toArray();
    return this.castResults(results, tableName);
  }

  async fullTextSearch(tableName: string, queryText: string, limit: number): Promise<SearchHit[]> {
    if (!this.db) return [];
    const table = await this.db.openTable(tableName);
    const results = await table.search(queryText).query().limit(limit).toArray();
    return this.castResults(results, tableName);
  }

  async hybridSearch(
    tableName: string,
    vector: number[],
    text: string,
    limit: number,
    weight: number,
  ): Promise<SearchHit[]> {
    if (!this.db) return [];
    const [vectorHits, textHits] = await Promise.all([
      this.vectorSearch(tableName, vector, limit),
      this.fullTextSearch(tableName, text, limit),
    ]);
    const merged = this.mergeResults(vectorHits, textHits, weight);
    return merged.slice(0, limit);
  }

  private mergeResults(vectorHits: SearchHit[], textHits: SearchHit[], vectorWeight: number): SearchHit[] {
    const scoreMap = new Map<string, SearchHit>();
    for (const hit of vectorHits) {
      const key = hit.id;
      scoreMap.set(key, { ...hit, score: hit.score * vectorWeight });
    }
    for (const hit of textHits) {
      const key = hit.id;
      const textWeight = 1 - vectorWeight;
      if (scoreMap.has(key)) {
        const existing = scoreMap.get(key)!;
        existing.score += hit.score * textWeight;
      } else {
        scoreMap.set(key, { ...hit, score: hit.score * textWeight });
      }
    }
    return Array.from(scoreMap.values()).sort((a, b) => b.score - a.score);
  }

  private castResults(results: Record<string, unknown>[], tableName: string): SearchHit[] {
    return results.map((r) => ({
      id: String(r.id),
      type: String(r.type) as SourceType,
      title: String(r.title),
      content: String(r.content),
      source: String(r.source) as SourceType,
      source_id: String(r.source_id),
      project: r.project ? String(r.project) : undefined,
      session_id: String(r.session_id),
      created_at: Number(r.created_at),
      vector: Array.isArray(r.vector) ? (r.vector as number[]).map(Number) : [],
      score: 1.0,
    }));
  }

  async listAll(tableName: string, limit: number): Promise<IndexedRecord[]> {
    if (!this.db) return [];
    const table = await this.db.openTable(tableName);
    const results = await table.query().limit(limit).toArray();
    return this.castResults(results, tableName);
  }

  async count(tableName: string): Promise<number> {
    if (!this.db) return 0;
    try {
      const table = await this.db.openTable(tableName);
      const results = await table.query().limit(1).toArray();
      const stats = await table.stats();
      return Number(stats.numRecords ?? 0);
    } catch {
      return 0;
    }
  }

  async deleteById(tableName: string, id: string): Promise<void> {
    if (!this.db) return;
    const table = await this.db.openTable(tableName);
    await table.delete(`id = '${id}'`);
  }

  async close(): Promise<void> {
    this.db = null;
    this.initPromise = null;
  }
}
