import * as fs from "fs";
import * as path from "path";
import { getMetaState, addGoal, updateGoal } from "../sub-agent-context/extensions/sac/meta-state.js";

const PLAN_FILE = "task_plan.md";
const ACTIVE_PLAN_FILE = ".planning/.active_plan";

interface ParsedTask {
  phase: string;
  taskIndex: number;
  task: string;
  status: "pending" | "in_progress" | "completed" | "blocked";
}

function resolvePlanDir(cwd: string): string {
  try {
    const activePlanPath = path.join(cwd, ACTIVE_PLAN_FILE);
    if (fs.existsSync(activePlanPath)) {
      const target = fs.readFileSync(activePlanPath, "utf-8").trim();
      const planDir = path.join(cwd, ".planning", target);
      if (fs.existsSync(planDir)) return planDir;
    }
  } catch {}
  return cwd;
}

function parsePlan(cwd: string): ParsedTask[] {
  const planDir = resolvePlanDir(cwd);
  const planPath = path.join(planDir, PLAN_FILE);
  const tasks: ParsedTask[] = [];
  try {
    if (!fs.existsSync(planPath)) return tasks;
    const content = fs.readFileSync(planPath, "utf-8");
    const lines = content.split("\n");
    let currentPhase = "Phase 1";
    let taskIndex = 0;
    for (const line of lines) {
      const phaseMatch = line.match(/^## Phase \d+:\s+(.+)/);
      if (phaseMatch) {
        currentPhase = phaseMatch[1].trim();
        taskIndex = 0;
        continue;
      }
      const statusMatch = line.match(/^\[([^\]]+)\]\s*[-–]?\s*(.+)/);
      if (statusMatch) {
        const rawStatus = statusMatch[1].toLowerCase();
        let status: ParsedTask["status"] = "pending";
        if (rawStatus === "in progress") status = "in_progress";
        else if (rawStatus === "completed" || rawStatus === "done") status = "completed";
        else if (rawStatus === "blocked") status = "blocked";
        const task = statusMatch[2].trim();
        tasks.push({ phase: currentPhase, taskIndex: taskIndex++, task, status });
      }
    }
  } catch {}
  return tasks;
}

let goalsByTitle: Map<string, string> | null = null;

function ensureGoalsMap(): void {
  if (goalsByTitle !== null) return;
  goalsByTitle = new Map();
  try {
    const state = getMetaState();
    for (const goal of state.goals) {
      goalsByTitle.set(goal.title, goal.goal_id);
    }
  } catch {
    goalsByTitle = new Map();
  }
}

export default function planningMcIntegration(
  pi: { on(event: string, cb: () => void | Promise<void>): void }
): void {
  pi.on("turn_end", async () => {
    try {
      ensureGoalsMap();
      const cwd = process.cwd();
      const tasks = parsePlan(cwd);
      for (const { phase, taskIndex, task, status } of tasks) {
        if (status === "in_progress" || status === "completed") {
          const goalId = goalsByTitle!.get(task);
          if (goalId) {
            updateGoal(goalId, {
              title: `[${phase} #${taskIndex + 1}] ${task}`,
              status,
              progress: status === "completed" ? 100 : 0,
            });
          } else {
            const newGoal = addGoal({
              title: task,
              status,
              priority: "medium",
              progress: status === "completed" ? 100 : 0,
              blockers: [],
            });
            goalsByTitle!.set(task, newGoal.goal_id);
          }
        }
      }
    } catch {}
  });
}
