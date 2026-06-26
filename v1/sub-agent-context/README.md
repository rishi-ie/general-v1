# Sub-Agent Context (SAC)

Persistent cognitive layer for Pi Agent — provides long-term memory, context lineage, goal continuity, and decision tracking.

## What It Is

SAC is a Pi Agent extension that observes Pi's activity and builds persistent cognitive state that survives context compactions, session restarts, and long-running projects.

**SAC is NOT:**
- A replacement for Pi's context system
- A replacement for Pi's reasoning engine
- An autonomous agent

**SAC IS:**
- A persistent memory layer that makes Pi feel like a digital employee with continuity
- A cognitive operating system that preserves what matters across compactions

## Architecture

```
Pi Agent
    ↓
SAC Extension
    ├── Event Observer
    ├── Meta State Store
    ├── Decision Ledger
    ├── Lineage Engine
    ├── Retrieval Pipeline
    └── Snapshot Service
    ↓
Storage (~/.general-v1/sac/)
```

## Installation

Load via meta-agent config:

```json
{
  "extensions": [
    "v1/sub-agent-context/extensions/sac/index.ts"
  ]
}
```

Or via command line:

```bash
pi -e ./v1/sub-agent-context/extensions/sac/index.ts
```

## Core Capabilities

### Cognitive Snapshot

At session start, SAC generates a snapshot of current cognitive state and injects it into Pi's system prompt:

```
Identity: Senior Product Engineer
Focus: Building General V1 digital employee

Projects:
- SuperHive (active, high priority)
- Mumbrane Cognitive Extension (active, high priority)

Goals:
- Ship SuperHive MVP (in progress, 60%)
- Implement sub-agent-context (in progress, 20%)

Open Loops:
- Memory architecture review pending
- Need to clarify sub-agent-context spec

Recent Decisions:
- Adopt lineage model for context preservation
```

### Context Lineage

Every time Pi compacts context, SAC creates a lineage epoch preserving:
- Summary of the compacted context
- Decisions made
- Goals active
- Relationships
- File references

This survives indefinitely, even after multiple compactions.

### Memory Question Routing

SAC automatically detects memory questions and synthesizes answers:

- "Why did we decide to use lineage for context preservation?"
- "What were we working on last week?"
- "What changed in the architecture?"
- "What are our active goals?"

### Decision Ledger

Stores every significant decision with:
- What was decided
- Why (reasoning)
- Evidence for the decision
- Confidence level
- Outcome (when known)

## Storage

All data stored locally at `~/.general-v1/sac/`:

```
~/.general-v1/sac/
├── meta-state.json          # Identity, projects, goals, open loops
├── decision-ledger.json     # All decisions
└── lineage/                # Compaction epochs
    └── epoch-XXXXX.json
```

## Configuration

File: `v1/sub-agent-context/config.json`

```json
{
  "storagePath": "~/.general-v1/sac/",
  "autoSnapshot": true,
  "autoLineage": true,
  "snapshotFormat": "concise",
  "maxRecentDecisions": 20
}
```

## Module Integration

| Module | Integration |
|--------|------------|
| `sub-agent/` | Uses "memory" sub-agent for synthesis |
| `planning/` | Goals feed into planning; decisions tracked |
| `communication/` | Optional: meta state streams to SuperHive |

## Design Principles

1. **Never fight Pi** — SAC observes and stores; Pi does reasoning
2. **Everything is event-driven** — SAC only observes
3. **Nothing is permanently lost** — Lineage preserves compaction history
4. **Human-like behavior from continuity** — Persistent identity and memory

## Related Modules

| Module | Purpose |
|--------|---------|
| `sub-agent/` | Sub-agent spawning |
| `communication/` | SuperHive bridge |
| `planning/` | File-based task planning |
