import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
  getStoragePath,
  getMetaStatePath,
  getDecisionLedgerPath,
  getLineagePath,
  getSnapshotsPath,
  getEpochPath,
} from "./paths";

export async function ensureStorageDir(basePath?: string): Promise<void> {
  const base = getStoragePath(basePath);
  const lineage = getLineagePath(basePath);
  const snapshots = getSnapshotsPath(basePath);

  await fs.mkdir(base, { recursive: true });
  await fs.mkdir(lineage, { recursive: true });
  await fs.mkdir(snapshots, { recursive: true });
}

export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await fs.rename(tmp, filePath);
}

export async function readMetaState<T>(basePath?: string): Promise<T | null> {
  return readJsonFile<T>(getMetaStatePath(basePath));
}

export async function writeMetaState<T>(data: T, basePath?: string): Promise<void> {
  return writeJsonFile(getMetaStatePath(basePath), data);
}

export async function readDecisionLedger<T>(basePath?: string): Promise<T | null> {
  return readJsonFile<T>(getDecisionLedgerPath(basePath));
}

export async function writeDecisionLedger<T>(data: T, basePath?: string): Promise<void> {
  return writeJsonFile(getDecisionLedgerPath(basePath), data);
}

export async function readEpoch<T>(epochId: string, basePath?: string): Promise<T | null> {
  return readJsonFile<T>(getEpochPath(epochId, basePath));
}

export async function writeEpoch<T>(epochId: string, data: T, basePath?: string): Promise<void> {
  return writeJsonFile(getEpochPath(epochId, basePath), data);
}

export async function listEpochs(basePath?: string): Promise<string[]> {
  const lineageDir = getLineagePath(basePath);
  try {
    const files = await fs.readdir(lineageDir);
    return files
      .filter((f) => f.startsWith("epoch-") && f.endsWith(".json"))
      .map((f) => f.replace("epoch-", "").replace(".json", ""));
  } catch {
    return [];
  }
}

export async function storageExists(basePath?: string): Promise<boolean> {
  try {
    await fs.access(getStoragePath(basePath));
    return true;
  } catch {
    return false;
  }
}
