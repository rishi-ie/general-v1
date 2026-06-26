import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs/promises";
import type { SettingsPatch } from "./types";

export interface SettingsStore {
  get<T>(module: string): T | null;
  set<T>(module: string, settings: T): void;
  applyPatch(patch: SettingsPatch[]): Record<string, unknown>;
  hash(): string;
  load(): Promise<void>;
  flush(): Promise<void>;
}

export class JsonFileSettingsStore implements SettingsStore {
  private data = new Map<string, Record<string, unknown>>();
  private dataDir: string;
  private file: string;
  private dirty = false;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.file = path.join(dataDir, "settings.json");
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.file, "utf-8");
      const parsed = JSON.parse(raw) as Record<string, Record<string, unknown>>;
      for (const [k, v] of Object.entries(parsed)) {
        this.data.set(k, v);
      }
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }
  }

  async flush(): Promise<void> {
    if (!this.dirty) return;
    const obj: Record<string, Record<string, unknown>> = {};
    for (const [k, v] of this.data) {
      obj[k] = v;
    }
    const tmp = this.file + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(obj, null, 2));
    await fs.rename(tmp, this.file);
    this.dirty = false;
  }

  get<T>(module: string): T | null {
    return (this.data.get(module) as T) ?? null;
  }

  set<T>(module: string, settings: T): void {
    this.data.set(module, settings as Record<string, unknown>);
    this.dirty = true;
  }

  hash(): string {
    const canonical = JSON.stringify(Object.fromEntries([...this.data.entries()].sort()), null, 2);
    return crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 16);
  }

  applyPatch(patch: SettingsPatch[]): Record<string, unknown> {
    let current: Record<string, unknown> = {};
    for (const [k, v] of this.data) {
      current[k] = v;
    }

    for (const op of patch) {
      const parts = op.path.split("/").filter(Boolean);
      if (parts.length === 0) continue;

      if (op.path === "/") {
        if (op.op === "replace" || op.op === "add") {
          current = op.value as Record<string, unknown>;
        } else if (op.op === "remove") {
          current = {};
        }
        continue;
      }

      let target = current;
      for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        if (!(key in target) || typeof target[key] !== "object") {
          target[key] = {};
        }
        target = target[key] as Record<string, unknown>;
      }

      const last = parts[parts.length - 1];

      switch (op.op) {
        case "add":
        case "replace":
          target[last] = op.value;
          break;
        case "remove":
          delete target[last];
          break;
        case "test":
          if (target[last] !== op.value) {
            throw new Error(`patch test failed at ${op.path}`);
          }
          break;
      }
    }

    return current;
  }
}
