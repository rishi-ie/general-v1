import { EventEmitter } from "events";
import type { Logger } from "../logger";
import { authorityPath } from "../persistence/paths";
import type { Store } from "../persistence/store";
import type { AuthorityGrant, AuthorityScope } from "../types";

export class AuthorityManager extends EventEmitter {
  private grants = new Map<string, AuthorityGrant>();

  constructor(
    private store: Store,
    private log?: Logger,
  ) {
    super();
  }

  async restore(): Promise<void> {
    try {
      const data = await this.store.read<AuthorityGrant[]>(authorityPath(this.store["dir"]));
      for (const g of data ?? []) {
        this.grants.set(g.grantId, g);
      }
      this.log?.info(`authority: restored ${this.grants.size} grants`);
    } catch (err) {
      this.log?.warn("authority: failed to restore grants", { error: String(err) });
    }
  }

  async persist(): Promise<void> {
    try {
      await this.store.write(authorityPath(this.store["dir"]), [...this.grants.values()]);
    } catch (err) {
      this.log?.error("authority: failed to persist grants", { error: String(err) });
    }
  }

  grant(g: Omit<AuthorityGrant, "createdAt">): AuthorityGrant {
    const full: AuthorityGrant = { ...g, createdAt: Date.now() };
    this.grants.set(g.grantId, full);
    this.persist();
    this.emit("granted", full);
    this.log?.info("authority: granted", { grantId: g.grantId, from: g.fromAgentId, to: g.toAgentId });
    return full;
  }

  revoke(grantId: string, reason = "host revoke"): void {
    const g = this.grants.get(grantId);
    if (!g) return;

    g.revokedAt = Date.now();
    this.persist();
    this.emit("revoked", { grantId, reason, grant: g });
    this.log?.info("authority: revoked", { grantId, reason });
  }

  revokeByAgent(agentId: string): void {
    for (const [id, g] of this.grants) {
      if ((g.fromAgentId === agentId || g.toAgentId === agentId) && !g.revokedAt) {
        this.revoke(id, `agent disconnected: ${agentId}`);
      }
    }
  }

  listActive(): AuthorityGrant[] {
    return [...this.grants.values()].filter((g) => !g.revokedAt);
  }

  listByAgent(agentId: string): { granted: AuthorityGrant[]; received: AuthorityGrant[] } {
    const all = [...this.grants.values()].filter((g) => !g.revokedAt);
    return {
      granted: all.filter((g) => g.fromAgentId === agentId),
      received: all.filter((g) => g.toAgentId === agentId),
    };
  }

  get(grantId: string): AuthorityGrant | undefined {
    return this.grants.get(grantId);
  }

  hasActiveScope(fromAgentId: string, toAgentId: string, requiredScope: Partial<AuthorityScope>): boolean {
    const active = [...this.grants.values()].filter(
      (g) => g.fromAgentId === fromAgentId && g.toAgentId === toAgentId && !g.revokedAt,
    );

    for (const grant of active) {
      if (this.scopeSatisfies(grant.scope, requiredScope)) {
        if (!grant.expiresAt || grant.expiresAt > Date.now()) {
          return true;
        }
      }
    }
    return false;
  }

  private scopeSatisfies(granted: AuthorityScope, required: Partial<AuthorityScope>): boolean {
    if (required.tools && required.tools.length > 0) {
      const hasTools = required.tools.every((t) => granted.tools?.includes(t));
      if (!hasTools) return false;
    }
    if (required.actions && required.actions.length > 0) {
      const hasActions = required.actions.every((a) => granted.actions?.includes(a));
      if (!hasActions) return false;
    }
    if (required.paths && required.paths.length > 0) {
      const hasPaths = required.paths.every((p) => granted.paths?.includes(p));
      if (!hasPaths) return false;
    }
    return true;
  }
}
