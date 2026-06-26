import { EventEmitter } from "events";
import { WebSocket } from "ws";
import type { Envelope } from "../types";
import { decodeFrame, encodeFrame, generateId, validateEnvelope } from "./envelope";

export interface ConnectionOptions {
  heartbeatMs: number;
  heartbeatTimeoutMs: number;
}

export class Connection extends EventEmitter {
  private alive = true;
  private lastPong = Date.now();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private timeoutTimer: NodeJS.Timeout | null = null;

  constructor(
    public readonly ws: WebSocket,
    public readonly id: string,
    public readonly remoteAddr: string,
    private opts: ConnectionOptions,
  ) {
    super();
    this.wire();
  }

  private wire(): void {
    this.ws.on("message", (data) => {
      let env: Envelope;
      try {
        env = decodeFrame(data.toString());
      } catch {
        this.close(4400, "bad frame: not valid JSON");
        return;
      }

      const valid = validateEnvelope(env);
      if (!valid.ok) {
        this.close(4400, `bad frame: ${valid.error}`);
        return;
      }

      if (valid.env.v !== 1) {
        this.close(4400, `unsupported protocol version: ${valid.env.v}`);
        return;
      }

      this.resetTimeout();
      this.emit("message", valid.env);
    });

    this.ws.on("pong", () => {
      this.lastPong = Date.now();
      this.alive = true;
      this.resetTimeout();
    });

    this.ws.on("close", (code, reason) => {
      this.emit("close", code, reason.toString());
    });

    this.ws.on("error", (err) => {
      this.emit("error", err);
    });

    this.startHeartbeat();
    this.startTimeout();
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (!this.alive) {
        this.close(4408, "heartbeat timeout");
        return;
      }
      this.alive = false;
      try {
        this.ws.ping();
      } catch {
        this.close(4408, "heartbeat ping failed");
      }
    }, this.opts.heartbeatMs);
  }

  private startTimeout(): void {
    this.resetTimeout();
  }

  private resetTimeout(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
    }
    this.timeoutTimer = setTimeout(() => {
      this.close(4408, "connection timeout");
    }, this.opts.heartbeatTimeoutMs);
  }

  send<T>(env: Omit<Envelope<T>, "v" | "ts" | "id"> & Partial<Pick<Envelope<T>, "id">>): void {
    const full: Envelope<T> = {
      v: 1,
      ts: Date.now(),
      id: generateId(),
      ...env,
    } as Envelope<T>;

    if (this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(encodeFrame(full));
      } catch (err) {
        this.emit("error", err);
      }
    }
  }

  close(code: number, reason: string): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.timeoutTimer) clearTimeout(this.timeoutTimer);
    try {
      this.ws.close(code, reason);
    } catch {
      // already closed
    }
  }

  getLastPong(): number {
    return this.lastPong;
  }
}
