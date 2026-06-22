import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { ulid } from "ulid";
import {
  type SACConfig,
  type ObservedEvent,
  createDefaultConfig,
} from "./types";
import { createEventObserver, classifyContent } from "./event-observer";
import {
  loadMetaState,
  getMetaState,
  setContextSummary,
  initMetaStateModule,
} from "./meta-state";
import {
  loadDecisionLedger,
  initDecisionLedgerModule,
  addDecision,
} from "./decision-ledger";
import {
  loadLineage,
  initLineageEngineModule,
  capturePreCompactionState,
  finalizeEpochWithSummary,
  linkEpochToCompaction,
} from "./lineage-engine";
import {
  initSnapshotService,
  generateSnapshot,
  formatSnapshot,
} from "./snapshot-service";
import { initMem0Bridge, addMemory, searchMemories } from "./mem0-bridge";
import { initMemoryQuestionRouter, isMemoryQuestion } from "./memory-question-router";
import { retrieve, assembleContextText } from "./retrieval-pipeline";
import { initMetaMemoryAgentModule } from "./meta-memory-agent";
import { getMetaStatePath, getDecisionLedgerPath, getLineagePath } from "./storage/paths";
import { ensureStorageDir } from "./storage/store";

let config: SACConfig = createDefaultConfig();
let observer = createEventObserver();
let sessionId: string = "";
let isProcessingMemory: boolean = false;

function log(msg: string, data?: Record<string, unknown>): void {
  console.log(`[sac] ${msg}`, data ?? {});
}

async function loadConfig(basePath?: string): Promise<SACConfig> {
  const configPath = basePath ?? config.storagePath;
  const defaultPath = getMetaStatePath(configPath).replace("/meta-state.json", "/config.json");
  try {
    const { readJsonFile } = await import("./storage/store");
    const loaded = await readJsonFile<SACConfig>(defaultPath);
    if (loaded) {
      return { ...createDefaultConfig(), ...loaded };
    }
  } catch {
  }
  return createDefaultConfig();
}

async function initStorage(): Promise<void> {
  await ensureStorageDir(config.storagePath);
  log("storage initialized", { path: config.storagePath });
}

async function handleSessionStart(ctx: ExtensionContext): Promise<void> {
  sessionId = ctx.sessionManager.getSessionFile() || ulid();
  observer.setSessionId(sessionId);

  await initStorage();
  await loadMetaState(config.storagePath);
  await loadDecisionLedger(config.storagePath);
  await loadLineage(config.storagePath);

  initMetaStateModule(observer, { storagePath: config.storagePath });
  initDecisionLedgerModule(observer, { storagePath: config.storagePath, maxRecentDecisions: config.maxRecentDecisions });
  initLineageEngineModule(observer, { storagePath: config.storagePath, autoLineage: config.autoLineage });

  await initMem0Bridge();
  initSnapshotService({ snapshotFormat: config.snapshotFormat, maxRecentDecisions: config.maxRecentDecisions });
  initMemoryQuestionRouter(config.memoryQuestionDetection);
  initMetaMemoryAgentModule({ metaMemoryAgent: config.metaMemoryAgent }, ctx.pi);

  await observer.emitSessionStart(ctx);

  log("session initialized", { session_id: sessionId });
}

async function handleBeforeAgentStart(
  event: { prompt: string; systemPrompt: string },
  ctx: ExtensionContext
): Promise<{ systemPrompt?: string; message?: unknown } | undefined> {
  if (!config.autoSnapshot) return;

  const snapshot = generateSnapshot();
  const snapshotText = formatSnapshot(snapshot);

  const injection = `\n\n## Cognitive Snapshot\n\n${snapshotText}\n\n(Use this context to maintain continuity with prior decisions, goals, and projects.)\n`;

  log("snapshot injected", { snapshot_length: snapshotText.length });

  return {
    systemPrompt: event.systemPrompt + injection,
  };
}

async function handleAgentEnd(
  event: { messages: Array<{ role: string; content?: string }> },
  ctx: ExtensionContext
): Promise<void> {
  const messages = event.messages ?? [];
  if (messages.length === 0) return;

  const userMsgs = messages.filter((m) => m.role === "user").map((m) => m.content ?? "").join("\n");
  const assistantMsgs = messages.filter((m) => m.role === "assistant").map((m) => m.content ?? "").join("\n");

  if (userMsgs) {
    setContextSummary(userMsgs.slice(0, 500));
  }

  if (config.mem0Enabled && sessionId) {
    const memMessages: Array<{ role: string; content: string }> = [];
    for (const m of messages) {
      if (m.content) {
        memMessages.push({ role: m.role, content: m.content });
      }
    }
    if (memMessages.length > 0) {
      await addMemory(sessionId, memMessages);
    }
  }

  await observer.emitAgentResponse(assistantMsgs.slice(0, 2000), ctx);

  log("agent end handled", { message_count: messages.length });
}

async function handleToolResult(
  event: { toolName: string; result: unknown },
  ctx: ExtensionContext
): Promise<void> {
  const content = typeof event.result === "string"
    ? event.result
    : JSON.stringify(event.result).slice(0, 2000);

  await observer.emitFromToolResult(event.toolName, content, ctx);

  if (config.mem0Enabled && sessionId) {
    await addMemory(sessionId, [
      { role: "tool", content: `[${event.toolName}] ${content}` },
    ]);
  }
}

async function handleSessionBeforeCompact(
  event: {
    preparation: {
      tokensBefore: number;
      messagesToSummarize?: Array<{ role: string; content?: string }>;
    };
  },
  ctx: ExtensionContext
): Promise<{ cancel?: boolean } | void> {
  if (!config.autoLineage) return;

  const { tokensBefore } = event.preparation;
  capturePreCompactionState(tokensBefore);

  log("pre-compaction captured", { tokens_before: tokensBefore });
}

async function handleSessionCompact(
  event: { compactionEntry?: { id: string; summary?: string } },
  ctx: ExtensionContext
): Promise<void> {
  if (!config.autoLineage) return;

  const summary = event.compactionEntry?.summary ?? "Compacted context";
  const epoch = finalizeEpochWithSummary(summary);

  if (epoch && event.compactionEntry?.id) {
    await linkEpochToCompaction(epoch.epoch_id, event.compactionEntry.id);
    log("compaction epoch created", { epoch_id: epoch.epoch_id, compaction_id: event.compactionEntry.id });
  }
}

async function handleSessionShutdown(ctx: ExtensionContext): Promise<void> {
  await observer.emitSessionShutdown(ctx);
  log("session shutdown");
}

async function handleInput(
  event: { text: string },
  ctx: ExtensionContext
): Promise<{ action: string } | undefined> {
  if (isProcessingMemory) return;
  if (!config.memoryQuestionDetection.enabled) return;
  if (!isMemoryQuestion(event.text)) return;

  isProcessingMemory = true;

  try {
    log("memory question intercepted", { text: event.text.slice(0, 50) });

    const context = await retrieve(event.text, sessionId);
    const contextText = assembleContextText(context);

    ctx.ui.notify("[sac] Memory question detected — context available", "info");

    log("memory retrieval complete", {
      text: event.text.slice(0, 50),
      goals: context.goals?.length ?? 0,
      decisions: context.decisions?.length ?? 0,
      epochs: context.lineage_epochs?.length ?? 0,
    });
  } catch (err) {
    log("memory question error", { error: String(err) });
  } finally {
    isProcessingMemory = false;
  }
}

export default async function (pi: ExtensionAPI): Promise<void> {
  const basePath = pi && typeof pi === "object" && "extensions" in pi
    ? (pi as ExtensionAPI & { extensions?: unknown }).extensions as unknown as { config?: { storagePath?: string } } | undefined
    : undefined;

  config = await loadConfig(basePath?.config?.storagePath);

  log("initializing", { version: "0.1.0", config });

  await initStorage();
  await initMem0Bridge();
  initSnapshotService({ snapshotFormat: config.snapshotFormat, maxRecentDecisions: config.maxRecentDecisions });
  initMemoryQuestionRouter(config.memoryQuestionDetection);

  pi.on("session_start", handleSessionStart as (event: unknown, ctx: ExtensionContext) => unknown);
  pi.on("before_agent_start", handleBeforeAgentStart as (event: unknown, ctx: ExtensionContext) => unknown);
  pi.on("agent_end", handleAgentEnd as (event: unknown, ctx: ExtensionContext) => unknown);
  pi.on("tool_result", handleToolResult as (event: unknown, ctx: ExtensionContext) => unknown);
  pi.on("session_before_compact", handleSessionBeforeCompact as (event: unknown, ctx: ExtensionContext) => unknown);
  pi.on("session_compact", handleSessionCompact as (event: unknown, ctx: ExtensionContext) => unknown);
  pi.on("session_shutdown", handleSessionShutdown as (event: unknown, ctx: ExtensionContext) => unknown);
  pi.on("input", handleInput as (event: unknown, ctx: ExtensionContext) => unknown);

  log("registered all event handlers");
}
