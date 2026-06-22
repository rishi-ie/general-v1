import * as fs from "fs";
import * as path from "path";
import { updateState } from "../communication/extensions/communication/index.js";

const PLAN_FILE = "task_plan.md";
const ACTIVE_PLAN_FILE = ".planning/.active_plan";

function resolvePlanDir(cwd: string): string {
  const activePlanPath = path.join(cwd, ACTIVE_PLAN_FILE);
  try {
    if (fs.existsSync(activePlanPath)) {
      const target = fs.readFileSync(activePlanPath, "utf-8").trim();
      const planDir = path.join(cwd, ".planning", target);
      if (fs.existsSync(planDir)) return planDir;
    }
  } catch {}
  return cwd;
}

function extractCurrentPhase(cwd: string): string | undefined {
  const planDir = resolvePlanDir(cwd);
  const planPath = path.join(planDir, PLAN_FILE);
  try {
    if (!fs.existsSync(planPath)) return undefined;
    const content = fs.readFileSync(planPath, "utf-8");
    const lines = content.split("\n");
    let inPhase = false;
    let currentPhase = "";
    for (const line of lines) {
      const phaseMatch = line.match(/^## Phase \d+:\s+(.+)/);
      if (phaseMatch) {
        currentPhase = phaseMatch[1].trim();
        inPhase = true;
        continue;
      }
      if (inPhase) {
        const statusMatch = line.match(/^\[([^\]]+)\]/);
        if (statusMatch) {
          const status = statusMatch[1].toLowerCase();
          if (status === "in progress") {
            return currentPhase;
          }
          inPhase = false;
        } else if (line.startsWith("## ")) {
          inPhase = false;
        }
      }
    }
  } catch {}
  return undefined;
}

export default function commPlanningIntegration(
  pi: { on(event: string, cb: () => void | Promise<void>): void }
): void {
  pi.on("before_agent_start", async (event: { prompt?: string }, ctx: unknown) => {
    try {
      const extCtx = ctx as { cwd?: string };
      const cwd = extCtx?.cwd ?? process.cwd();
      const phase = extractCurrentPhase(cwd);
      if (phase) {
        updateState({ currentTask: phase, phase }, {});
      }
    } catch (err) {
      console.log("[comm-planning] failed to extract phase:", String(err));
    }
  });
}
