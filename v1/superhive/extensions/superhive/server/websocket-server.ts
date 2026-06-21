import { WebSocketServer as WSS, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Connection, ConnectionOptions } from './connection';
import { Logger } from '../logger';

export interface ServerOptions {
  port: number;
  host: string;
  heartbeatMs: number;
  heartbeatTimeoutMs: number;
  maxPayloadBytes: number;
  onConnection: (conn: Connection, req: IncomingMessage) => void;
  onError?: (err: Error) => void;
}

export class WebSocketServer {
  private wss: WSS | null = null;
  private connections = new Map<string, Connection>();

  constructor(private opts: ServerOptions) {}

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wss = new WSS({
        host: this.opts.host,
        port: this.opts.port,
        maxPayload: this.opts.maxPayloadBytes,
        perMessageDeflate: true,
      });

      this.wss.on('listening', () => {
        resolve();
      });

      this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
        const id = `${req.socket.remoteAddress ?? 'unknown'}-${Date.now()}`;
        const conn = new Connection(ws, id, req.socket.remoteAddress ?? 'unknown', {
          heartbeatMs: this.opts.heartbeatMs,
          heartbeatTimeoutMs: this.opts.heartbeatTimeoutMs,
        });

        this.connections.set(id, conn);

        conn.on('close', (code, reason) => {
          this.connections.delete(id);
        });

        conn.on('error', (err) => {
          this.connections.delete(id);
        });

        this.opts.onConnection(conn, req);
      });

      this.wss.on('error', (err) => {
        if (!this.wss) {
          reject(err);
        } else {
          this.opts.onError?.(err);
        }
      });
    });
  }

  async stop(): Promise<void> {
    const closeAll = [...this.connections.values()].map((c) =>
      new Promise<void>((res) => {
        c.close(1001, 'host shutting down');
        c.on('close', () => res());
        setTimeout(() => res(), 1000);
      })
    );

    await Promise.all(closeAll);
    this.connections.clear();

    return new Promise((resolve) => {
      this.wss?.close(() => resolve());
    });
  }

  getConnection(id: string): Connection | undefined {
    return this.connections.get(id);
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  broadcast<T>(fn: (conn: Connection) => Omit<T, never> | void): void {
    for (const conn of this.connections.values()) {
      const msg = fn(conn);
      if (msg) {
        conn.send(msg as Parameters<typeof conn.send>[0]);
      }
    }
  }
}
