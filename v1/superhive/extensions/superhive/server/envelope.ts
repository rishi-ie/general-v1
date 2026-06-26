import { type Envelope, PROTOCOL_VERSION } from "../types";

export function generateId(): string {
  const t = Date.now();
  const r = Math.random().toString(36).slice(2, 10);
  const p = Math.random().toString(36).slice(2, 6);
  return `${t.toString(36)}-${r}-${p}`;
}

export function decodeFrame<T = unknown>(raw: string): Envelope<T> {
  const env = JSON.parse(raw) as Envelope<T>;
  return env;
}

export function encodeFrame<T>(env: Omit<Envelope<T>, "v" | "ts" | "id"> & Partial<Pick<Envelope<T>, "id">>): string {
  const full: Envelope<T> = {
    v: PROTOCOL_VERSION,
    ts: Date.now(),
    id: generateId(),
    ...env,
  } as Envelope<T>;
  return JSON.stringify(full);
}

export function validateEnvelope(env: unknown): { ok: true; env: Envelope } | { ok: false; error: string } {
  if (!env || typeof env !== "object") {
    return { ok: false, error: "not an object" };
  }

  const e = env as Record<string, unknown>;

  if (typeof e.v !== "number" || e.v !== PROTOCOL_VERSION) {
    return { ok: false, error: `unsupported protocol version: ${e.v}` };
  }

  if (typeof e.type !== "string" || !e.type) {
    return { ok: false, error: "missing or invalid type" };
  }

  if (typeof e.id !== "string" || !e.id) {
    return { ok: false, error: "missing or invalid id" };
  }

  if (typeof e.ts !== "number" || e.ts <= 0) {
    return { ok: false, error: "missing or invalid ts" };
  }

  return { ok: true, env: env as Envelope };
}

export function isResponse(env: Envelope): boolean {
  return Boolean(env.corr);
}

export function makeResponse<T, R>(
  env: Envelope<T>,
  payload: R,
): Omit<Envelope<R>, "v" | "ts" | "id"> & { id: string; corr: string } {
  return {
    type: `${env.type}_RESPONSE`,
    id: generateId(),
    corr: env.id,
    from: "host",
    payload,
  };
}
