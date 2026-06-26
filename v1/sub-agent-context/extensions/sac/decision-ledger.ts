import { ulid } from "ulid";
import type { EventObserver } from "./event-observer";
import { addRecentDecision, getMetaState, schedulePersist as scheduleMetaPersist } from "./meta-state";
import { readDecisionLedger, writeDecisionLedger } from "./storage/store";
import { type Decision, type MetaState, createDefaultMetaState } from "./types";
import type { ObservedEvent } from "./types";

let decisions: Decision[] = [];
let config: { storagePath?: string; maxRecentDecisions?: number } = {};
let metaState: MetaState = createDefaultMetaState();

function log(msg: string, data?: Record<string, unknown>): void {
  console.log(`[sac] ${msg}`, data ?? {});
}

async function persist(): Promise<void> {
  try {
    await writeDecisionLedger(decisions, config.storagePath);
    log("decision ledger persisted", { count: decisions.length });
  } catch (err) {
    console.error(`[sac] decision ledger persist error:`, err);
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(persist, 500);
}

async function handleEvent(event: ObservedEvent): Promise<void> {
  if (event.type === "decision" && event.metadata) {
    const decision = createDecisionFromMetadata(event.metadata);
    if (decision) {
      decisions.push(decision);
      addRecentDecision(decision.decision_id);
      schedulePersist();
      log("decision stored", { decision_id: decision.decision_id, title: decision.title });
    }
  }
}

function createDecisionFromMetadata(metadata: Record<string, unknown>): Decision | null {
  if (!metadata.title && !metadata.decision) return null;

  return {
    decision_id: ulid(),
    title: String(metadata.title ?? metadata.decision ?? "Untitled Decision"),
    decision: String(metadata.decision ?? ""),
    reasoning: String(metadata.reasoning ?? ""),
    evidence: Array.isArray(metadata.evidence) ? metadata.evidence.map(String) : [],
    confidence: (metadata.confidence as Decision["confidence"]) ?? "medium",
    outcome: metadata.outcome ? String(metadata.outcome) : undefined,
    timestamp: Date.now(),
    project_id: metadata.project_id ? String(metadata.project_id) : undefined,
  };
}

export async function loadDecisionLedger(basePath?: string): Promise<Decision[]> {
  const loaded = await readDecisionLedger<Decision[]>(basePath);
  if (loaded && Array.isArray(loaded)) {
    decisions = loaded;
    log("decision ledger loaded", { count: decisions.length });
  } else {
    decisions = [];
    await writeDecisionLedger(decisions, basePath);
    log("decision ledger created", { created: true });
  }
  return decisions;
}

export function getDecisions(): Decision[] {
  return decisions;
}

export function getDecisionById(decisionId: string): Decision | undefined {
  return decisions.find((d) => d.decision_id === decisionId);
}

export function getRecentDecisions(limit = 20): Decision[] {
  return decisions.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

export function getDecisionsForEpoch(epochId: string): Decision[] {
  return decisions.filter((d) => d.epoch_id === epochId);
}

export function linkDecisionToEpoch(decisionId: string, epochId: string): void {
  const decision = decisions.find((d) => d.decision_id === decisionId);
  if (decision) {
    decision.epoch_id = epochId;
    schedulePersist();
  }
}

export function addDecision(decision: Omit<Decision, "decision_id" | "timestamp">): Decision {
  const d: Decision = {
    ...decision,
    decision_id: ulid(),
    timestamp: Date.now(),
  };
  decisions.push(d);
  addRecentDecision(d.decision_id);
  schedulePersist();
  log("decision added", { decision_id: d.decision_id, title: d.title });
  return d;
}

export function updateDecisionOutcome(decisionId: string, outcome: string): void {
  const decision = decisions.find((d) => d.decision_id === decisionId);
  if (decision) {
    decision.outcome = outcome;
    schedulePersist();
  }
}

export function setMetaStateGetter(getter: () => MetaState): void {
  metaState = getter();
}

export function initDecisionLedgerModule(
  observer: EventObserver,
  cfg: { storagePath?: string; maxRecentDecisions?: number },
): void {
  config = cfg;
  observer.onEvent(handleEvent);
}
