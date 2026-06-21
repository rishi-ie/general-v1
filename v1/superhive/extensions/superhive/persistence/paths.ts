import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

function expandTilde(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return path.join(os.homedir(), p.slice(1));
  }
  return p;
}

export function getDataDir(configuredDir: string): string {
  const dir = expandTilde(configuredDir);
  ensureDir(dir);
  return dir;
}

export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function agentSettingsPath(dataDir: string, agentId: string): string {
  return path.join(dataDir, 'settings', `${sanitizeFilename(agentId)}.json`);
}

export function agentPermissionsPath(dataDir: string, agentId: string): string {
  return path.join(dataDir, 'permissions', `${sanitizeFilename(agentId)}.json`);
}

export function messagesPath(dataDir: string, date: string): string {
  const dir = path.join(dataDir, 'messages');
  ensureDir(dir);
  return path.join(dir, `${date}.jsonl`);
}

export function auditPath(dataDir: string, date: string): string {
  const dir = path.join(dataDir, 'audit');
  ensureDir(dir);
  return path.join(dir, `${date}.jsonl`);
}

export function logPath(dataDir: string, date: string): string {
  const dir = path.join(dataDir, 'logs');
  ensureDir(dir);
  return path.join(dir, `${date}.log`);
}

export function agentsPath(dataDir: string): string {
  return path.join(dataDir, 'agents.json');
}

export function authorityPath(dataDir: string): string {
  return path.join(dataDir, 'authority.json');
}

export function presenceSnapshotPath(dataDir: string): string {
  return path.join(dataDir, 'presence-snapshot.json');
}

export function configPath(dataDir: string): string {
  return path.join(dataDir, 'config.json');
}

export function hostKeyPath(dataDir: string): string {
  return path.join(dataDir, 'host.key');
}

export function todayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}
