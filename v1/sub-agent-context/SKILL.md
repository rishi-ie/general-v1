---
name: sub-agent-context
description: Cognitive layer for persistent self-awareness, decision tracking, goal management, and relationship memory. Uses sub-agents for deep memory operations. This is the MCE (Mumbrane Cognitive Extension).
---

# Sub-Agent Context (MCE)

Persistent cognitive layer that gives the agent human-like self-awareness and memory continuity.

## What It Is

The MCE is a cognitive operating system layered on top of Pi Agent. It doesn't modify Pi's reasoning — it provides:

- **Long-term memory** — Beyond session context
- **Decision tracking** — Why choices were made
- **Goal continuity** — What the agent is working toward
- **Identity persistence** — Who the agent is and what it knows
- **Relationship awareness** — Who matters and why

## Core Components

### Meta Memory Agent

Maintains persistent self-awareness:

- Current focus and active projects
- Recent decisions and their rationale
- Open loops and pending items
- Learned patterns

### Decision Ledger

Stores reasoning behind important actions:

```json
{
  "id": "DEC-2025-06-20-001",
  "title": "Chose PostgreSQL over MongoDB",
  "rationale": "Better relational integrity for user data",
  "evidence": "User emphasized data consistency",
  "confidence": "high",
  "outcome": "pending"
}
```

### Goal Memory

Tracks goals with milestones and blockers:

```json
{
  "id": "GOAL-001",
  "title": "Launch MVP",
  "status": "in_progress",
  "priority": "high",
  "milestones": ["Auth", "Core features", "Beta"],
  "progress": 60,
  "blockers": []
}
```

### Relationship Memory

Persistent understanding of people and teams:

```json
{
  "entity_id": "person-001",
  "name": "John",
  "role": "Engineering Manager",
  "relationship_type": "stakeholder",
  "interactions": 15,
  "notes": "Prefers async updates, weekly standups"
}
```

### Cognitive Snapshot

Compressed representation of current mental state — the first context loaded at session start:

```
=== COGNITIVE SNAPSHOT ===
Identity: Senior Product Manager for SuperHive
Active Goals: Launch MVP, Redesign dashboard
Recent Decisions: Moved to lineage memory model
Open Loops: Dashboard redesign pending design review
Focus: Phase 2 - Core features implementation
```

## When It Runs

| Event | MCE Action |
|-------|-----------|
| Session start | Load and inject cognitive snapshot |
| Turn end | Update meta state, track decisions |
| Task complete | Update goal progress |
| User mentions person | Update relationship memory |
| Before major decision | Check decision ledger for context |

## Cognitive Snapshot Injection

At session start, the MCE injects:

1. **Identity** — Who the agent is
2. **Active projects** — What it's working on
3. **Current goals** — What it's trying to achieve
4. **Recent decisions** — Why things were done
5. **Open loops** — Outstanding items
6. **Relevant memories** — Things that might help

## Commands

| Command | When to use |
|---------|-------------|
| `/mce status` | Show current cognitive state |
| `/mce goals` | List active goals |
| `/mce decisions` | Show recent decisions |
| `/mce relationships` | Show known people/teams |
| `/mce snapshot` | Force refresh cognitive snapshot |
| `/mce think <topic>` | Deep thinking on a topic using sub-agents |

## Sub-Agent Integration

The MCE uses sub-agents for:

| Task | Why sub-agent |
|------|---------------|
| Deep memory search | Can run in parallel with main work |
| Lineage reconstruction | Complex query across epochs |
| Relationship analysis | Multi-source aggregation |
| Decision research | Trace through many memories |

## Storage

MCE data is stored in:

```
.mumbrane/
├── meta-state.json      # Current cognitive state
├── decisions/            # Decision ledger
├── goals/               # Goal memories
├── relationships/       # Relationship memories
├── epochs/              # Lineage epochs (from compaction)
└── snapshots/           # Historical snapshots
```

## Relationship to Other Modules

| Module | MCE integration |
|--------|-----------------|
| Mem0 | MCE uses Mem0 for semantic storage |
| Mission Control | Shares goal/ticket state |
| Planning | Links to plan phases |
| Identity | MCE maintains agent identity |

## V1 Scope

In V1, the MCE focuses on:

- ✅ Cognitive snapshot at session start
- ✅ Meta state tracking
- ✅ Decision ledger
- ✅ Goal memory
- ✅ Relationship memory
- ✅ Sub-agent spawning for cognitive tasks

Not in V1:
- Advanced lineage reconstruction
- Multi-agent cognition
- Autonomous reflection loops
