export const PROTOCOL_VERSION = 1;

export interface Envelope<T = unknown> {
  v: 1;
  type: string;
  id: string;
  ts: number;
  corr?: string;
  from?: string;
  to?: string;
  payload: T;
}

export interface AgentManifest {
  name: string;
  version: string;
  description?: string;
  capabilities: string[];
  settingsSchema: Record<string, unknown>;
  permissions?: string[];
  interAgent?: {
    acceptsDMs: boolean;
    acceptsBroadcasts: boolean;
    groups: string[];
  };
  modules?: Record<string, ModuleInfo>;
}

export interface ModuleInfo {
  version: string;
  settingsSchema: Record<string, unknown>;
}

export interface AgentRecord {
  agentId: string;
  manifest: AgentManifest;
  remoteAddr: string;
  connectedAt: number;
  lastSeen: number;
  status: AgentStatus;
  settingsHash: string;
  assignedGroup?: string;
  sessionId: string;
  connectionId: string;
}

export type AgentStatus = "connecting" | "online" | "away" | "busy" | "offline";

export interface PresenceEntry {
  agentId: string;
  status: AgentStatus;
  activity?: string;
  lastSeen: number;
}

export interface InterAgentMessage {
  messageId: string;
  to?: string;
  group?: string;
  broadcast?: boolean;
  kind: "text" | "request" | "response" | "event";
  payload: unknown;
  from: string;
  receivedAt: number;
}

export interface AuthorityGrant {
  grantId: string;
  fromAgentId: string;
  toAgentId: string;
  scope: AuthorityScope;
  createdAt: number;
  expiresAt?: number;
  revokedAt?: number;
}

export interface AuthorityScope {
  tools?: string[];
  paths?: string[];
  actions?: string[];
}

export interface PendingRequest {
  requestId: string;
  agentId: string;
  tool: string;
  args: unknown;
  reason: string;
  severity: "low" | "medium" | "high" | "critical";
  requestedAt: number;
  resolve?: (d: PermissionDecision) => void;
}

export interface PermissionDecision {
  decision: "allow" | "deny";
  reason?: string;
  remember?: boolean;
}

export interface ValidationError {
  path: string;
  message: string;
}

export interface Metrics {
  tokensUsed?: number;
  toolCalls?: number;
  turns?: number;
  errors?: number;
}

export interface AgentState {
  currentTask?: string;
  phase?: string;
  subAgents?: SubAgentStatus[];
}

export interface SubAgentStatus {
  id: string;
  type: string;
  status: "running" | "paused" | "done" | "failed";
}

export interface AuditEvent {
  event: string;
  agentId?: string;
  data: Record<string, unknown>;
  ts: number;
  user?: string;
}

export interface SettingsPatch {
  op: "add" | "remove" | "replace" | "test";
  path: string;
  value?: unknown;
}

export type HostCommand = "reload" | "restart" | "pause" | "resume";

export interface RendererMessageMap {
  LIST_AGENTS: Record<string, never>;
  APPROVE_PERMISSION: { requestId: string; remember?: boolean };
  DENY_PERMISSION: { requestId: string; reason?: string };
  PUSH_SETTINGS: { agentId: string; patch: SettingsPatch[]; expectedHash?: string };
  SEND_MESSAGE: {
    from: string;
    to?: string;
    group?: string;
    broadcast?: boolean;
    kind: InterAgentMessage["kind"];
    payload: unknown;
  };
  REVOKE_AUTHORITY: { grantId: string };
  KICK_AGENT: { agentId: string; reason?: string };
  SEND_COMMAND: { agentId: string; command: HostCommand; args?: Record<string, unknown> };
  SUBSCRIBE: { topics: string[] };
}

export interface HostMessageMap {
  AGENT_CONNECTED: { agent: AgentRecord };
  AGENT_DISCONNECTED: { agentId: string; reason: string };
  AGENT_STATE_CHANGED: { agentId: string; state: AgentState; metrics?: Metrics };
  PERMISSION_REQUESTED: { agentId: string; request: Omit<PendingRequest, "resolve"> };
  PERMISSION_RESOLVED: { agentId: string; requestId: string; decision: PermissionDecision };
  INTER_AGENT_MESSAGE: { message: InterAgentMessage };
  AUTHORITY_CHANGED: { change: "granted" | "revoked"; grant: AuthorityGrant };
  PRESENCE_CHANGED: { snapshot: PresenceEntry[] };
  SETTINGS_PUSH_RESULT: { agentId: string; ok: boolean; errors?: ValidationError[] };
  AUDIT_EVENT: { event: AuditEvent };
  LOG: { level: "debug" | "info" | "warn" | "error"; source: string; message: string; meta?: Record<string, unknown> };
  INITIAL_SNAPSHOT: {
    agents: AgentRecord[];
    permissions: PendingRequest[];
    authority: AuthorityGrant[];
    presence: PresenceEntry[];
  };
}

export type RendererOutbound = {
  [K in keyof RendererMessageMap]: Envelope<RendererMessageMap[K]> & { type: K };
}[keyof RendererMessageMap];

export type HostOutbound = {
  [K in keyof HostMessageMap]: Envelope<HostMessageMap[K]> & { type: K };
}[keyof HostMessageMap];
