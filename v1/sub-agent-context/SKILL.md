---
name: sub-agent-context
description: Persistent cognitive layer for Pi Agent. Provides long-term memory, context lineage, goal continuity, and decision tracking. Use when you need to recall past decisions, track goals across sessions, or maintain continuity after context compactions. Built on Sub-Agent Context (SAC).
---

# Sub-Agent Context (SAC)

Persistent cognitive layer that provides long-term memory and continuity for Pi Agent.

## What It Does

SAC observes Pi's activity and builds persistent cognitive state:
- **Identity** — role, responsibilities, expertise, working style
- **Projects** — active, paused, completed projects with status and priority
- **Goals** — in-progress goals with progress, blockers, and milestones
- **Open Loops** — unresolved items (waiting for review, feedback, etc.)
- **Relationships** — people, teams, clients with interaction history
- **Decisions** — reasoning behind important choices
- **Lineage** — preserved context from before every compaction

## When SAC Is Active

SAC runs automatically in the background. It:

1. **At session start** — Loads meta state, generates cognitive snapshot, injects into context
2. **During conversation** — Updates memory stores, tracks decisions and goals
3. **On compaction** — Creates lineage epoch preserving what was lost
4. **On memory questions** — Routes to retrieval pipeline and synthesizes answer

## Memory Questions

SAC automatically detects and answers questions like:

- "What happened in our last session?"
- "What were we working on three weeks ago?"
- "What are our current goals?"
- "Who is our main stakeholder?"
- "What changed in the architecture?"

## What SAC Stores

| Store | Contents |
|-------|----------|
| Identity | Role, responsibilities, expertise, traits |
| Projects | Status, priority, recent activity |
| Goals | Progress, blockers, milestones |
| Open Loops | Waiting items, unresolved tasks |
| Relationships | People/teams with interaction count |
| Decisions | Decision + reasoning + evidence + outcome |
| Lineage | Epochs from before each compaction |

## Integration with Other Modules

| Module | How they connect |
|--------|-----------------|
| `sub-agent/` | Uses "memory" sub-agent for synthesis |
| `planning/` | Goals feed into planning; decisions tracked |
| `communication/` | Optional: meta state streams to SuperHive |

## Configuration

In `v1/sub-agent-context/config.json`:

```json
{
  "storagePath": "~/.general-v1/sac/",
  "autoSnapshot": true,
  "autoLineage": true,
  "snapshotFormat": "concise",
  "maxRecentDecisions": 20
}
```

## Storage

All data stored locally at `~/.general-v1/sac/`:

```
~/.general-v1/sac/
├── meta-state.json          # Identity, projects, goals, open loops
├── decision-ledger.json     # All decisions
└── lineage/                # Compaction epochs
    └── epoch-XXXXX.json
```

## Principles

1. **Never fight Pi** — SAC observes and stores; Pi does reasoning
2. **Everything is event-driven** — SAC only observes, never modifies Pi's logic
3. **Nothing is permanently lost** — Lineage preserves compaction history
4. **Human-like behavior from continuity** — The goal is persistent identity and memory
