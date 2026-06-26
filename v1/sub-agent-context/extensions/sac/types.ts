export type EventType =
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

export interface MemoryEvent {
  event_id: string;
  timestamp: number;
  event_type: EventType;
  content: string;
  project?: string;
  session_id: string;
  session_entry_id?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface Identity {
  role: string;
  responsibilities: string[];
  expertise: string[];
  behavioral_traits: string[];
  working_style: string;
}

export interface Project {
  project_id: string;
  name: string;
  status: "active" | "paused" | "completed" | "abandoned";
  priority: "low" | "medium" | "high" | "critical";
  recent_activity: string;
  created_at: number;
  updated_at: number;
}

export interface Goal {
  goal_id: string;
  title: string;
  status: "in_progress" | "blocked" | "achieved" | "abandoned";
  priority: "low" | "medium" | "high" | "critical";
  progress: number;
  blockers: string[];
  project_id?: string;
  created_at: number;
  updated_at: number;
}

export interface OpenLoop {
  loop_id: string;
  description: string;
  type: "waiting_for_review" | "need_feedback" | "need_implementation" | "need_deployment" | "other";
  status: "open" | "resolved";
  created_at: number;
  resolved_at?: number;
}

export interface Relationship {
  relationship_id: string;
  entity_name: string;
  relationship_type: "person" | "team" | "client" | "stakeholder" | "external";
  importance: "low" | "medium" | "high";
  interaction_count: number;
  last_interaction: number;
  notes: string;
  trust_score: number;
}

export interface MetaState {
  identity: Identity;
  projects: Project[];
  goals: Goal[];
  open_loops: OpenLoop[];
  relationships: Relationship[];
  recent_decisions: string[];
  active_focus: string[];
  current_context_summary: string;
  updated_at: number;
}

export interface Decision {
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

export interface Epoch {
  epoch_id: string;
  parent_epoch_id: string | null;
  created_at: number;
  summary: string;
  memory_refs: string[];
  decisions: string[];
  goals: string[];
  relationships: string[];
  compaction_entry_id: string;
  tokens_before: number;
  project?: string;
}

export interface CognitiveSnapshot {
  generated_at: number;
  identity: Identity;
  active_projects: Project[];
  active_goals: Goal[];
  open_loops: OpenLoop[];
  recent_decisions: Decision[];
  important_relationships: Relationship[];
  recent_learnings: string[];
  current_focus: string[];
  current_context_summary: string;
}

export interface SACConfig {
  storagePath: string;
  autoSnapshot: boolean;
  autoLineage: boolean;
  memoryQuestionDetection: {
    enabled: boolean;
    patterns: string[];
  };
  metaMemoryAgent: string;
  snapshotFormat: "concise" | "detailed";
  maxRecentDecisions: number;
}

export interface SemanticHit {
  id: string;
  type: string;
  title: string;
  content: string;
  source: string;
  source_id: string;
  project?: string;
  session_id: string;
  created_at: number;
  score: number;
}

export interface RetrievalContext {
  question: string;
  meta_state?: MetaState;
  goals?: Goal[];
  decisions?: Decision[];
  lineage_epochs?: Epoch[];
  recent_activity?: string;
  semantic_hits?: SemanticHit[];
}

export interface ObservedEvent {
  type: EventType;
  timestamp: number;
  content: string;
  session_id: string;
  session_entry_id?: string;
  project?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export function createDefaultMetaState(): MetaState {
  return {
    identity: {
      role: "Digital Employee",
      responsibilities: [],
      expertise: [],
      behavioral_traits: ["methodical", "documented", "collaborative"],
      working_style: "structured",
    },
    projects: [],
    goals: [],
    open_loops: [],
    relationships: [],
    recent_decisions: [],
    active_focus: [],
    current_context_summary: "",
    updated_at: Date.now(),
  };
}

export function createDefaultConfig(): SACConfig {
  return {
    storagePath: "~/.general-v1/sac/",
    autoSnapshot: true,
    autoLineage: true,
    memoryQuestionDetection: {
      enabled: true,
      patterns: [
        "why did we decide",
        "what happened",
        "what were we working on",
        "what changed",
        "what are our active goals",
        "who is",
        "when did we",
        "what is the history of",
      ],
    },
    metaMemoryAgent: "memory",
    snapshotFormat: "concise",
    maxRecentDecisions: 20,
  };
}
