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

export interface AgentState {
  currentTask?: string;
  phase?: string;
  subAgents?: SubAgentStatus[];
}

export interface SubAgentStatus {
  id: string;
  type: string;
  status: 'running' | 'paused' | 'done' | 'failed';
}

export interface Metrics {
  tokensUsed?: number;
  toolCalls?: number;
  turns?: number;
  errors?: number;
}

export interface InterAgentMessage {
  messageId: string;
  to?: string;
  group?: string;
  broadcast?: boolean;
  kind: 'text' | 'request' | 'response' | 'event';
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
  tool: string;
  args: unknown;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface PermissionDecision {
  decision: 'allow' | 'deny';
  reason?: string;
  remember?: boolean;
}

export interface ValidationError {
  path: string;
  message: string;
}

export interface SettingsPatch {
  op: 'add' | 'remove' | 'replace' | 'test';
  path: string;
  value?: unknown;
}

export type HostCommand = 'reload' | 'restart' | 'pause' | 'resume';
