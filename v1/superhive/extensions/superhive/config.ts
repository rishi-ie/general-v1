import * as fs from 'fs/promises';
import * as path from 'path';
import { getDataDir, ensureDir } from './persistence/paths';
import { Logger } from './logger';

export interface SuperhiveConfig {
  mode: 'localhost' | 'remote';
  publicHost: string;
  publicPort: number;
  internalUrl: string;
  heartbeatIntervalMs: number;
  heartbeatTimeoutMs: number;
  dataDir: string;
  maxPayloadBytes: number;
  rateLimitPerSecond: number;
  log: {
    level: 'debug' | 'info' | 'warn' | 'error';
    pretty: boolean;
  };
  auth: {
    required: boolean;
    staticKeys?: Record<string, { name: string; scopes: string[] }>;
  };
}

const DEFAULT_CONFIG: SuperhiveConfig = {
  mode: 'localhost',
  publicHost: '127.0.0.1',
  publicPort: 7711,
  internalUrl: 'ws://127.0.0.1:7712',
  heartbeatIntervalMs: 15000,
  heartbeatTimeoutMs: 30000,
  dataDir: '~/.superhive',
  maxPayloadBytes: 1 << 20,
  rateLimitPerSecond: 100,
  log: {
    level: 'info',
    pretty: true,
  },
  auth: {
    required: false,
  },
};

function applyEnvOverrides(cfg: SuperhiveConfig): SuperhiveConfig {
  if (process.env.SUPERHIVE_PUBLIC_PORT) {
    cfg.publicPort = parseInt(process.env.SUPERHIVE_PUBLIC_PORT, 10);
  }
  if (process.env.SUPERHIVE_INTERNAL_URL) {
    cfg.internalUrl = process.env.SUPERHIVE_INTERNAL_URL;
  }
  if (process.env.SUPERHIVE_MODE) {
    cfg.mode = process.env.SUPERHIVE_MODE as 'localhost' | 'remote';
  }
  if (process.env.SUPERHIVE_LOG_LEVEL) {
    cfg.log.level = process.env.SUPERHIVE_LOG_LEVEL as SuperhiveConfig['log']['level'];
  }
  if (process.env.SUPERHIVE_AUTH_REQUIRED) {
    cfg.auth.required = process.env.SUPERHIVE_AUTH_REQUIRED === 'true';
  }
  return cfg;
}

export async function loadConfig(cfgPath?: string, log?: Logger): Promise<SuperhiveConfig> {
  const dataDir = getDataDir(DEFAULT_CONFIG.dataDir);
  const file = cfgPath ?? path.join(dataDir, 'config.json');

  let cfg = { ...DEFAULT_CONFIG, dataDir };

  try {
    const raw = await fs.readFile(file, 'utf-8');
    const loaded = JSON.parse(raw);
    cfg = { ...cfg, ...loaded, dataDir };
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      log?.warn(`config: failed to load ${file}, using defaults`, { error: String(err) });
    }
  }

  cfg = applyEnvOverrides(cfg);
  ensureDir(cfg.dataDir);

  log?.debug('config loaded', cfg);
  return cfg;
}

export function validateConfig(cfg: unknown): cfg is SuperhiveConfig {
  if (!cfg || typeof cfg !== 'object') return false;
  const c = cfg as Record<string, unknown>;
  return (
    typeof c.mode === 'string' &&
    (c.mode === 'localhost' || c.mode === 'remote') &&
    typeof c.publicHost === 'string' &&
    typeof c.publicPort === 'number' &&
    typeof c.internalUrl === 'string' &&
    typeof c.heartbeatIntervalMs === 'number' &&
    typeof c.dataDir === 'string'
  );
}
