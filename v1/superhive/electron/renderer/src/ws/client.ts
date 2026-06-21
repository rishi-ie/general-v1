import { useStore, AgentRecord, PendingRequest, AuthorityGrant, PresenceEntry, InterAgentMessage } from '../store';

interface Envelope<T = unknown> {
  v: number;
  type: string;
  id: string;
  ts: number;
  from?: string;
  to?: string;
  payload: T;
}

const INTERNAL_URL = 'ws://127.0.0.1:7712';

class RendererWsClient {
  private ws: WebSocket | null = null;
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribers: Array<() => void> = [];

  connect(): void {
    if (this.ws) {
      this.ws.close();
    }

    this.ws = new WebSocket(INTERNAL_URL);

    this.ws.onopen = () => {
      console.log('[renderer-ws] connected');
      this.retry = 0;
      useStore.getState().setConnected(true);
      this.requestAgents();
    };

    this.ws.onmessage = (event) => {
      try {
        const env: Envelope = JSON.parse(event.data);
        this.handle(env);
      } catch (err) {
        console.error('[renderer-ws] failed to parse message', err);
      }
    };

    this.ws.onclose = () => {
      console.log('[renderer-ws] disconnected');
      useStore.getState().setConnected(false);
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('[renderer-ws] error', err);
    };
  }

  private scheduleReconnect(): void {
    if (this.retryTimer) return;
    const delay = Math.min(30_000, 500 * 2 ** this.retry++);
    console.log(`[renderer-ws] reconnecting in ${delay}ms`);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, delay);
  }

  private handle(env: Envelope): void {
    const store = useStore.getState();

    switch (env.type) {
      case 'AGENT_CONNECTED': {
        const { agent } = env.payload as { agent: AgentRecord };
        store.addAgent(agent);
        break;
      }
      case 'AGENT_DISCONNECTED': {
        const { agentId } = env.payload as { agentId: string };
        store.removeAgent(agentId);
        break;
      }
      case 'AGENT_STATE_CHANGED': {
        const { agentId, state } = env.payload as { agentId: string; state: Partial<AgentRecord> };
        store.updateAgent(agentId, state);
        break;
      }
      case 'PERMISSION_REQUESTED': {
        const { request } = env.payload as { agentId: string; request: PendingRequest };
        store.addPendingPermission(request);
        break;
      }
      case 'PERMISSION_RESOLVED': {
        const { requestId } = env.payload as { requestId: string };
        store.removePendingPermission(requestId);
        break;
      }
      case 'INTER_AGENT_DELIVERY': {
        const msg = env.payload as InterAgentMessage;
        store.addMessage(msg);
        break;
      }
      case 'AUTHORITY_CHANGED': {
        const { change, grant } = env.payload as { change: 'granted' | 'revoked'; grant: AuthorityGrant };
        if (change === 'granted') {
          store.addAuthority(grant);
        } else {
          store.removeAuthority(grant.grantId);
        }
        break;
      }
      case 'PRESENCE_CHANGED': {
        const { snapshot } = env.payload as { snapshot: PresenceEntry[] };
        store.setPresence(snapshot);
        break;
      }
      case 'INITIAL_SNAPSHOT': {
        const { agents, permissions, authority, presence } = env.payload as {
          agents: AgentRecord[];
          permissions: PendingRequest[];
          authority: AuthorityGrant[];
          presence: PresenceEntry[];
        };
        store.setAgents(agents);
        store.setPendingPermissions(permissions);
        store.setAuthority(authority);
        store.setPresence(presence);
        break;
      }
      default:
        break;
    }
  }

  private send(env: Omit<Envelope, 'v' | 'ts' | 'id'>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ v: 1, id: crypto.randomUUID(), ts: Date.now(), ...env }));
    }
  }

  private requestAgents(): void {
    this.send({ type: 'LIST_AGENTS' });
  }

  approvePermission(requestId: string, remember?: boolean): void {
    this.send({ type: 'APPROVE_PERMISSION', payload: { requestId, remember } });
  }

  denyPermission(requestId: string, reason?: string): void {
    this.send({ type: 'DENY_PERMISSION', payload: { requestId, reason } });
  }

  pushSettings(agentId: string, patch: unknown[], expectedHash?: string): void {
    this.send({ type: 'PUSH_SETTINGS', payload: { agentId, patch, expectedHash } });
  }

  sendMessage(from: string, content: string, to?: string, broadcast?: boolean): void {
    this.send({
      type: 'SEND_MESSAGE',
      payload: { from, to, broadcast, kind: 'text', payload: content },
    });
  }

  revokeAuthority(grantId: string): void {
    this.send({ type: 'REVOKE_AUTHORITY', payload: { grantId } });
  }

  kickAgent(agentId: string, reason?: string): void {
    this.send({ type: 'KICK_AGENT', payload: { agentId, reason } });
  }

  disconnect(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}

export const wsClient = new RendererWsClient();
