# Sub-Agent Context Module (MCE)

Mumbrane Cognitive Extension — persistent cognitive layer for human-like memory and self-awareness.

## What It Is

The MCE is a cognitive operating system layered on top of Pi Agent. It provides long-term memory, decision tracking, goal continuity, and identity persistence without modifying Pi's core reasoning.

## Architecture

```
sub-agent-context/
├── SKILL.md                         # This module
├── README.md                        # Documentation
└── extensions/
    └── sub-agent-context/
        ├── index.ts                 # Entry point
        ├── runtime.ts               # Main orchestration
        ├── types.ts                 # Shared types
        ├── meta-memory.ts           # Meta Memory Agent
        ├── decision-ledger.ts       # Decision tracking
        ├── goal-memory.ts           # Goal tracking
        ├── relationship-memory.ts   # People/teams
        ├── cognitive-snapshot.ts   # Session startup
        └── package.json
```

## Core Components

### Meta Memory Agent

Maintains current cognitive state:
- Active projects
- Recent decisions
- Open loops
- Learned patterns

### Decision Ledger

Stores reasoning behind choices:
- What was decided
- Why it was decided
- What evidence supported it
- Expected outcomes

### Goal Memory

Tracks goals with progress:
- Active goals with milestones
- Blocker tracking
- Priority management
- Progress measurement

### Relationship Memory

Persistent understanding of people:
- Names and roles
- Interaction history
- Preferences and notes
- Trust levels

### Cognitive Snapshot

First context at session start:
- Current identity
- Active goals summary
- Recent decisions
- Open loops
- Relevant memories

## Commands

| Command | Description |
|---------|-------------|
| `/mce status` | Current cognitive state |
| `/mce goals` | Active goals list |
| `/mce decisions` | Recent decisions |
| `/mce relationships` | Known people/teams |
| `/mce snapshot` | Refresh cognitive snapshot |
| `/mce think <topic>` | Deep thinking with sub-agents |

## Storage

MCE data lives in:

```
.mumbrane/
├── meta-state.json      # Current cognitive state
├── decisions/            # Decision ledger entries
├── goals/                # Goal tracking
├── relationships/        # People knowledge
├── epochs/               # Memory epochs
└── snapshots/            # Historical snapshots
```

## Integration

| Module | How it connects |
|--------|-----------------|
| Mem0 | Uses Mem0 for semantic memory |
| Mission Control | Shares goal state |
| Planning | Links to phases |
| Sub-agent | Spawns for cognitive tasks |

## V1 Features

- ✅ Cognitive snapshot at session start
- ✅ Meta state tracking
- ✅ Decision ledger
- ✅ Goal memory
- ✅ Relationship memory
- ✅ Sub-agent integration for deep operations

## Not in V1

- Advanced lineage reconstruction
- Multi-agent cognition
- Autonomous reflection loops
- Self-modifying memory
