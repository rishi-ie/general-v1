import Ajv, { type ValidateFunction } from "ajv";
import type { AgentManifest } from "../types";

const ajv = new Ajv({ allErrors: true, strict: false });

const schemaCache = new WeakMap<object, ValidateFunction>();

const manifestSchema = {
  type: "object",
  required: ["name", "version", "settingsSchema", "capabilities"],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 64 },
    version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+" },
    description: { type: "string", maxLength: 500 },
    capabilities: {
      type: "array",
      items: { type: "string", minLength: 1, maxLength: 64 },
      minItems: 0,
      maxItems: 100,
    },
    settingsSchema: {
      type: "object",
      additionalProperties: true,
    },
    permissions: {
      type: "array",
      items: { type: "string" },
    },
    interAgent: {
      type: "object",
      properties: {
        acceptsDMs: { type: "boolean" },
        acceptsBroadcasts: { type: "boolean" },
        groups: {
          type: "array",
          items: { type: "string", minLength: 1, maxLength: 64 },
        },
      },
      additionalProperties: false,
    },
    modules: {
      type: "object",
      additionalProperties: {
        type: "object",
        required: ["version", "settingsSchema"],
        properties: {
          version: { type: "string", pattern: "^\\d+\\.\\d+\\.\\d+" },
          settingsSchema: { type: "object", additionalProperties: true },
        },
        additionalProperties: false,
      },
    },
  },
  additionalProperties: true,
};

function getValidator(schema: object): ValidateFunction {
  let v = schemaCache.get(schema);
  if (!v) {
    v = ajv.compile(schema);
    schemaCache.set(schema, v);
  }
  return v;
}

export function validateManifest(m: unknown): { ok: true; manifest: AgentManifest } | { ok: false; errors: string[] } {
  const v = getValidator(manifestSchema);
  if (v(m)) {
    return { ok: true, manifest: m as AgentManifest };
  }
  return {
    ok: false,
    errors: (v.errors ?? []).map((e) => `${e.instancePath} ${e.message}`),
  };
}

export function validateSettingsAgainstSchema(
  settings: unknown,
  schema: Record<string, unknown>,
): { ok: true } | { ok: false; errors: string[] } {
  const v = getValidator(schema);
  if (v(settings)) {
    return { ok: true };
  }
  return {
    ok: false,
    errors: (v.errors ?? []).map((e) => `${e.instancePath} ${e.message}`),
  };
}
