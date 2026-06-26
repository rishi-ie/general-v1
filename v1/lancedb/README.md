# LanceDB — Semantic Memory

Embedded vector search module for persistent semantic memory across sessions.

## Overview

LanceDB is an in-process vector database (Apache Arrow/Lance columnar format) that provides:
- **Semantic search** — find conceptually related content even without keyword overlap
- **Full-text search** — keyword matching
- **Hybrid search** — weighted combination of both
- **Metadata filtering** — filter by source type, project, session

## Architecture

```
Pi Agent
    │
    ├─► SAC Extension (existing — unchanged)
    │       └─► Event emission (agent_end, tool_result, session_compact)
    │
    └─► LanceDB Extension (NEW)
            │
            ├─► Embedder
            │       └─► Provider API (MiniMax → OpenAI → Anthropic → Voyage)
            │
            ├─► Indexer
            │       └─► Subscribes to SAC events → embed → write to LanceDB
            │
            ├─► Retriever
            │       └─► Hybrid vector + FTS search
            │
            └─► Commands + Tool
                    └─► /semantic-* slash commands + LLM-callable tool
```

## Provider Detection

Auto-detects embedding provider from environment:

| Env Variable | Provider | Default Model |
|---|---|---|
| `MINIMAX_API_KEY` | MiniMax | `embo` |
| `OPENAI_API_KEY` | OpenAI | `text-embedding-3-small` |
| `ANTHROPIC_API_KEY` | Anthropic | `voyage-3` |
| `VOYAGE_API_KEY` | Voyage | `voyage-3` |

Set `"embedding.provider"` in config to override auto-detection.

## Indexing

Auto-indexes these SAC events when online (provider API available):

| Event | Source Type | Indexed Fields |
|---|---|---|
| Decision created | `decision` | title, reasoning, decision text |
| Compaction epoch | `epoch` | summary, project |
| Agent response | `event` | content (role: assistant) |
| Tool result | `event` | content (role: tool) |
| Cognitive snapshot | `snapshot` | identity, goals, projects |

## Graceful Degradation

| Condition | Behavior |
|---|---|
| `--offline` flag | Indexing disabled; search returns empty |
| No API key | Indexer logs warning, no-ops |
| Embedding API fails (rate limit) | Retry 3x with backoff, then drop record |
| LanceDB init fails | Extension disables; Pi Agent continues |

## Storage Location

`~/.general-v1/vectors/` — local Lance columnar files, no external service required.
