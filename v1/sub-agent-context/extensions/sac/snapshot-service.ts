import type { CognitiveSnapshot, MetaState, Goal, Decision, OpenLoop, Relationship } from "./types";
import { getMetaState } from "./meta-state";
import { getRecentDecisions } from "./decision-ledger";

let config: { snapshotFormat?: "concise" | "detailed"; maxRecentDecisions?: number } = {};

function log(msg: string, data?: Record<string, unknown>): void {
  console.log(`[sac] ${msg}`, data ?? {});
}

export function generateSnapshot(): CognitiveSnapshot {
  const metaState = getMetaState();
  const maxDecisions = config.maxRecentDecisions ?? 20;

  const activeProjects = metaState.projects.filter((p) => p.status === "active");
  const activeGoals = metaState.goals.filter((g) => g.status === "in_progress");
  const openLoops = metaState.open_loops.filter((l) => l.status === "open");
  const recentDecisions = getRecentDecisions(maxDecisions);
  const importantRelationships = metaState.relationships
    .filter((r) => r.importance === "high")
    .slice(0, 10);

  const snapshot: CognitiveSnapshot = {
    generated_at: Date.now(),
    identity: metaState.identity,
    active_projects: activeProjects,
    active_goals: activeGoals,
    open_loops: openLoops,
    recent_decisions: recentDecisions,
    important_relationships: importantRelationships,
    recent_learnings: [],
    current_focus: metaState.active_focus,
    current_context_summary: metaState.current_context_summary,
  };

  log("snapshot generated", {
    projects: activeProjects.length,
    goals: activeGoals.length,
    decisions: recentDecisions.length,
  });

  return snapshot;
}

export function formatSnapshotConcise(snapshot: CognitiveSnapshot): string {
  const lines: string[] = [];

  lines.push(`Identity: ${snapshot.identity.role}`);
  if (snapshot.identity.responsibilities.length > 0) {
    lines.push(`Responsibilities: ${snapshot.identity.responsibilities.join(", ")}`);
  }
  if (snapshot.identity.expertise.length > 0) {
    lines.push(`Expertise: ${snapshot.identity.expertise.join(", ")}`);
  }
  lines.push("");

  if (snapshot.active_projects.length > 0) {
    lines.push("Projects:");
    for (const project of snapshot.active_projects) {
      lines.push(`- ${project.name} (${project.status}, ${project.priority})`);
    }
    lines.push("");
  }

  if (snapshot.active_goals.length > 0) {
    lines.push("Goals:");
    for (const goal of snapshot.active_goals) {
      lines.push(`- ${goal.title} (${goal.status}, ${goal.progress}%, ${goal.priority})`);
    }
    lines.push("");
  }

  if (snapshot.open_loops.length > 0) {
    lines.push("Open Loops:");
    for (const loop of snapshot.open_loops) {
      lines.push(`- [${loop.type}] ${loop.description}`);
    }
    lines.push("");
  }

  if (snapshot.recent_decisions.length > 0) {
    lines.push("Recent Decisions:");
    for (const decision of snapshot.recent_decisions.slice(0, 5)) {
      lines.push(`- ${decision.title}: ${decision.decision} (${decision.confidence} confidence)`);
    }
    lines.push("");
  }

  if (snapshot.current_focus.length > 0) {
    lines.push(`Current Focus: ${snapshot.current_focus.join(", ")}`);
    lines.push("");
  }

  if (snapshot.current_context_summary) {
    lines.push(`Current Context: ${snapshot.current_context_summary}`);
  }

  return lines.join("\n");
}

export function formatSnapshotDetailed(snapshot: CognitiveSnapshot): string {
  const lines: string[] = [];

  lines.push("## Identity");
  lines.push(`Role: ${snapshot.identity.role}`);
  lines.push(`Working Style: ${snapshot.identity.working_style}`);
  lines.push(`Responsibilities: ${snapshot.identity.responsibilities.join(", ")}`);
  lines.push(`Expertise: ${snapshot.identity.expertise.join(", ")}`);
  lines.push(`Traits: ${snapshot.identity.behavioral_traits.join(", ")}`);
  lines.push("");

  lines.push("## Active Projects");
  for (const project of snapshot.active_projects) {
    lines.push(`### ${project.name}`);
    lines.push(`- Status: ${project.status}`);
    lines.push(`- Priority: ${project.priority}`);
    lines.push(`- Recent Activity: ${project.recent_activity}`);
    lines.push(`- Created: ${new Date(project.created_at).toISOString().split("T")[0]}`);
    lines.push("");
  }

  lines.push("## Active Goals");
  for (const goal of snapshot.active_goals) {
    lines.push(`### ${goal.title}`);
    lines.push(`- Status: ${goal.status}`);
    lines.push(`- Progress: ${goal.progress}%`);
    lines.push(`- Priority: ${goal.priority}`);
    if (goal.blockers.length > 0) {
      lines.push(`- Blockers: ${goal.blockers.join(", ")}`);
    }
    lines.push("");
  }

  lines.push("## Open Loops");
  for (const loop of snapshot.open_loops) {
    lines.push(`- [${loop.type}] ${loop.description} (opened: ${new Date(loop.created_at).toISOString().split("T")[0]})`);
  }
  lines.push("");

  lines.push("## Recent Decisions");
  for (const decision of snapshot.recent_decisions) {
    lines.push(`### ${decision.title}`);
    lines.push(`- Decision: ${decision.decision}`);
    lines.push(`- Reasoning: ${decision.reasoning}`);
    lines.push(`- Confidence: ${decision.confidence}`);
    if (decision.outcome) lines.push(`- Outcome: ${decision.outcome}`);
    lines.push(`- Date: ${new Date(decision.timestamp).toISOString().split("T")[0]}`);
    lines.push("");
  }

  lines.push("## Relationships");
  for (const rel of snapshot.important_relationships) {
    lines.push(`- ${rel.entity_name} (${rel.relationship_type}, ${rel.importance} importance, ${rel.interaction_count} interactions)`);
  }
  lines.push("");

  lines.push("## Current Context");
  lines.push(`Focus: ${snapshot.current_focus.join(", ")}`);
  lines.push(`Summary: ${snapshot.current_context_summary || "(none)"}`);
  lines.push("");

  lines.push("## Recent Learnings");
  if (snapshot.recent_learnings.length > 0) {
    for (const learning of snapshot.recent_learnings) {
      lines.push(`- ${learning}`);
    }
  } else {
    lines.push("(none recorded yet)");
  }

  return lines.join("\n");
}

export function formatSnapshot(snapshot: CognitiveSnapshot): string {
  const format = config.snapshotFormat ?? "concise";
  if (format === "detailed") {
    return formatSnapshotDetailed(snapshot);
  }
  return formatSnapshotConcise(snapshot);
}

export function initSnapshotService(cfg: { snapshotFormat?: "concise" | "detailed"; maxRecentDecisions?: number }): void {
  config = cfg;
}
