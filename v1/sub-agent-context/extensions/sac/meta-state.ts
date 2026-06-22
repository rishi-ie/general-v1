import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { ulid } from "ulid";
import {
  type MetaState,
  type Identity,
  type Project,
  type Goal,
  type OpenLoop,
  type Relationship,
  createDefaultMetaState,
} from "./types";
import {
  ensureStorageDir,
  readMetaState,
  writeMetaState,
} from "./storage/store";
import { EventObserver, classifyContent } from "./event-observer";
import type { ObservedEvent } from "./types";

let metaState: MetaState = createDefaultMetaState();
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let config: { storagePath?: string } = {};

function log(msg: string, data?: Record<string, unknown>): void {
  console.log(`[sac] ${msg}`, data ?? {});
}

function schedulePersist(basePath?: string): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(async () => {
    try {
      await writeMetaState(metaState, basePath);
      log("meta state persisted", { updated_at: metaState.updated_at });
    } catch (err) {
      console.error(`[sac] persist error:`, err);
    }
    persistTimer = null;
  }, 500);
}

async function handleEvent(event: ObservedEvent): Promise<void> {
  switch (event.type) {
    case "user_message":
      metaState.current_context_summary = event.content.slice(0, 500);
      metaState.updated_at = Date.now();
      schedulePersist(config.storagePath);
      break;

    case "agent_response":
      metaState.current_context_summary = event.content.slice(0, 500);
      metaState.updated_at = Date.now();
      schedulePersist(config.storagePath);
      break;

    case "decision":
      if (event.metadata?.title) {
        const goal: Goal = {
          goal_id: ulid(),
          title: String(event.metadata.title),
          status: "in_progress",
          priority: "medium",
          progress: 0,
          blockers: [],
          created_at: Date.now(),
          updated_at: Date.now(),
        };
        metaState.goals.push(goal);
        metaState.active_focus.push(goal.goal_id);
        metaState.updated_at = Date.now();
        schedulePersist(config.storagePath);
      }
      break;

    case "goal_update":
      if (event.metadata?.goal_id) {
        const goal = metaState.goals.find((g) => g.goal_id === event.metadata?.goal_id);
        if (goal && event.metadata?.status) {
          goal.status = String(event.metadata.status) as Goal["status"];
          goal.updated_at = Date.now();
          metaState.updated_at = Date.now();
          schedulePersist(config.storagePath);
        }
      }
      break;

    case "session_start":
      metaState.current_context_summary = "";
      metaState.updated_at = Date.now();
      break;

    case "session_shutdown":
      if (persistTimer) {
        clearTimeout(persistTimer);
        persistTimer = null;
      }
      await writeMetaState(metaState, config.storagePath);
      break;
  }
}

export async function loadMetaState(basePath?: string): Promise<MetaState> {
  const loaded = await readMetaState<MetaState>(basePath);
  if (loaded) {
    metaState = loaded;
    log("meta state loaded", { updated_at: metaState.updated_at });
  } else {
    metaState = createDefaultMetaState();
    await ensureStorageDir(basePath);
    await writeMetaState(metaState, basePath);
    log("meta state created", { created: true });
  }
  return metaState;
}

export function getMetaState(): MetaState {
  return metaState;
}

export function updateIdentity(identity: Partial<Identity>): void {
  metaState.identity = { ...metaState.identity, ...identity };
  metaState.updated_at = Date.now();
  schedulePersist(config.storagePath);
}

export function addProject(project: Omit<Project, "project_id" | "created_at" | "updated_at">): Project {
  const p: Project = {
    ...project,
    project_id: ulid(),
    created_at: Date.now(),
    updated_at: Date.now(),
  };
  metaState.projects.push(p);
  metaState.updated_at = Date.now();
  schedulePersist(config.storagePath);
  return p;
}

export function updateProject(projectId: string, updates: Partial<Project>): void {
  const idx = metaState.projects.findIndex((p) => p.project_id === projectId);
  if (idx >= 0) {
    metaState.projects[idx] = { ...metaState.projects[idx], ...updates, updated_at: Date.now() };
    metaState.updated_at = Date.now();
    schedulePersist(config.storagePath);
  }
}

export function addGoal(goal: Omit<Goal, "goal_id" | "created_at" | "updated_at">): Goal {
  const g: Goal = {
    ...goal,
    goal_id: ulid(),
    created_at: Date.now(),
    updated_at: Date.now(),
  };
  metaState.goals.push(g);
  metaState.updated_at = Date.now();
  schedulePersist(config.storagePath);
  return g;
}

export function updateGoal(goalId: string, updates: Partial<Goal>): void {
  const idx = metaState.goals.findIndex((g) => g.goal_id === goalId);
  if (idx >= 0) {
    metaState.goals[idx] = { ...metaState.goals[idx], ...updates, updated_at: Date.now() };
    metaState.updated_at = Date.now();
    schedulePersist(config.storagePath);
  }
}

export function addOpenLoop(loop: Omit<OpenLoop, "loop_id" | "created_at" | "status">): OpenLoop {
  const l: OpenLoop = {
    ...loop,
    loop_id: ulid(),
    status: "open",
    created_at: Date.now(),
  };
  metaState.open_loops.push(l);
  metaState.updated_at = Date.now();
  schedulePersist(config.storagePath);
  return l;
}

export function resolveOpenLoop(loopId: string): void {
  const loop = metaState.open_loops.find((l) => l.loop_id === loopId);
  if (loop) {
    loop.status = "resolved";
    loop.resolved_at = Date.now();
    metaState.updated_at = Date.now();
    schedulePersist(config.storagePath);
  }
}

export function addRelationship(rel: Omit<Relationship, "relationship_id">): Relationship {
  const r: Relationship = {
    ...rel,
    relationship_id: ulid(),
  };
  metaState.relationships.push(r);
  metaState.updated_at = Date.now();
  schedulePersist(config.storagePath);
  return r;
}

export function incrementRelationship(entityName: string): void {
  const rel = metaState.relationships.find((r) => r.entity_name === entityName);
  if (rel) {
    rel.interaction_count++;
    rel.last_interaction = Date.now();
    metaState.updated_at = Date.now();
    schedulePersist(config.storagePath);
  }
}

export function addRecentDecision(decisionId: string): void {
  metaState.recent_decisions.unshift(decisionId);
  if (metaState.recent_decisions.length > 50) {
    metaState.recent_decisions = metaState.recent_decisions.slice(0, 50);
  }
  metaState.updated_at = Date.now();
  schedulePersist(config.storagePath);
}

export function setActiveFocus(focus: string[]): void {
  metaState.active_focus = focus;
  metaState.updated_at = Date.now();
  schedulePersist(config.storagePath);
}

export function setContextSummary(summary: string): void {
  metaState.current_context_summary = summary;
  metaState.updated_at = Date.now();
  schedulePersist(config.storagePath);
}

export function initMetaStateModule(
  observer: EventObserver,
  cfg: { storagePath?: string }
): void {
  config = cfg;
  observer.onEvent(handleEvent);
}
