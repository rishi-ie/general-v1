# Sub-Agent Context (SAC) — Index

## What is SAC?

Sub-Agent Context (SAC) is a Pi Agent extension that provides persistent cognitive continuity on top of Pi's existing context management and compaction systems.

**SAC is NOT:**
- A replacement for Pi's context system
- A replacement for Pi's compaction system
- A replacement for Pi's reasoning

**SAC IS:**
- A persistent cognitive layer that survives context compactions, session restarts, and long-running projects
- The "memory and continuity system" that makes Pi feel like a persistent digital employee

---

## Architecture

```
Pi Agent
    ↓
Sub-Agent Context Extension
    ↓
    ├── Event Observer
    ├── Meta State Store
    ├── Decision Ledger
    ├── Lineage Engine
    ├── Mem0 Bridge
    ├── Retrieval Pipeline
    └── Snapshot Service
    ↓
Storage (~/.general-v1/sac/)
```

---

## Core Principles

1. **Never fight Pi** — SAC observes and stores; Pi does reasoning
2. **Everything is event-driven** — SAC only observes, never modifies Pi's logic
3. **Nothing is permanently lost** — Lineage preserves compaction history
4. **Human-like behavior from continuity** — The goal is persistent identity and memory

---

## Files

| Document | Purpose |
|----------|---------|
| `INDEX.md` | This document — overview |
| `ARCHITECTURE.md` | System design, data flow, component interactions |
| `SCHEMA.md` | All TypeScript types and data schemas |
| `STATE.md` | State machines for compaction, retrieval, meta-memory |
| `INTEGRATION.md` | How SAC connects to mem0, sub-agent, communication |
| `IMPLEMENTATION.md` | Build guide, file layout, implementation notes |

---

## Quick Reference

### Pi Lifecycle Hooks Used

| Event | SAC Action |
|-------|------------|
| `session_start` | Load meta state, prepare snapshot |
| `before_agent_start` | Inject cognitive snapshot into system prompt |
| `agent_end` | Update meta state, decisions, goals |
| `turn_end` | Update memory stores from tool calls/results |
| `session_before_compact` | Create lineage epoch before compaction |
| `session_compact` | Link epoch to Pi's compaction entry |
| `session_shutdown` | Persist final state |

### Storage Layout

```
~/.general-v1/sac/
├── meta-state.json          # Identity, projects, goals, open loops
├── decision-ledger.json     # All decisions with reasoning
├── lineage/                 # One JSON per epoch
│   └── epoch-XXXXX.json
└── snapshots/               # Optional persistence
```

### Retrieval Pipeline (8 stages)

1. Meta State
2. Goals
3. Decision Ledger
4. Mem0
5. Lineage Epochs
6. Reconstruction
7. Sub-Agent Synthesis
8. Return to Pi
