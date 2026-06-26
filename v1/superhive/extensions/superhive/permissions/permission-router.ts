import { EventEmitter } from "events";
import type { Logger } from "../logger";
import type { PendingRequest, PermissionDecision } from "../types";

export class PermissionRouter extends EventEmitter {
  private pending = new Map<string, PendingRequest>();
  private defaultPolicies = new Map<string, "allow" | "deny" | "ask">();

  constructor(private log?: Logger) {
    super();
  }

  enqueue(req: Omit<PendingRequest, "resolve">): Promise<PermissionDecision> {
    return new Promise((resolve) => {
      const entry: PendingRequest = { ...req, resolve };
      this.pending.set(req.requestId, entry);
      this.log?.info("permission: request queued", {
        requestId: req.requestId,
        agentId: req.agentId,
        tool: req.tool,
        severity: req.severity,
      });
      this.emit("request", entry);
    });
  }

  decide(requestId: string, decision: PermissionDecision): void {
    const p = this.pending.get(requestId);
    if (!p) {
      this.log?.warn("permission: request not found", { requestId });
      return;
    }

    this.pending.delete(requestId);
    p.resolve?.(decision);

    this.log?.info("permission: decision made", {
      requestId,
      decision: decision.decision,
      remember: decision.remember,
    });
    this.emit("resolved", { requestId, ...decision });
  }

  get(requestId: string): PendingRequest | undefined {
    return this.pending.get(requestId);
  }

  listPending(): PendingRequest[] {
    return [...this.pending.values()].sort((a, b) => a.requestedAt - b.requestedAt);
  }

  setDefaultPolicy(tool: string, policy: "allow" | "deny" | "ask"): void {
    this.defaultPolicies.set(tool, policy);
  }

  getDefaultPolicy(tool: string): "allow" | "deny" | "ask" {
    return this.defaultPolicies.get(tool) ?? "ask";
  }

  clearStale(maxAgeMs: number): number {
    const cutoff = Date.now() - maxAgeMs;
    let cleared = 0;
    for (const [id, req] of this.pending) {
      if (req.requestedAt < cutoff) {
        req.resolve?.({ decision: "deny", reason: "timeout" });
        this.pending.delete(id);
        cleared++;
      }
    }
    return cleared;
  }
}
