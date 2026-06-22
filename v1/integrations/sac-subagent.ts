import {
  appendGoal,
  addOpenLoop,
  getActiveFocus,
} from "../sub-agent-context/extensions/sac/meta-state.js";
import { ulid } from "ulid";

interface SubAgentResult {
  id?: string;
  goal?: string;
  output?: string;
  status?: "running" | "done" | "failed";
}

function spawnSubAgent(goal: string, cfg: unknown): SubAgentResult {
  const id = ulid();
  appendGoal({
    title: goal,
    status: "in_progress",
    priority: "high",
    progress: 0,
    blockers: [],
  });
  addOpenLoop({
    type: "sub_agent",
    title: goal,
    metadata: { sub_agent_id: id, config: cfg },
  });
  return { id, goal, status: "running" };
}

export default function sacSubagentIntegration(
  pi: { on(event: string, cb: () => void | Promise<void>): void }
): void {
  pi.registerAction("spawn_sub_agent", spawnSubAgent);

  pi.on("tool_result", (event: { toolName: string; result: unknown }) => {
    if (event.toolName === "subagent") {
      const r = event.result as SubAgentResult;
      if (r.id && r.status === "done" && r.output) {
        addOpenLoop({
          type: "sub_agent_result",
          title: r.output.slice(0, 200),
          metadata: { sub_agent_id: r.id },
        });
      }
    }
  });
}
