import { EventEmitter } from "events";
import type { Logger } from "../logger";
import type { AgentRegistry } from "../registry/agent-registry";
import { AgentRecord, type PresenceEntry } from "../types";

export class PresenceTracker extends EventEmitter {
  private lastSnapshot: PresenceEntry[] = [];

  constructor(
    private registry: AgentRegistry,
    private log?: Logger,
  ) {
    super();
    this.wireEvents();
  }

  private wireEvents(): void {
    this.registry.on("agent:connected", (a) => {
      this.snapshotAndDiff();
    });

    this.registry.on("agent:disconnected", () => {
      this.snapshotAndDiff();
    });

    this.registry.on("agent:updated", (a) => {
      if (a.status) {
        this.snapshotAndDiff();
      }
    });
  }

  snapshot(): PresenceEntry[] {
    return this.registry.list().map((a) => ({
      agentId: a.agentId,
      status: a.status,
      activity: undefined,
      lastSeen: a.lastSeen,
    }));
  }

  private snapshotAndDiff(): void {
    const next = this.snapshot();

    const changed =
      next.length !== this.lastSnapshot.length ||
      next.some((n, i) => {
        const prev = this.lastSnapshot[i];
        return !prev || n.agentId !== prev.agentId || n.status !== prev.status;
      });

    if (changed) {
      this.lastSnapshot = next;
      this.emit("changed", next);
    }
  }

  isOnline(agentId: string): boolean {
    const rec = this.registry.get(agentId);
    return rec?.status !== "offline" && rec?.status !== undefined;
  }

  isBusy(agentId: string): boolean {
    return this.registry.get(agentId)?.status === "busy";
  }

  getLastSeen(agentId: string): number | undefined {
    return this.registry.get(agentId)?.lastSeen;
  }
}
