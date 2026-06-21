import WebSocket from 'ws';
import { EventEmitter } from 'events';
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

  constructor(private config: WsConfig, private log: (msg: string, data?: Record<string, unknown>) => void) {
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
          this.log(`failed to parse message: ${String(err)}`);
        }
      });

      this.ws.on('close', (code, reason) => {
        this.connected = false;
        this.stopHeartbeat();
        this.log(`disconnected: ${code} ${reason.toString()}`);
        this.emit('disconnected', code, reason.toString());

        if (!this.intentionalClose) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (err) => {
        this.log(`socket error: ${String(err)}`);
        this.emit('error', err);
      });

      this.ws.on('pong', () => {
        this.emit('pong');
      });
    });
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) return;
    const { maxAttempts, backoffMs } = this.config.reconnect;

    if (maxAttempts > 0 && this.retry >= maxAttempts) {
      this.log(`max reconnect attempts (${maxAttempts}) reached`);
      this.emit('reconnect_failed');
      return;
    }

    const delay = backoffMs[Math.min(this.retry, backoffMs.length - 1)];
    this.retry++;
    this.log(`reconnecting in ${delay}ms (attempt ${this.retry})`);

    this.retryTimer = setTimeout(() => {
      this.connect().catch((err) => {
        this.log(`reconnect failed: ${String(err)}`);
      });
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
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  send<T>(type: string, payload: T, options?: { to?: string; corr?: string }): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.log(`not connected, dropping message: ${type}`);
      return;
    }

    const env: Envelope<T> = {
      v: PROTOCOL_VERSION,
      ts: Date.now(),
      id: generateId(),
      type,
      from: options?.to,
      corr: options?.corr,
      payload,
    };

    try {
      this.ws.send(JSON.stringify(env));
    } catch (err) {
      this.log(`send failed: ${String(err)}`);
    }
  }

  request<TReq, TRes>(type: string, payload: TReq, timeoutMs = 5000): Promise<Envelope<TRes>> {
    return new Promise((resolve, reject) => {
      const id = generateId();
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`request ${type} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const resolver = (env: Envelope) => {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        resolve(env as Envelope<TRes>);
      };

      this.pendingRequests.set(id, resolver as (env: Envelope) => void);

      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(new Error('not connected'));
        return;
      }

      const env: Envelope<TReq> = {
        v: PROTOCOL_VERSION,
        ts: Date.now(),
        id,
        type,
        payload,
      };

      try {
        this.ws.send(JSON.stringify(env));
      } catch (err) {
        clearTimeout(timer);
        this.pendingRequests.delete(id);
        reject(err);
      }
    });
  }

  close(code = 1000, reason = 'agent shutting down'): void {
    this.intentionalClose = true;
    this.stopHeartbeat();
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close(code, reason);
      } catch {
        // ignore
      }
      this.ws = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  getRetryAttempt(): number {
    return this.retry;
  }
}
