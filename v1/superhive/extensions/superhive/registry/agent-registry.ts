import { EventEmitter } from "events";
import type { Logger } from "../logger";
import { agentsPath } from "../persistence/paths";
import type { Store } from "../persistence/store";
import type { Connection } from "../server/connection";
import type { AgentManifest, AgentRecord, AgentState, AgentStatus, Metrics } from "../types";

export interface ConnectOptions {
  agentId: string;
  manifest: AgentManifest;
  remoteAddr: string;
  sessionId: string;
  connectionId: string;
  assignedGroup?: string;
}

export class AgentRegistry extends EventEmitter {
  private byId = new Map<string, AgentRecord>();
  private byConnectionId = new Map<string, string>();
  private connectionMap = new Map<string, Connection>();

  constructor(
    private store: Store,
    private log?: Logger,
  ) {
    super();
  }

  async restore(): Promise<void> {
    try {
      const recs = (await this.store.read<AgentRecord[]>(agentsPath(this.store["dir"]))) ?? [];
      for (const r of recs) {
        this.byId.set(r.agentId, { ...r, status: "offline", connectionId: "" });
      }
      this.log?.info(`registry: restored ${recs.length} agents`);
    } catch (err) {
      this.log?.warn(`registry: failed to restore agents`, { error: String(err) });
    }
  }

  async persist(): Promise<void> {
    try {
      await this.store.write(agentsPath(this.store["dir"]), [...this.byId.values()]);
    } catch (err) {
      this.log?.error(`registry: failed to persist agents`, { error: String(err) });
    }
  }

  connect(conn: Connection, opts: ConnectOptions): AgentRecord {
    const existing = this.byId.get(opts.agentId);

    const record: AgentRecord = {
      agentId: opts.agentId,
      manifest: opts.manifest,
      remoteAddr: opts.remoteAddr,
      connectedAt: existing?.connectedAt ?? Date.now(),
      lastSeen: Date.now(),
      status: "online",
      settingsHash: existing?.settingsHash ?? "",
      assignedGroup: opts.assignedGroup ?? existing?.assignedGroup,
      sessionId: opts.sessionId,
      connectionId: opts.connectionId,
    };

    this.byId.set(opts.agentId, record);
    this.byConnectionId.set(opts.connectionId, opts.agentId);
    this.connectionMap.set(opts.connectionId, conn);

    this.persist();
    this.emit("agent:connected", record);
    return record;
  }

  disconnect(connectionId: string, reason: string): void {
    const agentId = this.byConnectionId.get(connectionId);
    if (!agentId) return;

    const rec = this.byId.get(agentId);
    if (rec) {
      this.byId.set(agentId, { ...rec, status: "offline", lastSeen: Date.now() });
    }

    this.byConnectionId.delete(connectionId);
    this.connectionMap.delete(connectionId);
    this.persist();
    this.emit("agent:disconnected", agentId, reason);
  }

  updateState(agentId: string, state: Partial<AgentState>): void {
    const rec = this.byId.get(agentId);
    if (!rec) return;
    const updated = { ...rec, lastSeen: Date.now() };
    this.byId.set(agentId, updated);
    this.emit("agent:state-changed", updated, state);
  }

  updateMetrics(agentId: string, metrics: Metrics): void {
    const rec = this.byId.get(agentId);
    if (!rec) return;
    this.emit("agent:metrics-changed", rec, metrics);
  }

  updateStatus(agentId: string, status: AgentStatus, activity?: string): void {
    const rec = this.byId.get(agentId);
    if (!rec) return;
    const updated = { ...rec, status, lastSeen: Date.now() };
    this.byId.set(agentId, updated);
    this.emit("agent:updated", updated, activity);
  }

  updateSettingsHash(agentId: string, hash: string): void {
    const rec = this.byId.get(agentId);
    if (!rec) return;
    this.byId.set(agentId, { ...rec, settingsHash: hash });
    this.persist();
  }

  get(agentId: string): AgentRecord | undefined {
    return this.byId.get(agentId);
  }

  getByConnectionId(connectionId: string): AgentRecord | undefined {
    const agentId = this.byConnectionId.get(connectionId);
    return agentId ? this.byId.get(agentId) : undefined;
  }

  getConnection(agentId: string): Connection | undefined {
    const rec = this.byId.get(agentId);
    return rec ? this.connectionMap.get(rec.connectionId) : undefined;
  }

  list(): AgentRecord[] {
    return [...this.byId.values()];
  }

  listOnline(): AgentRecord[] {
    return [...this.byId.values()].filter((a) => a.status !== "offline");
  }

  count(): number {
    return this.byId.size;
  }
}
