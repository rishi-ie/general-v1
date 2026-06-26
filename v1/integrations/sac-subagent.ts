import {
  addGoal,
  addOpenLoop,
} from "../sub-agent-context/extensions/sac/meta-state.js";
import { randomUUID } from "crypto";

interface SubAgentResult {
  id?: string;
  goal?: string;
  output?: string;
  status?: "running" | "done" | "failed";
}

function spawnSubAgent(goal: string, cfg: unknown): SubAgentResult {
  const id = randomUUID();
  addGoal({
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
  pi: { on(event: string, cb: () => void | Promise<void>): void; registerTool(opts: {
    name: string;
    label: string;
    description: string;
    parameters: object;
    execute: (
      toolCallId: string,
      params: Record<string, unknown>,
      signal: AbortSignal,
      onUpdate: (update: unknown) => void,
      ctx: unknown
    ) => Promise<{ content: Array<{ type: string; text: string }>; details?: Record<string, unknown> }>;
  }): void }
): void {
  pi.registerTool({
    name: "spawn_sub_agent",
    label: "Spawn Sub-Agent",
    description: "Spawn a focused child agent to handle a specific sub-task. Returns the sub-agent ID for tracking.",
    parameters: {
      type: "object",
      properties: {
        goal: { type: "string", description: "The goal or task description for the sub-agent" },
        config: { type: "any", description: "Optional configuration passed to the sub-agent" },
      },
      required: ["goal"],
    },
    async execute(toolCallId, params) {
      const result = spawnSubAgent(params.goal as string, params.config);
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
        details: result,
      };
    },
  });

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
