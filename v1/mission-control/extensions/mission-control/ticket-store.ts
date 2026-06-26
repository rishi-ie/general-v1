import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { BASE_DIR, INDEX_FILE, TICKETS_DIR, getTicketPath } from "./constants.js";
import type { Ticket, TicketIndex, TicketStore } from "./types.js";

function generateTicketId(): string {
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const uuid = Math.random().toString(36).substring(2, 10);
  return `MC-${date}-${uuid}`;
}

function ensureDirectory(cwd: string): void {
  const base = resolve(cwd, BASE_DIR);
  const tickets = resolve(cwd, TICKETS_DIR);
  if (!existsSync(base)) mkdirSync(base, { recursive: true });
  if (!existsSync(tickets)) mkdirSync(tickets, { recursive: true });
}

function readJsonFile<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null;
    const content = readFileSync(path, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

function writeJsonFile(path: string, data: unknown): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const content = JSON.stringify(data, null, 2);
  writeFileSync(path, content, "utf-8");
}

function atomicWrite(path: string, data: unknown): void {
  const tmp = `${path}.tmp`;
  writeJsonFile(tmp, data);
  renameSync(tmp, path);
}

export class FileTicketStore implements TicketStore {
  constructor(private cwd: string) {}

  private readIndex(): TicketIndex {
    return readJsonFile<TicketIndex>(resolve(this.cwd, INDEX_FILE)) ?? {};
  }

  private writeIndex(index: TicketIndex): void {
    atomicWrite(resolve(this.cwd, INDEX_FILE), index);
  }

  private ensureInit(): void {
    ensureDirectory(this.cwd);
    const indexPath = resolve(this.cwd, INDEX_FILE);
    if (!existsSync(indexPath)) {
      this.writeIndex({});
    }
  }

  generateId(): string {
    return generateTicketId();
  }

  async getTicket(id: string): Promise<Ticket | null> {
    this.ensureInit();
    const path = getTicketPath(this.cwd, id);
    return readJsonFile<Ticket>(path);
  }

  async getAllTickets(): Promise<Ticket[]> {
    this.ensureInit();
    const index = this.readIndex();
    const tickets: Ticket[] = [];

    for (const id of Object.keys(index)) {
      const ticket = await this.getTicket(id);
      if (ticket) tickets.push(ticket);
    }

    return tickets.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
  }

  async saveTicket(ticket: Ticket): Promise<void> {
    this.ensureInit();
    const path = getTicketPath(this.cwd, ticket.id);
    atomicWrite(path, ticket);

    const index = this.readIndex();
    index[ticket.id] = ticket.id;
    this.writeIndex(index);
  }

  async deleteTicket(id: string): Promise<void> {
    const path = getTicketPath(this.cwd, id);
    if (existsSync(path)) {
      unlinkSync(path);
    }

    const index = this.readIndex();
    delete index[id];
    this.writeIndex(index);
  }

  async rebuildIndex(): Promise<void> {
    this.ensureInit();
    const ticketsDir = resolve(this.cwd, TICKETS_DIR);
    if (!existsSync(ticketsDir)) return;

    const files = readdirSync(ticketsDir).filter((f) => f.endsWith(".json"));
    const index: TicketIndex = {};

    for (const file of files) {
      const id = file.replace(".json", "");
      const ticket = readJsonFile<Ticket>(resolve(ticketsDir, file));
      if (ticket && ticket.id === id) {
        index[id] = id;
      }
    }

    this.writeIndex(index);
  }
}
