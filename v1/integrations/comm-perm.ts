import { requestPermission } from "../communication/extensions/communication/index.js";

type PermissionDecision = { decision: "allow" | "deny"; reason?: string; remember?: boolean };

const SENSITIVE_TOOLS = new Set(["file_delete", "bash", "command_execute", "sub_agent_spawn", "network_request"]);

const permissionCache = new Map<string, PermissionDecision>();

function getCachedPermission(tool: string): PermissionDecision | null {
  const cached = permissionCache.get(tool);
  if (cached?.remember) return cached;
  return null;
}

export async function checkPermission(
  tool: string,
  args: unknown,
  reason: string,
  severity: "low" | "medium" | "high" | "critical" = "medium",
): Promise<PermissionDecision> {
  const cached = getCachedPermission(tool);
  if (cached) return cached;

  if (!SENSITIVE_TOOLS.has(tool)) {
    return { decision: "allow" };
  }

  const result = await requestPermission(tool, args, reason, severity, 60000);
  if (result.remember) {
    permissionCache.set(tool, result);
  }
  return result;
}

export default function commPermIntegration(pi: { on(event: string, cb: () => void | Promise<void>): void }): void {
  pi.on("tool_call", async (event: { toolName: string; toolCallId: string; input: unknown }, ctx: unknown) => {
    const extCtx = ctx as {
      sendMessage?: (msg: unknown) => void;
      ui?: { notify?: (msg: string, type: string) => void };
    };
    const tool = event.toolName;
    const reason = `Tool call: ${tool}`;
    const result = await checkPermission(tool, event.input, reason, "medium");
    if (result.decision === "deny") {
      extCtx?.ui?.notify(`Permission denied for ${tool}: ${result.reason ?? ""}`, "error");
    }
  });
}
