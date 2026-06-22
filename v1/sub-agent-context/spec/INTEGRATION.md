# Sub-Agent Context — Integration

## Integration with mem0/

### Purpose
Mem0 handles semantic memory — facts, preferences, relationships. SAC manages high-level cognitive state (identity, projects, goals, decisions).

### Integration Points

**Storage:**
- SAC stores structured cognitive state in `~/.general-v1/sac/` (JSON files)
- Mem0 stores embeddings and semantic facts in its own storage
- They are complementary, not overlapping

**API:**
- SAC calls Mem0 API for storing and retrieving semantic memories
- Mem0 provides embedding + hybrid search
- SAC provides structured cognitive state

**Flow:**
```
SAC Event Observer captures event
    ↓
SAC extracts: facts, relationships, preferences
    ↓
SAC → Mem0: mem0.add({ user_id, messages: [...] })
    ↓
SAC updates Meta State (projects, goals, etc.)
    ↓
SAC → Mem0: mem0.search({ query, user_id }) when retrieving
    ↓
Mem0 returns relevant memories
    ↓
SAC assembles RetrievalContext → Memory Sub-Agent
```

### Mem0 Configuration

Mem0 is configured separately in `v1/mem0/config.json`. SAC reads this config and uses the Mem0 API.

**Environment variables expected by Mem0:**
- `OPENAI_API_KEY` or similar (depending on mem0 provider config)

### What SAC Stores in Mem0

- Facts extracted from conversations
- Preferences mentioned by user
- Relationship information
- Project details
- Learnings and patterns

### What SAC Manages Directly (NOT in Mem0)

- Identity (role, responsibilities, expertise)
- Projects (status, priority, recent activity)
- Goals (progress, blockers, milestones)
- Open loops (waiting items)
- Decisions (with reasoning and evidence)
- Lineage epochs (compaction history)

## Integration with sub-agent/

### Purpose
SAC uses the existing sub-agent extension to invoke the "memory" sub-agent for synthesizing responses to memory questions.

### Integration Points

**Memory Sub-Agent:**
- SAC creates `v1/sub-agent/src/agents/memory.md`
- This agent is invoked via `subagent({ agent: "memory", task: ... })`
- Response is parsed and returned to Pi

**Flow:**
```
Retrieval Pipeline completes
    ↓
SAC assembles RetrievalContext
    ↓
SAC calls: subagent({
  agent: "memory",
  task: `Question: ${question}\n\nContext: ${assembledContext}`
})
    ↓
Memory Sub-Agent responds
    ↓
SAC extracts response
    ↓
Return to Pi
```

### Memory Agent Task Format

The memory agent receives a task with:
- The original question
- Pre-fetched context from all stores
- Instructions to synthesize naturally

## Integration with communication/

### Optional: Meta State Streaming

SAC can optionally stream meta state to SuperHive for visibility in the desktop app UI.

**Flow (optional):**
```
Meta State updated
    ↓
SAC detects change
    ↓
SAC → communication/ socket: AGENT_STATE with meta_state update
    ↓
SuperHive UI shows cognitive state
```

**This is NOT required for core SAC functionality.**

## Integration with planning/

### Goals Feed Into Planning

SAC goals are loaded at session start. When Pi plans, it has access to:
- Active goals
- Goal progress
- Blockers

### Decisions Tracked During Planning

When planning module creates a plan, SAC can:
- Detect decision points
- Extract the decision and reasoning
- Store in Decision Ledger

### Lineage Preserves Planning History

Every compaction epoch preserves what was being worked on. This includes planning discussions.

## Integration with permission/

### No Direct Integration

SAC does not directly integrate with permission/. Permission requests flow through communication/ as specified in the architecture.

SAC may emit memory-related permission requests if configured to do so.

## Data Flow Summary

```
Pi Events
    ↓
Event Observer
    ↓
┌───────────────────────────────────────────┐
│              SAC Core                      │
│                                            │
│  ┌─────────────┐      ┌────────────────┐  │
│  │  Meta State │ ←→  │    Mem0        │  │
│  │  Store      │      │  (semantic)    │  │
│  └─────────────┘      └────────────────┘  │
│         ↓                                    │
│  ┌─────────────┐      ┌────────────────┐    │
│  │  Decision   │      │  Lineage       │    │
│  │  Ledger     │      │  Engine        │    │
│  └─────────────┘      └────────────────┘    │
│         ↓                                    │
│  ┌─────────────────────────────────────┐   │
│  │        Retrieval Pipeline            │   │
│  └─────────────────────────────────────┘   │
│         ↓                                    │
│  ┌─────────────────────────────────────┐   │
│  │    Memory Question Router           │   │
│  └─────────────────────────────────────┘   │
│         ↓                                    │
│  ┌─────────────────────────────────────┐   │
│  │    Meta Memory Sub-Agent            │   │
│  │    (via sub-agent extension)       │   │
│  └─────────────────────────────────────┘   │
│                                            │
└───────────────────────────────────────────┘
    ↓
Storage
```
