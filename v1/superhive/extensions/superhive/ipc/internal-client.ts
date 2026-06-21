import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { Envelope, PROTOCOL_VERSION } from '../types';
import { generateId } from '../server/envelope';
import { Logger } from '../logger';

export class InternalClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private retry = 0;
  private retryTimer: NodeJS.Timeout | null = null;
  private pending: Map<string, (env: Envelope) => void> = new Map();
  private intentionalClose = false;

  constructor(private url: string, private log: Logger) {
    super();
  }

  async connect(): Promise<void> {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
    }

    return new Promise((resolve, reject) => {
      this.intentionalClose = false;

      try {
        this.ws = new WebSocket(this.url);
      } catch (err) {
        reject(err);
        return;
      }

      this.ws.on('open', () => {
        this.retry = 0;
        this.log.info('internal: connected to renderer');
        this.emit('open');
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const env = JSON.parse(data.toString()) as Envelope;
          if (env.v !== PROTOCOL_VERSION) {
            this.log.warn('internal: unsupported protocol version', { v: env.v });
            return;
          }
          this.emit('message', env);

          if (env.corr) {
            const resolver = this.pending.get(env.corr);
            if (resolver) {
              this.pending.delete(env.corr);
              resolver(env);
            }
          }
        } catch (err) {
          this.log.error('internal: failed to parse message', { error: String(err) });
        }
      });

      this.ws.on('close', (code, reason) => {
        this.log.warn('internal: disconnected', { code, reason: reason.toString() });
        this.emit('close', code, reason.toString());
        if (!this.intentionalClose) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (err) => {
        this.log.error('internal: socket error', { error: String(err) });
        this.emit('error', err);
      });
    });
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose) return;
    const delay = Math.min(30_000, 500 * 2 ** this.retry++);
    this.log.info(`internal: reconnecting in ${delay}ms (attempt ${this.retry})`);
    this.retryTimer = setTimeout(() => {
      this.connect().catch((err) => {
        this.log.error('internal: reconnect failed', { error: String(err) });
      });
    }, delay);
  }

  send<T>(env: Omit<Envelope<T>, 'v' | 'id' | 'ts'> & Partial<Pick<Envelope<T>, 'id'>>): void {
    const full: Envelope<T> = {
      v: PROTOCOL_VERSION,
      ts: Date.now(),
      id: generateId(),
      ...env,
    } as Envelope<T>;

    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(full));
      } catch (err) {
        this.log.error('internal: send failed', { error: String(err) });
      }
    } else {
      this.log.warn('internal: not connected, dropping message', { type: env.type });
    }
  }

  async request<TReq, TRes>(
    type: string,
    payload: TReq,
    timeoutMs = 5000
  ): Promise<Envelope<TRes>> {
    return new Promise((resolve, reject) => {
      const id = generateId();
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`internal: request ${type} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      const resolver = (env: Envelope) => {
        clearTimeout(timer);
        resolve(env as Envelope<TRes>);
      };

      this.pending.set(id, resolver as (env: Envelope) => void);
      this.send({ type, id, payload: payload as TReq extends never ? never : TReq });

      setTimeout(() => {
        if (this.pending.has(id)) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(new Error(`internal: request ${id} timed out`));
        }
      }, timeoutMs);
    });
  }

  close(): void {
    this.intentionalClose = true;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close(1000, 'host shutting down');
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
