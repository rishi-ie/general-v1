import * as fs from 'fs/promises';
import * as path from 'path';
import { ensureDir } from './paths';
import { Logger } from '../logger';

export class Store {
  private writeQueue: Promise<void> = Promise.resolve();
  private writeMutex = false;

  constructor(
    private dir: string,
    private log?: Logger
  ) {
    ensureDir(dir);
  }

  async read<T>(name: string): Promise<T | null> {
    const file = path.join(this.dir, name);
    try {
      const data = await fs.readFile(file, 'utf-8');
      return JSON.parse(data) as T;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  async write(name: string, data: unknown): Promise<void> {
    await this.writeQueue;
    this.writeQueue = this.doWrite(name, data);
    return this.writeQueue;
  }

  private async doWrite(name: string, data: unknown): Promise<void> {
    const file = path.join(this.dir, name);
    const tmp = file + '.tmp';
    const content = JSON.stringify(data, null, 2);

    try {
      await fs.writeFile(tmp, content, 'utf-8');
      await fs.rename(tmp, file);
    } catch (err) {
      this.log?.error(`store: failed to write ${name}`, { error: String(err) });
      try {
        await fs.unlink(tmp);
      } catch {
        // ignore
      }
      throw err;
    }
  }

  async append(name: string, line: unknown): Promise<void> {
    const file = path.join(this.dir, name);
    const content = JSON.stringify(line) + '\n';
    try {
      await fs.appendFile(file, content, 'utf-8');
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        ensureDir(path.dirname(file));
        await fs.appendFile(file, content, 'utf-8');
        return;
      }
      throw err;
    }
  }

  async exists(name: string): Promise<boolean> {
    const file = path.join(this.dir, name);
    try {
      await fs.access(file);
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.dir, { withFileTypes: true });
      return entries.filter((e) => e.isFile()).map((e) => e.name);
    } catch {
      return [];
    }
  }

  async load(): Promise<void> {
    ensureDir(this.dir);
  }

  async flush(): Promise<void> {
    await this.writeQueue;
  }
}
