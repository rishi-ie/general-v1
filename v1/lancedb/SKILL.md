---
name: lancedb
description: Semantic memory layer for Pi Agent using LanceDB vector search. Provides hybrid vector + full-text search over indexed decisions, epochs, and tool results. Auto-indexes SAC events and exposes /semantic-* commands. Use when memory-style questions need semantic matching across previously indexed content.
---

# LanceDB — Semantic Memory Module

Persistent semantic memory using LanceDB embedded vector search.

## What It Does

LanceDB provides hybrid semantic + keyword search over indexed events from the agent's history:
- Decisions and their reasoning
- Compaction epoch summaries
- Agent responses and tool outputs
- Manual `/semantic-add` entries

## When It's Active

LanceDB runs when:
1. An API key is present (`MINIMAX_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `VOYAGE_API_KEY`)
2. The `--offline` flag is NOT set

In offline mode, indexing and search are disabled (data is still stored but not embedded).

## Commands

| Command | Description |
|---|---|
| `/semantic-search <query>` | Hybrid search across all indexed content |
| `/semantic-search --source decision <query>` | Filter by source type |
| `/semantic-add <text>` | Manually add a fact to memory |
| `/semantic-tour [--source X] [--limit N]` | Browse all indexed records |
| `/semantic-status` | Show counts per table, embedding provider |
| `/semantic-forget <query>` | Delete matching records |

## Source Types

- `decision` — stored decisions from the decision ledger
- `epoch` — compaction epoch summaries
- `event` — agent responses and tool outputs
- `snapshot` — cognitive snapshots

## Configuration

In `v1/lancedb/config.json`:

```json
{
  "storagePath": "~/.general-v1/vectors/",
  "enabled": true,
  "embedding": {
    "provider": "auto",
    "dimensions": 1536
  },
  "indexing": {
    "decisions": true,
    "epochs": true,
    "agentResponses": true,
    "toolResults": true
  }
}
```

Provider resolution order: `minimax → openai → anthropic → voyage`.

## Storage

All data stored at `~/.general-v1/vectors/` as Lance columnar files:
- `decisions.lance/`
- `epochs.lance/`
- `events.lance/`
- `snapshots.lance/`
