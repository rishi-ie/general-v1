# Sub-Agent Context — Implementation Guide

## Building and Running SAC

### Prerequisites

- Node.js 20+
- pnpm (or npm)
- Pi Agent installed (`@earendil-works/pi-coding-agent`)
- General V1 stack with mem0 and sub-agent modules

### Directory Structure

```
v1/sub-agent-context/
├── SKILL.md
├── README.md
├── package.json
├── config.json
├── schema.json
├── spec/
│   ├── INDEX.md
│   ├── ARCHITECTURE.md
│   ├── SCHEMA.md
│   ├── STATE.md
│   ├── INTEGRATION.md
│   └── IMPLEMENTATION.md
└── extensions/
    └── sac/
        ├── index.ts              # Main entry
        ├── types.ts              # All types
        ├── event-observer.ts     # Event capture
        ├── meta-state.ts         # Identity, projects, goals
        ├── decision-ledger.ts    # Decision storage
        ├── lineage-engine.ts     # Compaction epochs
        ├── snapshot-service.ts   # Startup snapshot
        ├── mem0-bridge.ts        # Mem0 integration
        ├── retrieval-pipeline.ts # 8-step retrieval
        ├── memory-question-router.ts # Intent detection
        ├── meta-memory-agent.ts  # Sub-agent invocation
        └── storage/
            ├── store.ts          # JSON persistence
            └── paths.ts          # Path constants
```

### Build

No build step required — pi extensions use TypeScript directly via jiti.

```bash
# Install dependencies (if any)
pnpm install

# Test loading
pi -e ./extensions/sac/index.ts
```

### Loading in Pi

Add to meta-agent config or load directly:

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

### Dependencies

```json
{
  "dependencies": {
    "ulid": "^1.1.0"
  },
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": ">=0.74.0"
  }
}
```

### Configuration

`config.json`:

```json
{
  "storagePath": "~/.general-v1/sac/",
  "mem0Enabled": true,
  "autoSnapshot": true,
  "autoLineage": true,
  "memoryQuestionDetection": {
    "enabled": true,
    "patterns": [
      "why did we decide",
      "what happened",
      "what were we working on",
      "what changed",
      "what are our active goals",
      "who is",
      "when did we",
      "what is the history of"
    ]
  },
  "metaMemoryAgent": "memory",
  "snapshotFormat": "concise",
  "maxRecentDecisions": 20
}
```

### Storage Initialization

On first load, SAC creates:

```
~/.general-v1/sac/
├── meta-state.json       # Created with default identity
├── decision-ledger.json  # Empty array
└── lineage/              # Empty directory
```

### Adding the Memory Sub-Agent

Copy `v1/sub-agent-context/agents/memory.md` to:

```
v1/sub-agent/src/agents/memory.md
```

This registers the memory agent with pi-subagents.

### Key Implementation Notes

#### Event Handler Registration

SAC registers all handlers in the extension factory:

```typescript
export default function (pi: ExtensionAPI) {
  pi.on("session_start", onSessionStart);
  pi.on("before_agent_start", onBeforeAgentStart);
  pi.on("agent_end", onAgentEnd);
  pi.on("turn_end", onTurnEnd);
  pi.on("session_before_compact", onSessionBeforeCompact);
  pi.on("session_compact", onSessionCompact);
  pi.on("session_shutdown", onSessionShutdown);
}
```

#### Storage Pattern

All storage uses atomic writes:

```typescript
// Write to temp, then rename (atomic on POSIX)
const tmp = path.join(dir, `.${filename}.tmp`);
await fs.writeFile(tmp, JSON.stringify(data));
await fs.rename(tmp, path.join(dir, filename));
```

#### Debounced Persistence

Meta state updates are debounced (500ms) to avoid excessive writes:

```typescript
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistMetaState();
    persistTimer = null;
  }, 500);
}
```

#### Mem0 API Usage

Mem0 is called with messages in the format:

```typescript
await mem0.add({
  user_id: sessionId,
  messages: [
    { role: "user", content: "User said: ..." },
    { role: "assistant", content: "Pi said: ..." }
  ]
});
```

Search:

```typescript
const results = await mem0.search({
  query: question,
  user_id: sessionId,
  top_k: 10
});
```

#### Cognitive Snapshot Format

Concise format (default):

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
- Use Mem0 for semantic memory
- Adopt lineage model for context preservation
- Copy pi-subagents directly (not git submodule)

Current Context: Implementing sub-agent-context module
```

### Testing

```bash
# Load extension
pi -e ./extensions/sac/index.ts

# Session start should:
# 1. Load/create meta-state.json
# 2. Create lineage/ directory if missing

# Ask a memory question:
# "Why did we decide to use Mem0?"
# Should trigger retrieval pipeline

# Trigger compaction:
# /compact
# Should create epoch in lineage/
```

### Debugging

SAC logs to console with `[sac]` prefix:

```typescript
function log(msg: string, data?: Record<string, unknown>): void {
  console.log(`[sac] ${msg}`, data ?? {});
}
```

Check for:
- `[sac] session_start` — Meta state loaded
- `[sac] snapshot generated` — Snapshot created
- `[sac] injecting snapshot` — Snapshot injected into system prompt
- `[sac] decision extracted` — Decision stored
- `[sac] epoch created` — Lineage epoch saved
- `[sac] memory question detected` — Routing triggered
- `[sac] retrieval complete` — Pipeline finished
