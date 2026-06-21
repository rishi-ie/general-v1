import { EventEmitter } from 'events';
import { AgentRegistry } from '../registry/agent-registry';
import { Store } from '../persistence/store';
import { Logger } from '../logger';
import { AgentRecord, SettingsPatch, ValidationError } from '../types';
import { validateSettingsAgainstSchema } from '../registry/manifest-validator';
import { agentSettingsPath } from '../persistence/paths';
import * as crypto from 'crypto';

export interface PendingSettingsPush {
  agentId: string;
  expectedHash: string;
  pushedAt: number;
  patch: SettingsPatch[];
}

export class SettingsEngine extends EventEmitter {
  private pending = new Map<string, PendingSettingsPush>();
  private currentSettings = new Map<string, Record<string, unknown>>();

  constructor(
    private registry: AgentRegistry,
    private store: Store,
    private log?: Logger
  ) {
    super();
  }

  hashSettings(settings: Record<string, unknown>): string {
    const canonical = JSON.stringify(settings, Object.keys(settings).sort());
    return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
  }

  async pushSettings(
    agentId: string,
    patch: SettingsPatch[],
    expectedHash?: string
  ): Promise<{ ok: true } | { ok: false; errors: ValidationError[] }> {
    const agent = this.registry.get(agentId);
    if (!agent) {
      return { ok: false, errors: [{ path: '', message: `unknown agent: ${agentId}` }] };
    }

    const current = (await this.loadCurrentSettings(agentId)) ?? {};
    const validated = this.applyPatch(current, patch);
    const schemaErrors = validateSettingsAgainstSchema(validated, agent.manifest.settingsSchema);

    if (!schemaErrors.ok) {
      return { ok: false, errors: schemaErrors.errors.map((e) => ({ path: '', message: e })) };
    }

    const newHash = this.hashSettings(validated);
    if (expectedHash && newHash !== expectedHash) {
      return { ok: false, errors: [{ path: '', message: 'hash mismatch: settings have changed' }] };
    }

    await this.store.write(agentSettingsPath(this.store['dir'], agentId), validated);
    this.currentSettings.set(agentId, validated);
    this.registry.updateSettingsHash(agentId, newHash);

    this.emit('settings:applied', agentId, newHash);
    return { ok: true };
  }

  async loadCurrentSettings(agentId: string): Promise<Record<string, unknown> | null> {
    if (this.currentSettings.has(agentId)) {
      return this.currentSettings.get(agentId)!;
    }

    const loaded = await this.store.read<Record<string, unknown>>(
      agentSettingsPath(this.store['dir'], agentId)
    );

    if (loaded) {
      this.currentSettings.set(agentId, loaded);
    }
    return loaded;
  }

  onSettingsApplied(agentId: string, hash: string): void {
    this.pending.delete(agentId);
    this.registry.updateSettingsHash(agentId, hash);
  }

  onSettingsRejected(agentId: string, errors: ValidationError[]): void {
    this.pending.delete(agentId);
    this.emit('settings:rejected', agentId, errors);
  }

  getPending(agentId: string): PendingSettingsPush | undefined {
    return this.pending.get(agentId);
  }

  private applyPatch(
    current: Record<string, unknown>,
    patch: SettingsPatch[]
  ): Record<string, unknown> {
    const result = { ...current };

    for (const op of patch) {
      const pathParts = op.path.split('/').filter(Boolean);

      switch (op.op) {
        case 'add':
        case 'replace': {
          let target = result;
          for (let i = 0; i < pathParts.length - 1; i++) {
            const key = pathParts[i];
            if (!(key in target) || typeof target[key] !== 'object') {
              target[key] = {};
            }
            target = target[key] as Record<string, unknown>;
          }
          const lastKey = pathParts[pathParts.length - 1];
          target[lastKey] = op.value;
          break;
        }
        case 'remove': {
          let target = result;
          for (let i = 0; i < pathParts.length - 1; i++) {
            const key = pathParts[i];
            if (!(key in target)) break;
            target = target[key] as Record<string, unknown>;
          }
          const lastKey = pathParts[pathParts.length - 1];
          delete target[lastKey];
          break;
        }
        case 'test': {
          let target = result;
          for (const key of pathParts) {
            if (!(key in target)) {
              throw new Error(`test failed at ${op.path}`);
            }
            target = target[key] as Record<string, unknown>;
          }
          if (target !== op.value) {
            throw new Error(`test failed at ${op.path}: value mismatch`);
          }
          break;
        }
      }
    }

    return result;
  }
}
