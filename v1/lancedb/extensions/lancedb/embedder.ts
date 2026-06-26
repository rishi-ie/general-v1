import type { Embedder, EmbedderConfig, EmbeddingProvider } from "./types";

function detectProvider(): EmbeddingProvider | null {
  const keys: Array<{ env: string; provider: EmbeddingProvider }> = [
    { env: "MINIMAX_API_KEY", provider: "minimax" },
    { env: "OPENAI_API_KEY", provider: "openai" },
    { env: "ANTHROPIC_API_KEY", provider: "anthropic" },
    { env: "VOYAGE_API_KEY", provider: "voyage" },
  ];
  for (const { env, provider } of keys) {
    if (process.env[env]) return provider;
  }
  return null;
}

const PROVIDER_DEFAULTS: Record<EmbeddingProvider, { model: string; dimensions: number; baseUrl: string }> = {
  minimax: {
    model: "embo",
    dimensions: 1024,
    baseUrl: "https://api.minimax.io/v1",
  },
  openai: {
    model: "text-embedding-3-small",
    dimensions: 1536,
    baseUrl: "https://api.openai.com/v1",
  },
  anthropic: {
    model: "voyage-3",
    dimensions: 1024,
    baseUrl: "https://api.anthropic.com/v1",
  },
  voyage: {
    model: "voyage-3",
    dimensions: 1024,
    baseUrl: "https://api.voyageai.com/v1",
  },
};

abstract class BaseEmbedder implements Embedder {
  abstract provider: EmbeddingProvider;
  abstract model: string;
  abstract dimensions: number;
  abstract apiKey: string;
  abstract baseUrl: string;
  abstract timeoutMs: number;
  abstract maxRetries: number;

  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text]);
    return results[0];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    let retryCount = 0;
    while (retryCount <= this.maxRetries) {
      try {
        return await this.callAPI(texts);
      } catch (err) {
        retryCount++;
        if (retryCount > this.maxRetries) throw err;
        await new Promise((r) => setTimeout(r, 1000 * retryCount));
      }
    }
    return texts.map(() => Array(this.dimensions).fill(0));
  }

  protected abstract callAPI(texts: string[]): Promise<number[][]>;

  protected async fetchWithTimeout(url: string, body: unknown, headers: Record<string, string>): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }
}

class MiniMaxEmbedder extends BaseEmbedder {
  provider: EmbeddingProvider = "minimax";
  model: string;
  dimensions: number;
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;

  constructor(apiKey: string, model: string, dimensions: number, timeoutMs: number, maxRetries: number) {
    super();
    this.apiKey = apiKey;
    this.model = model || PROVIDER_DEFAULTS.minimax.model;
    this.dimensions = dimensions || PROVIDER_DEFAULTS.minimax.dimensions;
    this.baseUrl = PROVIDER_DEFAULTS.minimax.baseUrl;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
  }

  protected async callAPI(texts: string[]): Promise<number[][]> {
    const data = (await this.fetchWithTimeout(
      `${this.baseUrl}/embeddings`,
      {
        model: this.model,
        input: texts,
      },
      {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    )) as { data: Array<{ embedding: number[] }> };
    return data.data.map((d) => d.embedding);
  }
}

class OpenAIEmbedder extends BaseEmbedder {
  provider: EmbeddingProvider = "openai";
  model: string;
  dimensions: number;
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;

  constructor(apiKey: string, model: string, dimensions: number, timeoutMs: number, maxRetries: number) {
    super();
    this.apiKey = apiKey;
    this.model = model || PROVIDER_DEFAULTS.openai.model;
    this.dimensions = dimensions || PROVIDER_DEFAULTS.openai.dimensions;
    this.baseUrl = PROVIDER_DEFAULTS.openai.baseUrl;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
  }

  protected async callAPI(texts: string[]): Promise<number[][]> {
    const data = (await this.fetchWithTimeout(
      `${this.baseUrl}/embeddings`,
      {
        model: this.model,
        input: texts,
      },
      {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    )) as { data: Array<{ embedding: number[] }> };
    return data.data.map((d) => d.embedding);
  }
}

class AnthropicEmbedder extends BaseEmbedder {
  provider: EmbeddingProvider = "anthropic";
  model: string;
  dimensions: number;
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;

  constructor(apiKey: string, model: string, dimensions: number, timeoutMs: number, maxRetries: number) {
    super();
    this.apiKey = apiKey;
    this.model = model || PROVIDER_DEFAULTS.anthropic.model;
    this.dimensions = dimensions || PROVIDER_DEFAULTS.anthropic.dimensions;
    this.baseUrl = PROVIDER_DEFAULTS.anthropic.baseUrl;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
  }

  protected async callAPI(texts: string[]): Promise<number[][]> {
    const data = (await this.fetchWithTimeout(
      `${this.baseUrl}/embeddings`,
      {
        model: this.model,
        input_texts: texts,
      },
      {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-05-31",
        "Content-Type": "application/json",
      },
    )) as { embeddings: number[][] };
    return data.embeddings;
  }
}

class VoyageEmbedder extends BaseEmbedder {
  provider: EmbeddingProvider = "voyage";
  model: string;
  dimensions: number;
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;

  constructor(apiKey: string, model: string, dimensions: number, timeoutMs: number, maxRetries: number) {
    super();
    this.apiKey = apiKey;
    this.model = model || PROVIDER_DEFAULTS.voyage.model;
    this.dimensions = dimensions || PROVIDER_DEFAULTS.voyage.dimensions;
    this.baseUrl = PROVIDER_DEFAULTS.voyage.baseUrl;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
  }

  protected async callAPI(texts: string[]): Promise<number[][]> {
    const data = (await this.fetchWithTimeout(
      `${this.baseUrl}/embeddings`,
      {
        model: this.model,
        input: texts,
      },
      {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    )) as { data: Array<{ embedding: number[] }> };
    return data.data.map((d) => d.embedding);
  }
}

function getApiKeyForProvider(provider: EmbeddingProvider): string | undefined {
  const keyMap: Record<EmbeddingProvider, string> = {
    minimax: "MINIMAX_API_KEY",
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    voyage: "VOYAGE_API_KEY",
  };
  return process.env[keyMap[provider]];
}

export function createEmbedder(config: EmbedderConfig): Embedder | null {
  const provider = config.provider === "auto" ? detectProvider() : config.provider;
  if (!provider) return null;

  const apiKey = config.apiKey || getApiKeyForProvider(provider);
  if (!apiKey) return null;

  const defaults = PROVIDER_DEFAULTS[provider];
  const effectiveConfig: EmbedderConfig = {
    ...config,
    provider,
    model: config.model === "auto" ? defaults.model : config.model || defaults.model,
    dimensions: config.dimensions || defaults.dimensions,
    timeoutMs: config.timeoutMs || 10000,
    maxRetries: config.maxRetries || 3,
  };

  switch (provider) {
    case "minimax":
      return new MiniMaxEmbedder(
        apiKey,
        effectiveConfig.model!,
        effectiveConfig.dimensions,
        effectiveConfig.timeoutMs,
        effectiveConfig.maxRetries,
      );
    case "openai":
      return new OpenAIEmbedder(
        apiKey,
        effectiveConfig.model!,
        effectiveConfig.dimensions,
        effectiveConfig.timeoutMs,
        effectiveConfig.maxRetries,
      );
    case "anthropic":
      return new AnthropicEmbedder(
        apiKey,
        effectiveConfig.model!,
        effectiveConfig.dimensions,
        effectiveConfig.timeoutMs,
        effectiveConfig.maxRetries,
      );
    case "voyage":
      return new VoyageEmbedder(
        apiKey,
        effectiveConfig.model!,
        effectiveConfig.dimensions,
        effectiveConfig.timeoutMs,
        effectiveConfig.maxRetries,
      );
    default:
      return null;
  }
}

export function detectProviderInfo(): { provider: EmbeddingProvider | null; model: string; dimensions: number } {
  const provider = detectProvider();
  if (!provider) return { provider: null, model: "none", dimensions: 0 };
  const defaults = PROVIDER_DEFAULTS[provider];
  return { provider, model: defaults.model, dimensions: defaults.dimensions };
}
