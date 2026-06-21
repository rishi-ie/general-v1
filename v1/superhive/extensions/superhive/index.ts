import { EventEmitter } from 'events';
import { IncomingMessage } from 'http';
import { generateId } from './server/envelope';
import { WebSocketServer } from './server/websocket-server';
import { Connection } from './server/connection';
import { AgentRegistry } from './registry/agent-registry';
import { validateManifest } from './registry/manifest-validator';
import { loadConfig } from './config';
import { Store } from './persistence/store';
import { InternalClient } from './ipc/internal-client';
import { SettingsEngine } from './settings/settings-engine';
import { PermissionRouter } from './permissions/permission-router';
import { Broker } from './messaging/broker';
import { PresenceTracker } from './presence/presence-tracker';
import { AuthorityManager } from './authority/authority-manager';
import { StateAggregator } from './state/state-aggregator';
import { ApiKeyStore } from './auth/api-key-store';
import { Logger } from './logger';
import {
  Envelope,
  AgentManifest,
  AgentRecord,
  AgentState,
  Metrics,
  InterAgentMessage,
  PermissionDecision,
  PendingRequest,
  SettingsPatch,
  AuditEvent,
} from './types';

interface AgentContext {
  conn: Connection;
  record: AgentRecord;
}

interface HostDeps {
  log: Logger;
  registry: AgentRegistry;
  settings: SettingsEngine;
  permissions: PermissionRouter;
  broker: Broker;
  presence: PresenceTracker;
  authority: AuthorityManager;
  state: StateAggregator;
  auth: ApiKeyStore;
  internal: InternalClient;
  store: Store;
}

export default async function superhive(pi: { on(event: string, cb: () => void | Promise<void>): void }): Promise<void> {
  const log = new Logger('superhive', 'debug');
  log.setLevel('debug');

  const cfg = await loadConfig(undefined, log);
  const store = new Store(cfg.dataDir, log);
  await store.load();

  const registry = new AgentRegistry(store, log);
  const settings = new SettingsEngine(registry, store, log);
  const permissions = new PermissionRouter(log);
  const broker = new Broker(registry, store, log);
  const presence = new PresenceTracker(registry, log);
  const authority = new AuthorityManager(store, log);
  const state = new StateAggregator(registry, log);
  const auth = new ApiKeyStore(store, log);
  const internal = new InternalClient(cfg.internalUrl, log);

  const deps: HostDeps = { log, registry, settings, permissions, broker, presence, authority, state, auth, internal, store };

  await registry.restore();
  await authority.restore();
  await auth.restore();

  const server = new WebSocketServer({
    port: cfg.publicPort,
    host: cfg.publicHost,
    heartbeatMs: cfg.heartbeatIntervalMs,
    heartbeatTimeoutMs: cfg.heartbeatTimeoutMs,
    maxPayloadBytes: cfg.maxPayloadBytes,
    onConnection: (conn, req) => wireAgent(conn, req, deps, cfg),
    onError: (err) => log.error('server error', { error: String(err) }),
  });

  registry.on('agent:connected', (a) => {
    internal.send({ type: 'AGENT_CONNECTED', from: 'host', payload: { agent: a } });
  });

  registry.on('agent:disconnected', (id, reason) => {
    internal.send({ type: 'AGENT_DISCONNECTED', from: 'host', payload: { agentId: id, reason } });
    authority.revokeByAgent(id);
  });

  registry.on('agent:state-changed', (a, st) => {
    internal.send({ type: 'AGENT_STATE_CHANGED', from: 'host', payload: { agentId: a.agentId, state: st } });
  });

  registry.on('agent:metrics-changed', (a, metrics) => {
    state.updateMetrics(a.agentId, metrics);
  });

  permissions.on('request', (req) => {
    internal.send({ type: 'PERMISSION_REQUESTED', from: 'host', payload: { agentId: req.agentId, request: req } });
  });

  permissions.on('resolved', (dec) => {
    internal.send({ type: 'PERMISSION_RESOLVED', from: 'host', payload: dec });
  });

  broker.on('deliver', (agentId, msg) => {
    const conn = registry.getConnection(agentId);
    if (conn) {
      conn.send({ type: 'INTER_AGENT_DELIVERY', from: 'host', payload: { from: msg.from, messageId: msg.messageId, kind: msg.kind, payload: msg.payload, receivedAt: msg.receivedAt } });
    }
  });

  presence.on('changed', (snapshot) => {
    internal.send({ type: 'PRESENCE_CHANGED', from: 'host', payload: { snapshot } });
  });

  authority.on('granted', (grant) => {
    internal.send({ type: 'AUTHORITY_CHANGED', from: 'host', payload: { change: 'granted', grant } });
  });

  authority.on('revoked', ({ grantId, reason }) => {
    internal.send({ type: 'AUTHORITY_REVOKED', from: 'host', payload: { grantId, reason } });
  });

  internal.on('message', (env) => handleRendererCommand(env, deps));

  pi.on('session_start', async () => {
    try {
      await server.start();
      await internal.connect();
      log.info(`superhive online on ${cfg.publicHost}:${cfg.publicPort}`);
      log.info(`internal client connected to ${cfg.internalUrl}`);

      internal.send({
        type: 'INITIAL_SNAPSHOT',
        from: 'host',
        payload: {
          agents: registry.list(),
          permissions: permissions.listPending(),
          authority: authority.listActive(),
          presence: presence.snapshot(),
        },
      });
    } catch (err) {
      log.error('failed to start superhive', { error: String(err) });
      throw err;
    }
  });

  pi.on('session_end', async () => {
    log.info('superhive shutting down');
    internal.send({ type: 'LOG', from: 'host', payload: { level: 'info', source: 'superhive', message: 'host shutting down' } });
    internal.close();
    await server.stop();
  });
}

function wireAgent(conn: Connection, req: IncomingMessage, deps: HostDeps, cfg: ReturnType<typeof loadConfig> extends Promise<infer T> ? T : never): void {
  const { log, registry, permissions, broker, authority, internal, state } = deps;
  let agentCtx: AgentContext | null = null;

  const sendError = (code: number, reason: string) => {
    conn.close(code, reason);
  };

  conn.on('message', async (env: Envelope) => {
    try {
      switch (env.type) {
        case 'AGENT_HELLO': {
          if (agentCtx) {
            sendError(4400, 'already registered');
            return;
          }

          const payload = env.payload as { manifest: AgentManifest; version: string; capabilities: string[] };
          const valid = validateManifest(payload.manifest);

          if (!valid.ok) {
            log.warn('agent: invalid manifest', { errors: valid.errors });
            sendError(4400, `invalid manifest: ${valid.errors.join(', ')}`);
            return;
          }

          if (cfg.auth.required) {
            const authHeader = req.headers.authorization ?? '';
            const apiKey = authHeader.replace(/^Bearer /i, '') || '';
            const keyEntry = auth.validate(apiKey);
            if (!keyEntry) {
              sendError(4401, 'unauthorized');
              return;
            }
          }

          const agentId = (payload.manifest.modules?.['superhive']?.['agentId'] as string) ??
            `${valid.manifest.name}-${generateId().slice(0, 8)}`;
          const sessionId = generateId();

          const record = registry.connect(conn, {
            agentId,
            manifest: valid.manifest,
            remoteAddr: req.socket.remoteAddress ?? 'unknown',
            sessionId,
            connectionId: conn.id,
          });

          agentCtx = { conn, record };

          log.info('agent: connected', { agentId, manifest: valid.manifest.name, version: valid.manifest.version });

          conn.send({
            type: 'HOST_WELCOME',
            to: agentId,
            payload: {
              agentId,
              sessionId,
              serverVersion: '0.1.0',
              heartbeatIntervalMs: cfg.heartbeatIntervalMs,
            },
          });

          internal.send({ type: 'AGENT_CONNECTED', from: 'host', payload: { agent: record } });

          await logAudit(deps, 'agent_connected', { agentId, manifest: valid.manifest });
          break;
        }

        case 'AGENT_STATE': {
          if (!agentCtx) { sendError(4400, 'not registered'); return; }
          const { state: agentState, metrics } = env.payload as { state: AgentState; metrics?: Metrics };
          registry.updateState(agentCtx.record.agentId, agentState);
          if (metrics) {
            registry.updateMetrics(agentCtx.record.agentId, metrics);
            state.updateMetrics(agentCtx.record.agentId, metrics);
          }
          break;
        }

        case 'PERMISSION_REQUEST': {
          if (!agentCtx) { sendError(4400, 'not registered'); return; }
          const reqPayload = env.payload as {
            requestId: string;
            tool: string;
            args: unknown;
            reason: string;
            severity: 'low' | 'medium' | 'high' | 'critical';
          };

          const decision = await permissions.enqueue({
            requestId: reqPayload.requestId,
            agentId: agentCtx.record.agentId,
            tool: reqPayload.tool,
            args: reqPayload.args,
            reason: reqPayload.reason,
            severity: reqPayload.severity,
            requestedAt: Date.now(),
          });

          conn.send({
            type: 'PERMISSION_DECISION',
            to: agentCtx.record.agentId,
            payload: {
              requestId: reqPayload.requestId,
              decision: decision.decision,
              reason: decision.reason,
              remember: decision.remember,
            },
          });
          break;
        }

        case 'INTER_AGENT_MESSAGE': {
          if (!agentCtx) { sendError(4400, 'not registered'); return; }
          const msgPayload = env.payload as InterAgentMessage;
          const result = await broker.route(agentCtx.record.agentId, msgPayload);
          log.debug('broker: routed message', { from: agentCtx.record.agentId, deliveredTo: result.deliveredTo, dropped: result.dropped });
          break;
        }

        case 'AUTHORITY_GRANT': {
          if (!agentCtx) { sendError(4400, 'not registered'); return; }
          const grantPayload = env.payload as { grantId: string; toAgentId: string; scope: import('./types').AuthorityScope; expiresAt?: number };
          authority.grant({
            grantId: grantPayload.grantId,
            fromAgentId: agentCtx.record.agentId,
            toAgentId: grantPayload.toAgentId,
            scope: grantPayload.scope,
            expiresAt: grantPayload.expiresAt,
          });
          break;
        }

        case 'AUTHORITY_REVOKE': {
          if (!agentCtx) { sendError(4400, 'not registered'); return; }
          const revokePayload = env.payload as { grantId: string };
          authority.revoke(revokePayload.grantId, `requested by ${agentCtx.record.agentId}`);
          break;
        }

        case 'PRESENCE_UPDATE': {
          if (!agentCtx) { sendError(4400, 'not registered'); return; }
          const presPayload = env.payload as { status: import('./types').AgentStatus; activity?: string };
          registry.updateStatus(agentCtx.record.agentId, presPayload.status, presPayload.activity);
          break;
        }

        case 'SETTINGS_APPLIED': {
          if (!agentCtx) { sendError(4400, 'not registered'); return; }
          const appliedPayload = env.payload as { settingsHash: string };
          settings.onSettingsApplied(agentCtx.record.agentId, appliedPayload.settingsHash);
          break;
        }

        case 'SETTINGS_REJECTED': {
          if (!agentCtx) { sendError(4400, 'not registered'); return; }
          const rejectPayload = env.payload as { settingsHash: string; reason: string; errors: import('./types').ValidationError[] };
          settings.onSettingsRejected(agentCtx.record.agentId, rejectPayload.errors);
          break;
        }

        case 'HEARTBEAT': {
          if (!agentCtx) { sendError(4400, 'not registered'); return; }
          const hbPayload = env.payload as { agentId: string; ts: number; pingToken: string };
          conn.send({
            type: 'HEARTBEAT_ACK',
            to: agentCtx.record.agentId,
            payload: { ts: Date.now(), pongToken: hbPayload.pingToken },
          });
          break;
        }

        case 'DISCONNECT': {
          if (!agentCtx) { sendError(4400, 'not registered'); return; }
          const disPayload = env.payload as { reason?: string };
          registry.disconnect(conn.id, disPayload.reason ?? 'agent disconnected');
          conn.close(1000, 'goodbye');
          agentCtx = null;
          break;
        }

        default:
          log.debug('agent: unknown message type', { type: env.type });
          break;
      }
    } catch (err) {
      log.error('agent: message handler error', { type: env.type, error: String(err) });
      sendError(4500, `internal error: ${String(err)}`);
    }
  });

  conn.on('close', (code, reason) => {
    if (agentCtx) {
      registry.disconnect(conn.id, `WebSocket close ${code}: ${reason}`);
      agentCtx = null;
    }
    log.info('agent: connection closed', { code, reason });
  });

  conn.on('error', (err) => {
    log.error('agent: connection error', { error: String(err) });
  });
}

function emitToAgent(agentId: string, env: Envelope, deps: HostDeps): void {
  const conn = deps.registry.getConnection(agentId);
  if (conn) {
    conn.send(env);
  }
}

async function handleRendererCommand(env: Envelope, deps: HostDeps): Promise<void> {
  const { log, registry, settings, permissions, broker, authority, internal } = deps;

  switch (env.type) {
    case 'LIST_AGENTS': {
      internal.send({ type: 'INITIAL_SNAPSHOT', from: 'host', payload: {
        agents: registry.list(),
        permissions: permissions.listPending(),
        authority: authority.listActive(),
        presence: deps.presence.snapshot(),
      }});
      break;
    }

    case 'APPROVE_PERMISSION': {
      const { requestId, remember } = env.payload as { requestId: string; remember?: boolean };
      permissions.decide(requestId, { decision: 'allow', remember });
      const pending = permissions.get(requestId);
      if (pending) {
        emitToAgent(pending.agentId, {
          type: 'PERMISSION_DECISION',
          from: 'host',
          payload: { requestId, decision: 'allow', remember },
        }, deps);
      }
      break;
    }

    case 'DENY_PERMISSION': {
      const { requestId, reason } = env.payload as { requestId: string; reason?: string };
      permissions.decide(requestId, { decision: 'deny', reason });
      const pending = permissions.get(requestId);
      if (pending) {
        emitToAgent(pending.agentId, {
          type: 'PERMISSION_DECISION',
          from: 'host',
          payload: { requestId, decision: 'deny', reason },
        }, deps);
      }
      break;
    }

    case 'PUSH_SETTINGS': {
      const { agentId, patch, expectedHash } = env.payload as { agentId: string; patch: SettingsPatch[]; expectedHash?: string };
      const conn = registry.getConnection(agentId);
      if (!conn) {
        internal.send({ type: 'SETTINGS_PUSH_RESULT', from: 'host', payload: { agentId, ok: false, errors: [{ path: '', message: 'agent not connected' }] } });
        return;
      }
      conn.send({ type: 'SETTINGS_UPDATE', from: 'host', payload: { patch, expectedHash: expectedHash ?? '', schema: registry.get(agentId)?.manifest.settingsSchema ?? {}, urgent: false } });
      break;
    }

    case 'SEND_MESSAGE': {
      const { from, to, group, broadcast, kind, payload } = env.payload as {
        from: string;
        to?: string;
        group?: string;
        broadcast?: boolean;
        kind: InterAgentMessage['kind'];
        payload: unknown;
      };
      const msg: InterAgentMessage = {
        messageId: generateId(),
        from,
        to,
        group,
        broadcast,
        kind,
        payload,
        receivedAt: Date.now(),
      };
      await broker.route(from, msg);
      break;
    }

    case 'REVOKE_AUTHORITY': {
      const { grantId } = env.payload as { grantId: string };
      authority.revoke(grantId, 'renderer revoke');
      break;
    }

    case 'KICK_AGENT': {
      const { agentId, reason } = env.payload as { agentId: string; reason?: string };
      const conn = registry.getConnection(agentId);
      if (conn) {
        conn.close(4403, reason ?? 'kicked by host');
        registry.disconnect(conn.id, `kicked: ${reason}`);
      }
      break;
    }

    case 'SEND_COMMAND': {
      const { agentId, command, args } = env.payload as { agentId: string; command: string; args?: Record<string, unknown> };
      const conn = registry.getConnection(agentId);
      if (conn) {
        conn.send({ type: 'COMMAND', from: 'host', payload: { command: command as import('./types').HostCommand, args } });
      }
      break;
    }

    default:
      log.debug('renderer: unknown command', { type: env.type });
      break;
  }
}

async function logAudit(deps: HostDeps, event: string, data: Record<string, unknown>): Promise<void> {
  const { store } = deps;
  try {
    const { todayDate } = await import('./persistence/paths');
    const entry: AuditEvent = { event, data, ts: Date.now() };
    await store.append(`audit/${todayDate()}.jsonl`, entry);
  } catch {
    // best-effort
  }
}
