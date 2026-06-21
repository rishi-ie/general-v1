# Communication Module — Implementation Guide

**Version**: 1.0.0
**Purpose**: Step-by-step guide to implementing the agent-side communication module from scratch.

---

## 1. Overview

The agent-side communication module is a **Pi Agent extension** that:
1. Connects to SuperHive via WebSocket
2. Registers the agent's identity and capabilities
3. Handles incoming messages (settings, permissions, commands, messages)
4. Sends outgoing messages (state, permission requests, inter-agent messages)
5. Manages reconnection and heartbeat

**Files to create**:
```
v1/communication/extensions/communication/
├── index.ts          # Main extension entry + lifecycle
├── websocket.ts      # WebSocket client
├── settings-store.ts # Settings persistence + JSON Patch
├── types.ts          # TypeScript interfaces
└── envelope.ts       # ID generation
```

---

## 2. Step 1: Types (`types.ts`)

Start with the type definitions. This is the contract for the entire module.

**File**: `extensions/communication/types.ts`

```typescript
export const PROTOCOL_VERSION = 1;

// === Envelope ===

export interface Envelope<T = unknown> {
  v: 1;
  type: string;
  id: string;
  ts: number;
  corr?: string;
  from?: string;
  to?: string;
  payload: T;
}

// === Manifest ===

export interface AgentManifest {
  name: string;
  version: string;
  description?: string;
  capabilities: string[];
  settingsSchema: Record<string, unknown>;
  permissions?: string[];
  interAgent?: {
    acceptsDMs: boolean;
    acceptsBroadcasts: boolean;
    groups: string[];
  };
  modules?: Record<string, ModuleInfo>;
}

export interface ModuleInfo {
  version: string;
  settingsSchema: Record<string, unknown>;
}

// === State ===

export interface AgentState {
  currentTask?: string;
  phase?: string;
  subAgents?: SubAgentStatus[];
}

export interface SubAgentStatus {
  id: string;
  type: string;
  status: 'running' | 'paused' | 'done' | 'failed';
}

export interface Metrics {
  tokensUsed?: number;
  toolCalls?: number;
  turns?: number;
  errors?: number;
}

// === Messaging ===

export interface InterAgentMessage {
  messageId: string;
  to?: string;
  group?: string;
  broadcast?: boolean;
  kind: 'text' | 'request' | 'response' | 'event';
  payload: unknown;
  from: string;
  receivedAt: number;
}

// === Authority ===

export interface AuthorityGrant {
  grantId: string;
  fromAgentId: string;
  toAgentId: string;
  scope: AuthorityScope;
  createdAt: number;
  expiresAt?: number;
  revokedAt?: number;
}

export interface AuthorityScope {
  tools?: string[];
  paths?: string[];
  actions?: string[];
}

// === Permission ===

export interface PendingRequest {
  requestId: string;
  tool: string;
  args: unknown;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface PermissionDecision {
  decision: 'allow' | 'deny';
  reason?: string;
  remember?: boolean;
}

// === Settings ===

export interface SettingsPatch {
  op: 'add' | 'remove' | 'replace' | 'test';
  path: string;
  value?: unknown;
}

export interface ValidationError {
  path: string;
  message: string;
}

// === Presence ===

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline';

// === Command ===

export type HostCommand = 'reload' | 'restart' | 'pause' | 'resume';
```

---

## 3. Step 2: ID Generation (`envelope.ts`)

Generate ULID-style unique IDs for messages.

**File**: `extensions/communication/envelope.ts`

```typescript
export function generateId(): string {
  const t = Date.now();
  const r = Math.random().toString(36).slice(2, 10);
  const p = Math.random().toString(36).slice(2, 6);
  return `${t.toString(36)}-${r}-${p}`;
}
```

---

## 4. Step 3: Settings Store (`settings-store.ts`)

The settings store manages persisted settings and JSON Patch application.

**File**: `extensions/communication/settings-store.ts`

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { SettingsPatch } from './types';

const DATA_DIR = path.join(os.homedir(), '.general-v1', 'communication');

export class JsonFileSettingsStore {
  private data = new Map<string, Record<string, unknown>>();
  private file: string;
  private dirty = false;

  constructor() {
    this.file = path.join(DATA_DIR, 'settings.json');
  }

  async load(): Promise<void> {
    try {
      const raw = await fs.readFile(this.file, 'utf-8');
      const parsed = JSON.parse(raw) as Record<string, Record<string, unknown>>;
      for (const [k, v] of Object.entries(parsed)) {
        this.data.set(k, v);
      }
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  async flush(): Promise<void> {
    if (!this.dirty) return;
    const obj: Record<string, Record<string, unknown>> = {};
    for (const [k, v] of this.data) obj[k] = v;
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
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
    const entries = [...this.data.entries()].sort(([a], [b]) => a.localeCompare(b));
    const canonical = JSON.stringify(Object.fromEntries(entries));
    return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
  }

  applyPatch(patch: SettingsPatch[]): Record<string, unknown> {
    let current: Record<string, unknown> = {};
    for (const [k, v] of this.data) current[k] = v;

    for (const op of patch) {
      const parts = op.path.split('/').filter(Boolean);

      if (op.path === '/') {
        if (op.op === 'replace' || op.op === 'add') current = op.value as Record<string, unknown>;
        else if (op.op === 'remove') current = {};
        continue;
      }

      let target: Record<string, unknown> = current;
      for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        if (!(key in target) || typeof target[key] !== 'object') target[key] = {};
        target = target[key] as Record<string, unknown>;
      }

      const last = parts[parts.length - 1];

      switch (op.op) {
        case 'add':
        case 'replace':
          target[last] = op.value;
          break;
        case 'remove':
          delete target[last];
          break;
        case 'test':
          if (target[last] !== op.value) throw new Error(`test failed at ${op.path}`);
          break;
      }
    }

    this.dirty = true;
    return current;
  }
}
```

---

## 5. Step 4: WebSocket Client (`websocket.ts`)

The WebSocket client manages the TCP connection, reconnection, and heartbeat.

**File**: `extensions/communication/websocket.ts`

```typescript
import WebSocket from 'ws';
import { Envelope, PROTOCOL_VERSION } from './types';
import { generateId } from './envelope';

export interface WsConfig {
  url: string;
  apiKey?: string;
  heartbeatIntervalMs: number;
  reconnect: {
    maxAttempts: number;
    backoffMs: number[];
  };
}

export class CommunicationSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private retry = 0;
  private retryTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private intentionalClose = false;
  private connected = false;
  private pendingRequests = new Map<string, (env: Envelope) => void>();

  constructor(
    private config: WsConfig,
    private log: (msg: string, data?: Record<string, unknown>) => void
  ) {
    super();
  }

  async connect(): Promise<void> {
    this.intentionalClose = false;

    const headers: Record<string, string> = {};
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url, { headers });
      } catch (err) {
        reject(err);
        return;
      }

      this.ws.on('open', () => {
        this.connected = true;
        this.retry = 0;
        this.log(`connected to ${this.config.url}`);
        this.startHeartbeat();
        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const env = JSON.parse(data.toString()) as Envelope;
          if (env.v !== PROTOCOL_VERSION) {
            this.log(`unsupported protocol version: ${env.v}`);
            return;
          }
          if (env.corr && this.pendingRequests.has(env.corr)) {
            const resolver = this.pendingRequests.get(env.corr)!;
            this.pendingRequests.delete(env.corr);
            resolver(env);
          }
          this.emit('message', env);
        } catch (err) {
          this.log(`parse error: ${String(err)}`);
        }
      });

      this.ws.on('close', (code, reason) => {
        this.connected = false;
        this.stopHeartbeat();
        this.emit('disconnected', code, reason.toString());
        if (!this.intentionalClose) this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        this.log(`socket error: ${String(err)}`);
        this.emit('error', err);
      });
    });
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) return;
    const { maxAttempts, backoffMs } = this.config.reconnect;
    if (maxAttempts > 0 && this.retry >= maxAttempts) {
      this.emit('reconnect_failed');
      return;
    }
    const delay = backoffMs[Math.min(this.retry, backoffMs.length - 1)];
    this.retry++;
    this.log(`reconnecting in ${delay}ms (attempt ${this.retry})`);
    this.retryTimer = setTimeout(() => {
      this.connect().catch((err) => this.log(`reconnect failed: ${String(err)}`));
    }, delay);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
        this.emit('heartbeat');
      }
    }, this.config.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
  }

  send<T>(type: string, payload: T): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.log(`not connected, dropping: ${type}`);
      return;
    }
    const env: Envelope<T> = {
      v: PROTOCOL_VERSION,
      ts: Date.now(),
      id: generateId(),
      type,
      payload,
    };
    try {
      this.ws.send(JSON.stringify(env));
    } catch (err) {
      this.log(`send failed: ${String(err)}`);
    }
  }

  close(code = 1000, reason = 'agent shutting down'): void {
    this.intentionalClose = true;
    this.stopHeartbeat();
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
    if (this.ws) {
      try { this.ws.close(code, reason); } catch { /* ignore */ }
      this.ws = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }
}

import { EventEmitter } from 'events';
```

---

## 6. Step 5: Main Extension (`index.ts`)

The main entry point wires everything together and handles the Pi Agent lifecycle.

**File**: `extensions/communication/index.ts`

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { CommunicationSocket, WsConfig } from './websocket';
import { JsonFileSettingsStore } from './settings-store';
import {
  Envelope,
  AgentManifest,
  AgentState,
  Metrics,
  InterAgentMessage,
  PermissionDecision,
  SettingsPatch,
  PendingRequest,
  AuthorityGrant,
} from './types';
import { generateId } from './envelope';

const DATA_DIR = path.join(os.homedir(), '.general-v1', 'communication');

let socket: CommunicationSocket;
let settingsStore: JsonFileSettingsStore;
let currentState: AgentState = {};
let currentMetrics: Metrics = {};
let manifest: AgentManifest | null = null;
let agentId = '';
let sessionId = '';
let connected = false;
let pendingPermissions = new Map<string, {
  resolve: (d: PermissionDecision) => void;
  timeout: ReturnType<typeof setTimeout>;
}>();

function log(msg: string, data?: Record<string, unknown>): void {
  console.log(`[communication] ${msg}`, data ?? {});
}

async function loadConfig(): Promise<WsConfig> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, 'config.json'), 'utf-8');
    const cfg = JSON.parse(raw);
    return {
      url: cfg.host?.url ?? 'ws://127.0.0.1:7711',
      apiKey: cfg.host?.apiKey ?? '',
      heartbeatIntervalMs: cfg.heartbeatIntervalMs ?? 15000,
      reconnect: {
        maxAttempts: cfg.reconnect?.maxAttempts ?? -1,
        backoffMs: cfg.reconnect?.backoffMs ?? [500, 1000, 5000, 30000],
      },
    };
  } catch {
    return {
      url: 'ws://127.0.0.1:7711',
      heartbeatIntervalMs: 15000,
      reconnect: { maxAttempts: -1, backoffMs: [500, 1000, 5000, 30000] },
    };
  }
}

async function loadManifest(): Promise<AgentManifest> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, 'schema.json'), 'utf-8');
    return JSON.parse(raw) as AgentManifest;
  } catch {
    return {
      name: 'general-v1',
      version: '1.0.0',
      description: 'General purpose digital employee',
      capabilities: ['planning', 'browser', 'memory', 'sub-agents'],
      settingsSchema: {},
    };
  }
}

function sendHello(): void {
  socket.send('AGENT_HELLO', { manifest, version: manifest?.version, capabilities: manifest?.capabilities });
}

function sendState(): void {
  socket.send('AGENT_STATE', { state: currentState, metrics: currentMetrics });
}

async function handleMessage(env: Envelope): Promise<void> {
  log(`received: ${env.type}`);

  switch (env.type) {
    case 'HOST_WELCOME': {
      const p = env.payload as { agentId: string; sessionId: string; serverVersion: string; heartbeatIntervalMs: number };
      agentId = p.agentId;
      sessionId = p.sessionId;
      connected = true;
      log(`registered as ${agentId}`);
      await settingsStore.load();
      socket.send('SETTINGS_APPLIED', { settingsHash: settingsStore.hash() });
      break;
    }

    case 'PERMISSION_DECISION': {
      const { requestId, decision, reason, remember } = env.payload as {
        requestId: string; decision: 'allow' | 'deny'; reason?: string; remember?: boolean;
      };
      const pending = pendingPermissions.get(requestId);
      if (pending) {
        clearTimeout(pending.timeout);
        pendingPermissions.delete(requestId);
        pending.resolve({ decision, reason, remember });
      }
      break;
    }

    case 'SETTINGS_UPDATE': {
      const { patch, expectedHash, schema, urgent } = env.payload as {
        patch: SettingsPatch[]; expectedHash: string; schema: Record<string, unknown>; urgent: boolean;
      };
      try {
        settingsStore.applyPatch(patch);
        const newHash = settingsStore.hash();
        if (expectedHash && newHash !== expectedHash) {
          socket.send('SETTINGS_REJECTED', { settingsHash: newHash, reason: 'hash mismatch', errors: [] });
          return;
        }
        await settingsStore.flush();
        socket.send('SETTINGS_APPLIED', { settingsHash: newHash });
        log('settings applied', { urgent });
        onSettingsChanged?.(patch);
      } catch (err) {
        socket.send('SETTINGS_REJECTED', { settingsHash: settingsStore.hash(), reason: String(err), errors: [] });
      }
      break;
    }

    case 'INTER_AGENT_DELIVERY': {
      const msg = env.payload as InterAgentMessage;
      onInterAgentMessage?.(msg);
      break;
    }

    case 'AUTHORITY_REVOKED': {
      const { grantId, reason } = env.payload as { grantId: string; reason: string };
      onAuthorityRevoked?.(grantId, reason);
      break;
    }

    case 'COMMAND': {
      const { command, args } = env.payload as { command: string; args?: Record<string, unknown> };
      onCommand?.(command as 'reload' | 'restart' | 'pause' | 'resume', args);
      break;
    }

    case 'KICK': {
      const { reason } = env.payload as { reason: string };
      log(`kicked: ${reason}`);
      socket.close(4403, reason);
      break;
    }
  }
}

// === Public API ===

export async function requestPermission(
  tool: string,
  args: unknown,
  reason: string,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  timeoutMs = 60000
): Promise<PermissionDecision> {
  if (!socket?.isConnected()) {
    return { decision: 'deny', reason: 'not connected to SuperHive' };
  }

  const requestId = generateId();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingPermissions.delete(requestId);
      resolve({ decision: 'deny', reason: 'timeout' });
    }, timeoutMs);

    pendingPermissions.set(requestId, { resolve, timeout: timer });

    socket.send('PERMISSION_REQUEST', { requestId, tool, args, reason, severity });
    log('permission requested', { requestId, tool, severity });
  });
}

export function sendInterAgentMessage(
  to: string | undefined,
  broadcast: boolean,
  group: string | undefined,
  kind: InterAgentMessage['kind'],
  payload: unknown
): void {
  if (!socket?.isConnected()) { log('not connected, cannot send message'); return; }
  socket.send('INTER_AGENT_MESSAGE', { messageId: generateId(), to, broadcast, group, kind, payload });
}

export function grantAuthority(toAgentId: string, scope: AuthorityGrant['scope'], expiresAt?: number): void {
  if (!socket?.isConnected()) return;
  socket.send('AUTHORITY_GRANT', { grantId: generateId(), toAgentId, scope, expiresAt });
}

export function revokeAuthority(grantId: string): void {
  if (!socket?.isConnected()) return;
  socket.send('AUTHORITY_REVOKE', { grantId });
}

export function updatePresence(status: 'online' | 'away' | 'busy', activity?: string): void {
  socket?.send('PRESENCE_UPDATE', { status, activity });
}

export function updateState(state: AgentState, metrics?: Metrics): void {
  currentState = state;
  if (metrics) currentMetrics = metrics;
  if (connected) sendState();
}

// === Callbacks ===

let onInterAgentMessage: ((msg: InterAgentMessage) => void) | null = null;
let onAuthorityRevoked: ((grantId: string, reason: string) => void) | null = null;
let onPresenceSnapshot: ((agents: Array<{ agentId: string; status: string; activity?: string }>) => void) | null = null;
let onCommand: ((cmd: 'reload' | 'restart' | 'pause' | 'resume', args?: Record<string, unknown>) => void) | null = null;
let onSettingsChanged: ((patch: SettingsPatch[]) => void) | null = null;

export function setOnInterAgentMessage(fn: (msg: InterAgentMessage) => void): void { onInterAgentMessage = fn; }
export function setOnAuthorityRevoked(fn: (grantId: string, reason: string) => void): void { onAuthorityRevoked = fn; }
export function setOnPresenceSnapshot(fn: (agents: Array<{ agentId: string; status: string; activity?: string }>) => void): void { onPresenceSnapshot = fn; }
export function setOnCommand(fn: (cmd: 'reload' | 'restart' | 'pause' | 'resume', args?: Record<string, unknown>) => void): void { onCommand = fn; }
export function setOnSettingsChanged(fn: (patch: SettingsPatch[]) => void): void { onSettingsChanged = fn; }

// === Extension Entry Point ===

export default async function communication(
  pi: { on(event: string, cb: () => void | Promise<void>): void }
): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  settingsStore = new JsonFileSettingsStore();
  await settingsStore.load();

  const config = await loadConfig();
  manifest = await loadManifest();

  socket = new CommunicationSocket(config, log);

  socket.on('connected', async () => {
    await sendHello();
  });

  socket.on('message', async (env) => {
    await handleMessage(env);
  });

  socket.on('disconnected', (code, reason) => {
    log(`disconnected: ${code} ${reason}`);
    connected = false;
  });

  socket.on('error', (err) => {
    log(`socket error: ${String(err)}`);
  });

  socket.on('reconnect_failed', () => {
    log('reconnect failed — will not retry');
  });

  pi.on('session_start', async () => {
    try {
      await socket.connect();
    } catch (err) {
      log(`initial connect failed: ${String(err)}`);
    }
  });

  pi.on('session_end', () => {
    socket?.send('DISCONNECT', { reason: 'session ended' });
    socket?.close(1000, 'session ended');
  });

  // State stream every 30s
  setInterval(() => {
    if (connected) sendState();
  }, 30000);
}
```

---

## 7. Step 6: Package and Export

**File**: `extensions/communication/index.ts` (add exports at the bottom)

```typescript
export {
  requestPermission,
  sendInterAgentMessage,
  grantAuthority,
  revokeAuthority,
  updatePresence,
  updateState,
  setOnInterAgentMessage,
  setOnAuthorityRevoked,
  setOnPresenceSnapshot,
  setOnCommand,
  setOnSettingsChanged,
};
```

---

## 8. Step 7: Configuration Files

### config.json

**File**: `~/.general-v1/communication/config.json`

```json
{
  "host": {
    "url": "ws://127.0.0.1:7711",
    "apiKey": ""
  },
  "reconnect": {
    "maxAttempts": -1,
    "backoffMs": [500, 1000, 5000, 30000]
  },
  "heartbeatIntervalMs": 15000,
  "permissions": {
    "requireSuperhiveApproval": ["file_delete", "command_execute", "sub_agent_spawn"]
  }
}
```

### schema.json

**File**: `~/.general-v1/communication/schema.json`

```json
{
  "name": "general-v1",
  "version": "1.0.0",
  "description": "General purpose digital employee",
  "capabilities": ["planning", "browser", "memory", "sub-agents"],
  "settingsSchema": {},
  "interAgent": {
    "acceptsDMs": true,
    "acceptsBroadcasts": true,
    "groups": ["general", "software", "research"]
  }
}
```

---

## 9. Step 8: Testing Strategy

### 9.1 Unit Tests

Test each component in isolation:

```typescript
// test settings-store.ts
const store = new JsonFileSettingsStore();
store.set('test', { value: 1 });
const patch = [{ op: 'replace', path: '/test/value', value: 2 }];
const result = store.applyPatch(patch);
assert(result.test.value === 2);

// test envelope.ts
const id = generateId();
assert(id.match(/^[0-9a-z]+-[0-9a-z]+-[0-9a-z]+$/));
```

### 9.2 Integration Tests

Test the WebSocket client with a mock SuperHive:

```typescript
// Start a mock WebSocket server
const wss = new WebSocketServer({ port: 7799 });
wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    const env = JSON.parse(data.toString());
    if (env.type === 'AGENT_HELLO') {
      ws.send(JSON.stringify({ v: 1, type: 'HOST_WELCOME', id: 'x', ts: Date.now(), payload: { agentId: 'test', sessionId: 's', serverVersion: '1.0', heartbeatIntervalMs: 15000 } }));
    }
  });
});

// Connect the client
const socket = new CommunicationSocket({ url: 'ws://localhost:7799', heartbeatIntervalMs: 15000, reconnect: { maxAttempts: 1, backoffMs: [100] } }, console.log);
await socket.connect();
assert(socket.isConnected() === true);
```

### 9.3 End-to-End Test

1. Start SuperHive (real or mock)
2. Load the communication extension
3. Verify AGENT_HELLO is sent
4. Verify HOST_WELCOME is received
5. Verify permission flow
6. Verify settings push
7. Verify inter-agent message

---

## 10. Dependencies

```json
{
  "dependencies": {
    "ws": "^8.18.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/ws": "^8.5.13",
    "typescript": "^5.7.0"
  }
}
```

Install: `npm install ws && npm install -D @types/node @types/ws typescript`

---

## 11. Loading the Extension

### Via command line:

```bash
pi --extension ./v1/communication/extensions/communication/index.ts
```

### Via config:

```json
{
  "extensions": [
    "v1/communication/extensions/communication/index.ts"
  ]
}
```

---

## 12. Checklist

Before considering implementation complete:

- [ ] Types compile without errors
- [ ] ID generation produces unique IDs
- [ ] Settings store loads/saves/flushes correctly
- [ ] JSON Patch apply works (add, remove, replace, test)
- [ ] WebSocket connects to SuperHive
- [ ] AGENT_HELLO is sent with manifest
- [ ] HOST_WELCOME is received and parsed
- [ ] Permission request/decision flow works
- [ ] Settings push/reject/apply works
- [ ] Inter-agent messages send and receive
- [ ] Reconnection with backoff works
- [ ] Heartbeat keeps connection alive
- [ ] Graceful disconnect sends DISCONNECT
- [ ] KICK closes with correct code
- [ ] State streams every 30s
- [ ] Presence updates work
- [ ] Authority grant/revoke works
- [ ] Command handling works
- [ ] Settings changed callback fires
- [ ] Logs are informative and consistent
- [ ] Module exports all public functions
