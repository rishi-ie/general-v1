import { EventEmitter } from "events";
import type { Logger } from "../logger";
import { messagesPath, todayDate } from "../persistence/paths";
import type { Store } from "../persistence/store";
import type { AgentRegistry } from "../registry/agent-registry";
import type { InterAgentMessage } from "../types";

export interface DeliveryResult {
  deliveredTo: string[];
  dropped: boolean;
}

export class Broker extends EventEmitter {
  private groups = new Map<string, Set<string>>();
  private history: InterAgentMessage[] = [];
  private maxHistoryLength = 1000;

  constructor(
    private registry: AgentRegistry,
    private store: Store,
    private log?: Logger,
  ) {
    super();
  }

  async route(from: string, msg: Omit<InterAgentMessage, "from" | "receivedAt">): Promise<DeliveryResult> {
    const full: InterAgentMessage = {
      ...msg,
      from,
      receivedAt: Date.now(),
    };

    await this.appendHistory(full);

    if (msg.broadcast) {
      const targets = this.registry.listOnline().filter((a) => a.agentId !== from);
      for (const a of targets) {
        this.deliverToAgent(a.agentId, full);
      }
      return { deliveredTo: targets.map((a) => a.agentId), dropped: targets.length === 0 };
    }

    if (msg.group) {
      const members = this.groups.get(msg.group) ?? new Set();
      const targets = [...members].filter((id) => id !== from);
      for (const id of targets) {
        this.deliverToAgent(id, full);
      }
      return { deliveredTo: targets, dropped: targets.length === 0 };
    }

    if (msg.to) {
      const target = this.registry.get(msg.to);
      if (!target || target.status === "offline") {
        this.log?.warn("broker: delivery failed — agent offline", { to: msg.to });
        return { deliveredTo: [], dropped: true };
      }
      this.deliverToAgent(msg.to, full);
      return { deliveredTo: [msg.to], dropped: false };
    }

    return { deliveredTo: [], dropped: true };
  }

  joinGroup(groupId: string, agentId: string): void {
    if (!this.groups.has(groupId)) {
      this.groups.set(groupId, new Set());
    }
    this.groups.get(groupId)!.add(agentId);
    this.log?.debug("broker: agent joined group", { groupId, agentId });
  }

  leaveGroup(groupId: string, agentId: string): void {
    this.groups.get(groupId)?.delete(agentId);
    this.log?.debug("broker: agent left group", { groupId, agentId });
  }

  getGroupMembers(groupId: string): string[] {
    return [...(this.groups.get(groupId) ?? [])];
  }

  getHistory(limit = 100): InterAgentMessage[] {
    return this.history.slice(-limit);
  }

  getHistoryForAgent(agentId: string, limit = 50): InterAgentMessage[] {
    return this.history.filter((m) => m.from === agentId || m.to === agentId || m.to === "*").slice(-limit);
  }

  private async appendHistory(msg: InterAgentMessage): Promise<void> {
    this.history.push(msg);
    if (this.history.length > this.maxHistoryLength) {
      this.history = this.history.slice(-this.maxHistoryLength);
    }

    try {
      const date = todayDate();
      await this.store.append(messagesPath(this.store["dir"], date), msg);
    } catch (err) {
      this.log?.error("broker: failed to append message to history", { error: String(err) });
    }
  }

  private deliverToAgent(agentId: string, msg: InterAgentMessage): void {
    this.emit("deliver", agentId, msg);
  }
}
