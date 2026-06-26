import { EventEmitter } from "events";
import type { Logger } from "../logger";
import type { AgentRegistry } from "../registry/agent-registry";
import { type AgentRecord, AgentState, type Metrics } from "../types";

export interface AggregatedMetrics {
  totalAgents: number;
  onlineAgents: number;
  totalTokensUsed: number;
  totalToolCalls: number;
  totalTurns: number;
  totalErrors: number;
}

export class StateAggregator extends EventEmitter {
  private agentMetrics = new Map<string, Metrics>();

  constructor(
    private registry: AgentRegistry,
    private log?: Logger,
  ) {
    super();
    this.wireEvents();
  }

  private wireEvents(): void {
    this.registry.on("agent:connected", (a) => {
      this.emit("agent:joined", a);
    });

    this.registry.on("agent:disconnected", (id, reason) => {
      this.agentMetrics.delete(id);
      this.emit("agent:left", { agentId: id, reason });
    });

    this.registry.on("agent:metrics-changed", (agent, metrics) => {
      this.agentMetrics.set(agent.agentId, metrics);
      this.emit("metrics:updated", this.rollup());
    });
  }

  updateMetrics(agentId: string, metrics: Metrics): void {
    this.agentMetrics.set(agentId, metrics);
    this.emit("metrics:updated", this.rollup());
  }

  rollup(): AggregatedMetrics {
    const agents = this.registry.list();
    const online = agents.filter((a) => a.status !== "offline");

    let totalTokensUsed = 0;
    let totalToolCalls = 0;
    let totalTurns = 0;
    let totalErrors = 0;

    for (const m of this.agentMetrics.values()) {
      totalTokensUsed += m.tokensUsed ?? 0;
      totalToolCalls += m.toolCalls ?? 0;
      totalTurns += m.turns ?? 0;
      totalErrors += m.errors ?? 0;
    }

    return {
      totalAgents: agents.length,
      onlineAgents: online.length,
      totalTokensUsed,
      totalToolCalls,
      totalTurns,
      totalErrors,
    };
  }

  getAgentSnapshot(agentId: string): { record: AgentRecord | undefined; metrics: Metrics | undefined } {
    return {
      record: this.registry.get(agentId),
      metrics: this.agentMetrics.get(agentId),
    };
  }

  getAllSnapshots(): Array<{ agentId: string; record: AgentRecord; metrics: Metrics }> {
    return this.registry.list().map((a) => ({
      agentId: a.agentId,
      record: a,
      metrics: this.agentMetrics.get(a.agentId) ?? {},
    }));
  }
}
