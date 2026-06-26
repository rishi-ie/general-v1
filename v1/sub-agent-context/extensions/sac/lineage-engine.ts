import { ulid } from "ulid";
import type { EventObserver } from "./event-observer";
import { getMetaState } from "./meta-state";
import { ensureStorageDir, listEpochs, readEpoch, writeEpoch } from "./storage/store";
import type { Epoch } from "./types";
import type { ObservedEvent } from "./types";

const epochs: Map<string, Epoch> = new Map();
let latestEpochId: string | null = null;
let config: { storagePath?: string; autoLineage?: boolean } = {};
let pendingEpoch: Partial<Epoch> | null = null;
let observer: EventObserver;

function log(msg: string, data?: Record<string, unknown>): void {
  console.log(`[sac] ${msg}`, data ?? {});
}

export async function loadLineage(basePath?: string): Promise<void> {
  await ensureStorageDir(basePath);
  const ids = await listEpochs(basePath);
  epochs.clear();
  latestEpochId = null;

  for (const id of ids) {
    const epoch = await readEpoch<Epoch>(id, basePath);
    if (epoch) {
      epochs.set(id, epoch);
      if (!latestEpochId || epoch.created_at > (epochs.get(latestEpochId)?.created_at ?? 0)) {
        latestEpochId = id;
      }
    }
  }
  log("lineage loaded", { epoch_count: epochs.size, latest: latestEpochId });
}

export function getLatestEpoch(): Epoch | null {
  if (!latestEpochId) return null;
  return epochs.get(latestEpochId) ?? null;
}

export function getEpoch(epochId: string): Epoch | null {
  return epochs.get(epochId) ?? null;
}

export function getAllEpochs(): Epoch[] {
  return Array.from(epochs.values()).sort((a, b) => b.created_at - a.created_at);
}

export function getEpochsByProject(project: string): Epoch[] {
  return Array.from(epochs.values())
    .filter((e) => e.project === project)
    .sort((a, b) => b.created_at - a.created_at);
}

export async function createEpoch(
  parentEpochId: string | null,
  summary: string,
  tokensBefore: number,
  options?: {
    memoryRefs?: string[];
    decisions?: string[];
    goals?: string[];
    relationships?: string[];
    project?: string;
  },
): Promise<Epoch> {
  const epochId = ulid();
  const epoch: Epoch = {
    epoch_id: epochId,
    parent_epoch_id: parentEpochId,
    created_at: Date.now(),
    summary,
    memory_refs: options?.memoryRefs ?? [],
    decisions: options?.decisions ?? [],
    goals: options?.goals ?? [],
    relationships: options?.relationships ?? [],
    compaction_entry_id: "",
    tokens_before: tokensBefore,
    project: options?.project,
  };

  epochs.set(epochId, epoch);
  latestEpochId = epochId;
  await writeEpoch(epochId, epoch, config.storagePath);
  log("epoch created", { epoch_id: epochId, parent: parentEpochId, tokens_before: tokensBefore });

  return epoch;
}

export async function linkEpochToCompaction(epochId: string, compactionEntryId: string): Promise<void> {
  const epoch = epochs.get(epochId);
  if (epoch) {
    epoch.compaction_entry_id = compactionEntryId;
    epochs.set(epochId, epoch);
    await writeEpoch(epochId, epoch, config.storagePath);
    log("epoch linked to compaction", { epoch_id: epochId, compaction_entry_id: compactionEntryId });
  }
}

export function capturePreCompactionState(tokensBefore: number): string {
  if (!config.autoLineage) return "";

  const parentEpochId = latestEpochId;
  const metaState = getMetaState();
  const activeGoals = metaState.goals.filter((g) => g.status === "in_progress").map((g) => g.goal_id);
  const recentDecisions = metaState.recent_decisions.slice(0, 10);

  pendingEpoch = {
    parent_epoch_id: parentEpochId,
    created_at: Date.now(),
    summary: "",
    memory_refs: [],
    decisions: recentDecisions,
    goals: activeGoals,
    relationships: [],
    compaction_entry_id: "",
    tokens_before: tokensBefore,
    project: metaState.projects.find((p) => p.status === "active")?.name,
  };

  return parentEpochId;
}

export function finalizeEpochWithSummary(summary: string): Epoch | null {
  if (!pendingEpoch) return null;

  const parentEpochId = pendingEpoch.parent_epoch_id ?? null;
  const tokensBefore = pendingEpoch.tokens_before ?? 0;
  const options = {
    memoryRefs: pendingEpoch.memory_refs,
    decisions: pendingEpoch.decisions,
    goals: pendingEpoch.goals,
    relationships: pendingEpoch.relationships,
    project: pendingEpoch.project,
  };

  pendingEpoch = null;
  return createEpoch(parentEpochId, summary, tokensBefore, options);
}

export async function handleCompactionEvent(event: ObservedEvent): Promise<void> {
  if (event.metadata?.compactionEntryId && pendingEpoch) {
    const epoch = finalizeEpochWithSummary(event.content);
    if (epoch) {
      await linkEpochToCompaction(epoch.epoch_id, String(event.metadata.compactionEntryId));
    }
  }
}

export function initLineageEngineModule(
  obs: EventObserver,
  cfg: { storagePath?: string; autoLineage?: boolean },
): void {
  config = cfg;
  observer = obs;
}
