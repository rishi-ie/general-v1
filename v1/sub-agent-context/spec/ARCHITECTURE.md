# Sub-Agent Context — Architecture

## System Design

### Design Principles

1. **Never fight Pi** — SAC observes and stores; Pi does reasoning
2. **Everything is event-driven** — SAC only observes, never modifies Pi's core logic
3. **Nothing is permanently lost** — Lineage preserves compaction history forever
4. **Human-like behavior from continuity** — The goal is persistent identity and memory

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Pi Agent                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │   Context   │  │ Compaction   │  │     Reasoning Loop      │ │
│  │   System    │  │   System     │  │                        │ │
│  └──────┬──────┘  └──────┬───────┘  └────────────┬─────────────┘ │
└─────────┼────────────────┼──────────────────────┼───────────────┘
          │                │                      │
          ↓                ↓                      ↓
┌─────────────────────────────────────────────────────────────────┐
│                    SAC Extension                                 │
│                                                                  │
│  ┌────────────────┐   ┌─────────────────┐   ┌───────────────┐ │
│  │ Event Observer │ → │ Meta State Store │ → │ Decision Ledger│ │
│  └───────┬────────┘   └────────┬─────────┘   └───────┬───────┘ │
│          │                    │                     │          │
│  ┌───────┴────────┐   ┌────────┴────────┐   ┌───────┴───────┐ │
│  │Lineage Engine  │   │Snapshot Service │   │ Mem0 Bridge   │ │
│  └───────┬────────┘   └────────┬────────┘   └───────┬───────┘ │
│          │                    │                     │          │
│  ┌───────┴────────────────────┴─────────────────────┴───────┐  │
│  │              Retrieval Pipeline                            │  │
│  │  MetaState → Goals → Decisions → Mem0 → Lineage → Synth  │  │
│  └───────────────────────────┬───────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐ │
│  │           Memory Question Router                            │ │
│  │  Detects "why did we decide X?" type questions             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│  ┌───────────────────────────┴───────────────────────────────┐ │
│  │           Meta Memory Sub-Agent (via sub-agent/)            │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Storage Layer                                  │
│            ~/.general-v1/sac/ (JSON files)                       │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

#### Session Startup
```
Pi Launches
    ↓
session_start event
    ↓
SAC: Load meta-state.json
    ↓
SAC: Generate Cognitive Snapshot
    ↓
before_agent_start event
    ↓
SAC: Inject snapshot into systemPrompt
    ↓
Pi Agent begins with full cognitive context
```

#### Runtime Events
```
Event occurs (turn_end, tool_result, etc.)
    ↓
Event Observer captures event
    ↓
Classify event type
    ↓
Update relevant stores:
  - Meta State (identity, projects, goals)
  - Decision Ledger (if decision detected)
  - Mem0 (facts, relationships)
  - Lineage Engine (if significant)
    ↓
Continue
```

#### Context Compaction
```
session_before_compact event
    ↓
SAC: Capture current state
    ↓
SAC: Generate lineage epoch
  - Summary from Pi's compaction
  - Extract decisions, goals, relationships
  - Link to previous epoch
    ↓
SAC: Store epoch to ~/.general-v1/sac/lineage/
    ↓
Allow Pi compaction to proceed
    ↓
session_compact event
    ↓
SAC: Link epoch to Pi's CompactionEntry.id
```

#### Memory Question Flow
```
User asks memory question
    ↓
Memory Question Router detects intent
  (patterns: "why did we decide", "what happened", etc.)
    ↓
Retrieval Pipeline executes:
  1. Query Meta State
  2. Query Goals
  3. Query Decision Ledger
  4. Query Mem0
  5. Query relevant Lineage Epochs
    ↓
Assemble Memory Context
    ↓
Invoke Memory Sub-Agent (via sub-agent extension)
    ↓
Synthesize human-like answer
    ↓
Return to Pi → Pi responds naturally
```

### Component Interactions

#### Event Observer
- Subscribes to all Pi lifecycle events
- Classifies and emits structured MemoryEvents
- Runs in-band for session events, out-of-band for tool events

#### Meta State Store
- Single source of truth for identity, projects, goals, open loops, relationships
- Loaded at session_start, persisted on every update
- Injected into snapshot at session_start and before_agent_start

#### Decision Ledger
- Append-only log of decisions
- Extracted from conversations and tool outputs
- Queried by retrieval pipeline

#### Lineage Engine
- Creates epochs on every compaction
- Maintains parent-child relationships between epochs
- Stores to ~/.general-v1/sac/lineage/

#### Mem0 Bridge
- Abstracts Mem0 API
- Stores facts, preferences, relationships
- Provides semantic search for retrieval pipeline

#### Retrieval Pipeline
- 8-stage ordered retrieval
- Stages: MetaState → Goals → Decisions → Mem0 → Lineage → Reconstruct → Synth → Return
- Returns assembled context for memory questions

#### Snapshot Service
- Generates cognitive snapshot from meta state
- Formats for human readability
- Injects via before_agent_start hook

#### Meta Memory Agent
- Uses existing sub-agent extension
- Invokes "memory" agent with assembled context
- Synthesizes conversational response

### Integration with Other Modules

#### mem0/
- SAC uses mem0 for semantic memory (facts, relationships)
- Mem0 handles embedding + retrieval
- SAC manages high-level cognitive state

#### sub-agent/
- SAC adds "memory" agent to v1/sub-agent/src/agents/
- Memory agent invoked via pi-subagent tool
- SAC passes assembled context as task input

#### communication/
- Optional: SAC meta state can stream to SuperHive
- Goals, decisions, relationships visible in SuperHive UI
- Not required for core functionality

#### planning/
- Goals feed into planning module
- Decisions tracked during planning phases
- Lineage preserves planning history

### Security and Privacy

- All data stored locally in ~/.general-v1/sac/
- No external network calls (except Mem0 if configured)
- Session data never leaves the machine
- Configurable storage path
