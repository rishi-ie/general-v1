import { type IncomingMessage, type ServerResponse, createServer } from "http";
import type { WebSocketServer as WSS, WebSocket } from "ws";
import { Logger } from "../logger";
import { Connection, ConnectionOptions } from "./connection";

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
  private httpServer: ReturnType<typeof createServer> | null = null;
  private connections = new Map<string, Connection>();

  constructor(private opts: ServerOptions) {}

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
        if (req.method === "GET" && req.url === "/health") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "ok", ts: Date.now() }));
          return;
        }
        if (req.headers.upgrade === "websocket") {
          this.httpServer!.handleUpgrade(req, req.socket, Buffer.alloc(0), (ws: WebSocket) => {
            this.handleWsConnection(ws, req);
          });
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      this.httpServer.on("listening", () => {
        resolve();
      });

      this.httpServer.on("error", (err) => {
        if (!this.httpServer) {
          reject(err);
        } else {
          this.opts.onError?.(err);
        }
      });

      this.httpServer.listen(this.opts.port, this.opts.host);
    });
  }

  private handleWsConnection(ws: WebSocket, req: IncomingMessage): void {
    const id = `${req.socket.remoteAddress ?? "unknown"}-${Date.now()}`;
    const conn = new Connection(ws, id, req.socket.remoteAddress ?? "unknown", {
      heartbeatMs: this.opts.heartbeatMs,
      heartbeatTimeoutMs: this.opts.heartbeatTimeoutMs,
    });

    this.connections.set(id, conn);

    conn.on("close", (code, reason) => {
      this.connections.delete(id);
    });

    conn.on("error", () => {
      this.connections.delete(id);
    });

    this.opts.onConnection(conn, req);
  }

  async stop(): Promise<void> {
    const closeAll = [...this.connections.values()].map(
      (c) =>
        new Promise<void>((res) => {
          c.close(1001, "host shutting down");
          c.on("close", () => res());
          setTimeout(() => res(), 1000);
        }),
    );

    await Promise.all(closeAll);
    this.connections.clear();

    return new Promise((resolve) => {
      this.httpServer?.close(() => resolve());
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
