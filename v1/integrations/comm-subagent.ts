import { updateState } from "../communication/extensions/communication/index.js";

interface SubAgentStatus {
  id: string;
  type: string;
  status: "running" | "paused" | "done" | "failed";
}

let activeSubAgents = new Map<string, SubAgentStatus>();

export function reportSubAgentStart(id: string, type: string): void {
  activeSubAgents.set(id, { id, type, status: "running" });
  syncState();
}

export function reportSubAgentStatus(id: string, status: SubAgentStatus["status"]): void {
  const agent = activeSubAgents.get(id);
  if (agent) {
    agent.status = status;
    syncState();
  }
}

function syncState(): void {
  updateState(
    { subAgents: Array.from(activeSubAgents.values()) },
    {}
  );
}

export default function commSubagentIntegration(
  pi: { on(event: string, cb: () => void | Promise<void>): void }
): void {
  pi.on("session_start", () => {
    activeSubAgents.clear();
  });

  pi.on("tool_result", (event: { toolName: string; result: unknown }) => {
    if (event.toolName === "subagent" && typeof event.result === "object" && event.result !== null) {
      const r = event.result as { id?: string; type?: string; status?: string };
      if (r.id && r.type) {
        reportSubAgentStart(r.id, r.type);
      }
    }
  });
}
