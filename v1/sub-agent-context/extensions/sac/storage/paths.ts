import * as os from "node:os";
import * as path from "node:path";

export function expandPath(p: string): string {
  if (!p) return p;
  if (p.startsWith("~/")) {
    return path.join(os.homedir(), p.slice(2));
  }
  if (p === "~") {
    return os.homedir();
  }
  if (p.startsWith("./") || p.startsWith("../")) {
    const root = process.env.GENERAL_ROOT || process.cwd();
    return path.resolve(root, p);
  }
  return p;
}

export function getStoragePath(configPath?: string): string {
  const base = configPath ?? "~/.general-v1/sac";
  return expandPath(base);
}

export const STORAGE_DIR = getStoragePath();

export const META_STATE_FILE = "meta-state.json";
export const DECISION_LEDGER_FILE = "decision-ledger.json";
export const LINEAGE_DIR = "lineage";
export const SNAPSHOTS_DIR = "snapshots";

export function getMetaStatePath(basePath?: string): string {
  return path.join(getStoragePath(basePath), META_STATE_FILE);
}
export function getDecisionLedgerPath(basePath?: string): string {
  return path.join(getStoragePath(basePath), DECISION_LEDGER_FILE);
}
export function getLineagePath(basePath?: string): string {
  return path.join(getStoragePath(basePath), LINEAGE_DIR);
}
export function getSnapshotsPath(basePath?: string): string {
  return path.join(getStoragePath(basePath), SNAPSHOTS_DIR);
}
export function getEpochPath(epochId: string, basePath?: string): string {
  return path.join(getLineagePath(basePath), `epoch-${epochId}.json`);
}
