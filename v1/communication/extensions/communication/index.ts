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
let agentId: string = '';
let sessionId: string = '';
let connected = false;
let pendingPermissions = new Map<string, { resolve: (d: PermissionDecision) => void; timeout: ReturnType<typeof setTimeout> }>();

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
      reconnect: {
        maxAttempts: -1,
        backoffMs: [500, 1000, 5000, 30000],
      },
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

async function sendHello(): Promise<void> {
  manifest = await loadManifest();
  socket.send('AGENT_HELLO', {
    manifest,
    version: manifest.version,
    capabilities: manifest.capabilities,
  });
}

function sendState(): void {
  socket.send('AGENT_STATE', {
    state: currentState,
    metrics: currentMetrics,
  });
}

async function handleMessage(env: Envelope): Promise<void> {
  log(`received: ${env.type}`);

  switch (env.type) {
    case 'HOST_WELCOME': {
      const payload = env.payload as {
        agentId: string;
        sessionId: string;
        serverVersion: string;
        heartbeatIntervalMs: number;
        assignedGroup?: string;
      };
      agentId = payload.agentId;
      sessionId = payload.sessionId;
      connected = true;
      log(`registered as ${agentId}`, { sessionId: payload.sessionId, serverVersion: payload.serverVersion });

      const cfg = await loadConfig();
      cfg.heartbeatIntervalMs = payload.heartbeatIntervalMs;
      socket = new CommunicationSocket(cfg, log);

      await settingsStore.load();
      const hash = settingsStore.hash();
      socket.send('SETTINGS_APPLIED', { settingsHash: hash });

      break;
    }

    case 'PERMISSION_DECISION': {
      const { requestId, decision, reason, remember } = env.payload as {
        requestId: string;
        decision: 'allow' | 'deny';
        reason?: string;
        remember?: boolean;
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
        patch: SettingsPatch[];
        expectedHash: string;
        schema: Record<string, unknown>;
        urgent: boolean;
      };

      try {
        const updated = settingsStore.applyPatch(patch);
        const newHash = settingsStore.hash();

        if (expectedHash && newHash !== expectedHash) {
          socket.send('SETTINGS_REJECTED', {
            settingsHash: newHash,
            reason: 'hash mismatch after apply',
            errors: [{ path: '', message: 'applied settings do not match expected hash' }],
          });
          return;
        }

        await settingsStore.flush();
        socket.send('SETTINGS_APPLIED', { settingsHash: newHash });
        log('settings applied', { urgent });

        if (urgent) {
          log('urgent settings change — reloading configuration');
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        socket.send('SETTINGS_REJECTED', {
          settingsHash: settingsStore.hash(),
          reason: errMsg,
          errors: [{ path: '', message: errMsg }],
        });
      }
      break;
    }

    case 'INTER_AGENT_DELIVERY': {
      const msg = env.payload as InterAgentMessage;
      log('inter-agent message received', { from: msg.from, kind: msg.kind });
      onInterAgentMessage?.(msg);
      break;
    }

    case 'AUTHORITY_REVOKED': {
      const { grantId, reason } = env.payload as { grantId: string; reason: string };
      log('authority revoked', { grantId, reason });
      onAuthorityRevoked?.(grantId, reason);
      break;
    }

    case 'PRESENCE_SNAPSHOT': {
      const { agents } = env.payload as { agents: Array<{ agentId: string; status: string; activity?: string }> };
      onPresenceSnapshot?.(agents);
      break;
    }

    case 'COMMAND': {
      const { command, args } = env.payload as { command: string; args?: Record<string, unknown> };
      log('command received', { command, args });
      onCommand?.(command as 'reload' | 'restart' | 'pause' | 'resume', args);
      break;
    }

    case 'HEARTBEAT_ACK': {
      log('heartbeat ack received');
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

let onInterAgentMessage: ((msg: InterAgentMessage) => void) | null = null;
let onAuthorityRevoked: ((grantId: string, reason: string) => void) | null = null;
let onPresenceSnapshot: ((agents: Array<{ agentId: string; status: string; activity?: string }>) => void) | null = null;
let onCommand: ((cmd: 'reload' | 'restart' | 'pause' | 'resume', args?: Record<string, unknown>) => void) | null = null;

export async function requestPermission(
  tool: string,
  args: unknown,
  reason: string,
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  timeoutMs = 60000
): Promise<PermissionDecision> {
  if (!socket?.isConnected()) {
    log('not connected, cannot request permission');
    return { decision: 'deny', reason: 'not connected to SuperHive' };
  }

  const requestId = generateId();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingPermissions.delete(requestId);
      resolve({ decision: 'deny', reason: 'permission request timeout' });
    }, timeoutMs);

    pendingPermissions.set(requestId, { resolve, timeout: timer });

    socket.send('PERMISSION_REQUEST', {
      requestId,
      tool,
      args,
      reason,
      severity,
    });

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
  if (!socket?.isConnected()) {
    log('not connected, cannot send message');
    return;
  }

  socket.send('INTER_AGENT_MESSAGE', {
    messageId: generateId(),
    to,
    broadcast,
    group,
    kind,
    payload,
  });
}

export function grantAuthority(
  toAgentId: string,
  scope: AuthorityGrant['scope'],
  expiresAt?: number
): void {
  if (!socket?.isConnected()) {
    log('not connected, cannot grant authority');
    return;
  }

  socket.send('AUTHORITY_GRANT', {
    grantId: generateId(),
    toAgentId,
    scope,
    expiresAt,
  });
}

export function revokeAuthority(grantId: string): void {
  if (!socket?.isConnected()) {
    log('not connected, cannot revoke authority');
    return;
  }

  socket.send('AUTHORITY_REVOKE', { grantId });
}

export function updatePresence(status: 'online' | 'away' | 'busy', activity?: string): void {
  socket?.send('PRESENCE_UPDATE', { status, activity });
}

export function updateState(state: AgentState, metrics?: Metrics): void {
  currentState = state;
  if (metrics) currentMetrics = metrics;
  if (connected) {
    sendState();
  }
}

export function setOnInterAgentMessage(fn: (msg: InterAgentMessage) => void): void {
  onInterAgentMessage = fn;
}

export function setOnAuthorityRevoked(fn: (grantId: string, reason: string) => void): void {
  onAuthorityRevoked = fn;
}

export function setOnPresenceSnapshot(
  fn: (agents: Array<{ agentId: string; status: string; activity?: string }>) => void
): void {
  onPresenceSnapshot = fn;
}

export function setOnCommand(
  fn: (cmd: 'reload' | 'restart' | 'pause' | 'resume', args?: Record<string, unknown>) => void
): void {
  onCommand = fn;
}

export default async function communication(
  pi: { on(event: string, cb: () => void | Promise<void>): void }
): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  settingsStore = new JsonFileSettingsStore(DATA_DIR);
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

  setInterval(() => {
    if (connected) {
      sendState();
    }
  }, 30000);
}
