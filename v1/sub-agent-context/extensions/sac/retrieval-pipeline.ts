import { getDecisions, getRecentDecisions } from "./decision-ledger";
import { getAllEpochs, getEpochsByProject } from "./lineage-engine";
import { extractMemoryQuestionDetails } from "./memory-question-router";
import { getMetaState } from "./meta-state";
import type { Decision, Epoch, Goal, MetaState, RetrievalContext } from "./types";

function log(msg: string, data?: Record<string, unknown>): void {
  console.log(`[sac] ${msg}`, data ?? {});
}

export async function retrieve(question: string, sessionId: string): Promise<RetrievalContext> {
  log("retrieval started", { question: question.slice(0, 50), session_id: sessionId });

  const details = extractMemoryQuestionDetails(question);

  let meta_state: MetaState | undefined;
  let goals: Goal[] | undefined;
  let decisions: Decision[] | undefined;
  let lineage_epochs: Epoch[] | undefined;
  let recent_activity: string | undefined;

  meta_state = getMetaState();

  goals = meta_state.goals.filter((g) => g.status === "in_progress" || g.status === "blocked");

  if (details?.type === "decision_reasoning" || details?.type === "change_history") {
    decisions = getDecisions();
  } else {
    decisions = getRecentDecisions(20);
  }

  if (details?.type === "event_history" || details?.type === "project_history" || details?.type === "lineage") {
    if (details.subject) {
      lineage_epochs = getEpochsByProject(details.subject);
    } else {
      lineage_epochs = getAllEpochs().slice(0, 10);
    }
  } else {
    lineage_epochs = getAllEpochs().slice(0, 5);
  }

  const activeProjects = meta_state.projects.filter((p) => p.status === "active");
  if (activeProjects.length > 0) {
    recent_activity = activeProjects.map((p) => `${p.name}: ${p.recent_activity}`).join("; ");
  }

  const context: RetrievalContext = {
    question,
    meta_state,
    goals,
    decisions,
    lineage_epochs,
    recent_activity,
  };

  log("retrieval complete", {
    goals: goals.length,
    decisions: decisions.length,
    lineage_epochs: lineage_epochs.length,
  });

  return context;
}

export function assembleContextText(context: RetrievalContext): string {
  const lines: string[] = [];

  lines.push("## Question");
  lines.push(context.question);
  lines.push("");

  if (context.meta_state) {
    lines.push("## Identity");
    lines.push(`Role: ${context.meta_state.identity.role}`);
    lines.push("");
  }

  if (context.goals && context.goals.length > 0) {
    lines.push("## Active Goals");
    for (const goal of context.goals) {
      lines.push(`- ${goal.title} (${goal.status}, ${goal.progress}%)`);
    }
    lines.push("");
  }

  if (context.decisions && context.decisions.length > 0) {
    lines.push("## Decisions");
    for (const decision of context.decisions.slice(0, 10)) {
      lines.push(`### ${decision.title}`);
      lines.push(`Decision: ${decision.decision}`);
      lines.push(`Reasoning: ${decision.reasoning}`);
      if (decision.outcome) lines.push(`Outcome: ${decision.outcome}`);
      lines.push(`Confidence: ${decision.confidence}`);
      lines.push("");
    }
  }

  if (context.lineage_epochs && context.lineage_epochs.length > 0) {
    lines.push("## Lineage History");
    for (const epoch of context.lineage_epochs.slice(0, 5)) {
      lines.push(`### Epoch ${epoch.epoch_id.slice(-6)}`);
      lines.push(`Summary: ${epoch.summary.slice(0, 200)}`);
      if (epoch.project) lines.push(`Project: ${epoch.project}`);
      lines.push("");
    }
  }

  if (context.recent_activity) {
    lines.push("## Recent Activity");
    lines.push(context.recent_activity);
    lines.push("");
  }

  if (context.semantic_hits && context.semantic_hits.length > 0) {
    lines.push("## Semantic Memory");
    for (const hit of context.semantic_hits.slice(0, 5)) {
      lines.push(`### ${hit.title} (${hit.source}, score: ${hit.score.toFixed(3)})`);
      lines.push(hit.content.slice(0, 200));
      lines.push("");
    }
  }

  return lines.join("\n");
}
