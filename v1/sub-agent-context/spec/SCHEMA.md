# Sub-Agent Context — Schema

## All TypeScript Types

### MemoryEvent

```typescript
type EventType =
  | "user_message"
  | "agent_response"
  | "tool_output"
  | "task_complete"
  | "code_generation"
  | "file_modification"
  | "decision"
  | "goal_update"
  | "relationship_update"
  | "compaction"
  | "session_start"
  | "session_shutdown";

interface MemoryEvent {
  event_id: string;          // ULID
  timestamp: number;         // Unix ms
  event_type: EventType;
  content: string;           // Truncated to 2000 chars
  project?: string;          // Project name
  session_id: string;        // Pi session ID
  session_entry_id?: string; // Pi session entry reference
  tags?: string[];           // Auto-extracted tags
  metadata?: Record<string, unknown>;
}
```

### MetaState

```typescript
interface MetaState {
  identity: Identity;
  projects: Project[];
  goals: Goal[];
  open_loops: OpenLoop[];
  relationships: Relationship[];
  recent_decisions: string[]; // decision_ids (most recent first)
  active_focus: string[];     // Current priorities
  current_context_summary: string;
  updated_at: number;
}

interface Identity {
  role: string;
  responsibilities: string[];
  expertise: string[];
  behavioral_traits: string[];
  working_style: string;
}

interface Project {
  project_id: string;
  name: string;
  status: "active" | "paused" | "completed" | "abandoned";
  priority: "low" | "medium" | "high" | "critical";
  recent_activity: string;
  created_at: number;
  updated_at: number;
}

interface Goal {
  goal_id: string;
  title: string;
  status: "in_progress" | "blocked" | "achieved" | "abandoned";
  priority: "low" | "medium" | "high" | "critical";
  progress: number;          // 0-100
  blockers: string[];
  project_id?: string;
  created_at: number;
  updated_at: number;
}

interface OpenLoop {
  loop_id: string;
  description: string;
  type: "waiting_for_review" | "need_feedback" | "need_implementation" | "need_deployment" | "other";
  status: "open" | "resolved";
  created_at: number;
  resolved_at?: number;
}

interface Relationship {
  relationship_id: string;
  entity_name: string;
  relationship_type: "person" | "team" | "client" | "stakeholder" | "external";
  importance: "low" | "medium" | "high";
  interaction_count: number;
  last_interaction: number;
  notes: string;
  trust_score: number;       // 0-1
}
```

### Decision

```typescript
interface Decision {
  decision_id: string;
  title: string;
  decision: string;
  reasoning: string;
  evidence: string[];
  confidence: "low" | "medium" | "high";
  outcome?: string;
  timestamp: number;
  epoch_id?: string;
  project_id?: string;
}
```

### Epoch

```typescript
interface Epoch {
  epoch_id: string;          // ULID
  parent_epoch_id: string | null;
  created_at: number;
  summary: string;           // Generated summary
  memory_refs: string[];    // Mem0 memory IDs
  decisions: string[];       // decision_ids
  goals: string[];          // goal_ids
  relationships: string[];   // relationship_ids
  compaction_entry_id: string; // Pi's compaction entry id (filled later)
  tokens_before: number;
  project?: string;
}
```

### CognitiveSnapshot

```typescript
interface CognitiveSnapshot {
  generated_at: number;
  identity: Identity;
  active_projects: Project[];
  active_goals: Goal[];
  open_loops: OpenLoop[];
  recent_decisions: Decision[];  // Full objects (limited to 10)
  important_relationships: Relationship[]; // Limited to top 10
  recent_learnings: string[];
  current_focus: string[];
  current_context_summary: string;
}
```

### SACConfig

```typescript
interface SACConfig {
  storagePath: string;        // Default: ~/.general-v1/sac/
  mem0Enabled: boolean;
  autoSnapshot: boolean;
  autoLineage: boolean;
  memoryQuestionDetection: {
    enabled: boolean;
    patterns: string[];
  };
  metaMemoryAgent: string;   // Default: "memory"
  snapshotFormat: "concise" | "detailed";
  maxRecentDecisions: number; // Default: 20
}
```

### RetrievalContext

```typescript
interface RetrievalContext {
  question: string;
  meta_state?: MetaState;
  goals?: Goal[];
  decisions?: Decision[];
  mem0_memories?: Mem0Memory[];
  lineage_epochs?: Epoch[];
  recent_activity?: string;
}
```

### Mem0Memory (interface for mem0 response)

```typescript
interface Mem0Memory {
  id: string;
  text: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}
```

### StorageFileFormat

```typescript
interface StorageFormat {
  version: 1;
  meta_state: MetaState;
  decision_ledger: Decision[];
  lineage_index: {
    latest_epoch_id: string | null;
    epoch_count: number;
  };
}
```

### EventObserverEvent

```typescript
interface ObservedEvent {
  type: EventType;
  timestamp: number;
  content: string;
  session_id: string;
  session_entry_id?: string;
  project?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}
```
