import { create } from "zustand";

export interface AgentRecord {
  agentId: string;
  manifest: {
    name: string;
    version: string;
    description?: string;
    capabilities: string[];
    settingsSchema: Record<string, unknown>;
    modules?: Record<string, { version: string; settingsSchema: Record<string, unknown> }>;
  };
  remoteAddr: string;
  connectedAt: number;
  lastSeen: number;
  status: "connecting" | "online" | "away" | "busy" | "offline";
  settingsHash: string;
  assignedGroup?: string;
  sessionId: string;
  connectionId: string;
}

export interface PendingRequest {
  requestId: string;
  agentId: string;
  tool: string;
  args: unknown;
  reason: string;
  severity: "low" | "medium" | "high" | "critical";
  requestedAt: number;
}

export interface AuthorityGrant {
  grantId: string;
  fromAgentId: string;
  toAgentId: string;
  scope: { tools?: string[]; paths?: string[]; actions?: string[] };
  createdAt: number;
  expiresAt?: number;
  revokedAt?: number;
}

export interface PresenceEntry {
  agentId: string;
  status: "connecting" | "online" | "away" | "busy" | "offline";
  activity?: string;
  lastSeen: number;
}

export interface InterAgentMessage {
  messageId: string;
  from: string;
  to?: string;
  group?: string;
  broadcast?: boolean;
  kind: "text" | "request" | "response" | "event";
  payload: unknown;
  receivedAt: number;
}

interface Store {
  agents: AgentRecord[];
  pendingPermissions: PendingRequest[];
  authority: AuthorityGrant[];
  presence: PresenceEntry[];
  messages: InterAgentMessage[];
  connected: boolean;

  setAgents: (agents: AgentRecord[]) => void;
  addAgent: (agent: AgentRecord) => void;
  removeAgent: (agentId: string) => void;
  updateAgent: (agentId: string, patch: Partial<AgentRecord>) => void;
  setPendingPermissions: (permissions: PendingRequest[]) => void;
  addPendingPermission: (permission: PendingRequest) => void;
  removePendingPermission: (requestId: string) => void;
  setAuthority: (grants: AuthorityGrant[]) => void;
  addAuthority: (grant: AuthorityGrant) => void;
  removeAuthority: (grantId: string) => void;
  setPresence: (presence: PresenceEntry[]) => void;
  addMessage: (msg: InterAgentMessage) => void;
  setConnected: (connected: boolean) => void;
}

export const useStore = create<Store>((set) => ({
  agents: [],
  pendingPermissions: [],
  authority: [],
  presence: [],
  messages: [],
  connected: false,

  setAgents: (agents) => set({ agents }),

  addAgent: (agent) =>
    set((s) => ({
      agents: s.agents.some((a) => a.agentId === agent.agentId)
        ? s.agents.map((a) => (a.agentId === agent.agentId ? agent : a))
        : [...s.agents, agent],
    })),

  removeAgent: (agentId) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.agentId === agentId ? { ...a, status: "offline" as const } : a)),
    })),

  updateAgent: (agentId, patch) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.agentId === agentId ? { ...a, ...patch } : a)),
    })),

  setPendingPermissions: (permissions) => set({ pendingPermissions: permissions }),

  addPendingPermission: (permission) =>
    set((s) => ({
      pendingPermissions: [...s.pendingPermissions, permission],
    })),

  removePendingPermission: (requestId) =>
    set((s) => ({
      pendingPermissions: s.pendingPermissions.filter((p) => p.requestId !== requestId),
    })),

  setAuthority: (authority) => set({ authority }),

  addAuthority: (grant) =>
    set((s) => ({
      authority: s.authority.some((a) => a.grantId === grant.grantId)
        ? s.authority.map((a) => (a.grantId === grant.grantId ? grant : a))
        : [...s.authority, grant],
    })),

  removeAuthority: (grantId) =>
    set((s) => ({
      authority: s.authority.filter((a) => a.grantId !== grantId),
    })),

  setPresence: (presence) => set({ presence }),

  addMessage: (msg) =>
    set((s) => ({
      messages: [...s.messages.slice(-199), msg],
    })),

  setConnected: (connected) => set({ connected }),
}));
