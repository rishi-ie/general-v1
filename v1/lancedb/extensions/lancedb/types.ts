export type EmbeddingProvider = "minimax" | "openai" | "anthropic" | "voyage";

export type SourceType = "decision" | "epoch" | "event" | "snapshot";

export interface IndexedRecord {
  id: string;
  type: SourceType;
  title: string;
  content: string;
  source: SourceType;
  source_id: string;
  project?: string;
  session_id: string;
  created_at: number;
  vector: number[];
}

export interface SearchHit extends IndexedRecord {
  score: number;
}

export interface LanceDBConfig {
  storagePath: string;
  enabled: boolean;
  embedding: EmbeddingConfig;
  indexing: IndexingConfig;
  search: SearchConfig;
}

export interface EmbeddingConfig {
  provider: EmbeddingProvider | "auto";
  model: string;
  dimensions: number;
  maxRetries: number;
  batchSize: number;
  timeoutMs: number;
}

export interface IndexingConfig {
  decisions: boolean;
  epochs: boolean;
  agentResponses: boolean;
  toolResults: boolean;
  maxContentLength: number;
}

export interface SearchConfig {
  defaultLimit: number;
  minScore: number;
  hybridWeight: number;
}

export interface SearchOptions {
  limit?: number;
  source?: SourceType | "all";
  project?: string;
  minScore?: number;
}

export interface Embedder {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  dimensions: number;
  model: string;
  provider: EmbeddingProvider;
}

export interface EmbedderConfig {
  provider: EmbeddingProvider | "auto";
  model?: string;
  apiKey?: string;
  dimensions: number;
  maxRetries: number;
  timeoutMs: number;
}

export function createDefaultConfig(): LanceDBConfig {
  return {
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
}
