import * as crypto from 'crypto';
import { Store } from '../persistence/store';
import { Logger } from '../logger';
import { hostKeyPath } from '../persistence/paths';

export interface ApiKeyEntry {
  name: string;
  keyHash: string;
  scopes: string[];
  createdAt: number;
}

export class ApiKeyStore {
  private keys = new Map<string, ApiKeyEntry>();

  constructor(private store: Store, private log?: Logger) {}

  async restore(): Promise<void> {
    try {
      const data = await this.store.read<Record<string, ApiKeyEntry>>('api-keys.json');
      if (data) {
        for (const [k, v] of Object.entries(data)) {
          this.keys.set(k, v);
        }
      }
      this.log?.info(`auth: restored ${this.keys.size} API keys`);
    } catch (err) {
      this.log?.warn('auth: failed to restore API keys', { error: String(err) });
    }
  }

  async persist(): Promise<void> {
    const obj: Record<string, ApiKeyEntry> = {};
    for (const [k, v] of this.keys) {
      obj[k] = v;
    }
    await this.store.write('api-keys.json', obj);
  }

  generateKey(name: string, scopes: string[] = []): { key: string; entry: ApiKeyEntry } {
    const key = crypto.randomBytes(24).toString('base64url');
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    const entry: ApiKeyEntry = {
      name,
      keyHash,
      scopes,
      createdAt: Date.now(),
    };
    this.keys.set(keyHash, entry);
    this.persist();
    this.log?.info('auth: generated new API key', { name, scopes });
    return { key, entry };
  }

  validate(key: string): ApiKeyEntry | null {
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');
    return this.keys.get(keyHash) ?? null;
  }

  revoke(keyHash: string): boolean {
    const deleted = this.keys.delete(keyHash);
    if (deleted) {
      this.persist();
      this.log?.info('auth: revoked API key', { keyHash });
    }
    return deleted;
  }

  list(): Array<{ keyHash: string; entry: ApiKeyEntry }> {
    return [...this.keys.entries()].map(([keyHash, entry]) => ({ keyHash, entry }));
  }

  async getOrCreateHostKey(): Promise<string> {
    const hostKeyFile = hostKeyPath(this.store['dir']);
    try {
      const key = await this.store.read<string>('host.key');
      if (key) return key;
    } catch {
      // fall through
    }

    const key = crypto.randomBytes(32).toString('base64url');
    await this.store.write('host.key', key);
    this.log?.info('auth: generated new host key');
    return key;
  }
}
