import { contextBridge, ipcRenderer } from "electron";

const validTypes = new Set([
  "AGENT_CONNECTED",
  "AGENT_DISCONNECTED",
  "AGENT_STATE_CHANGED",
  "PERMISSION_REQUESTED",
  "PERMISSION_RESOLVED",
  "INTER_AGENT_MESSAGE",
  "AUTHORITY_CHANGED",
  "PRESENCE_CHANGED",
  "SETTINGS_PUSH_RESULT",
  "AUDIT_EVENT",
  "LOG",
  "INITIAL_SNAPSHOT",
  "LIST_AGENTS",
  "APPROVE_PERMISSION",
  "DENY_PERMISSION",
  "PUSH_SETTINGS",
  "SEND_MESSAGE",
  "REVOKE_AUTHORITY",
  "KICK_AGENT",
  "SEND_COMMAND",
  "SUBSCRIBE",
]);

contextBridge.exposeInMainWorld("superhive", {
  send: (msg: { type: string; payload?: unknown }) => {
    if (validTypes.has(msg.type)) {
      ipcRenderer.send("superhive:out", msg);
    }
  },

  on: (cb: (msg: unknown) => void) => {
    const handler = (_: unknown, msg: unknown) => cb(msg);
    ipcRenderer.on("superhive:in", handler);
    return () => ipcRenderer.off("superhive:in", handler);
  },

  onAgentExit: (cb: (code: number) => void) => {
    const handler = (_: unknown, code: number) => cb(code);
    ipcRenderer.on("agent:exited", handler);
    return () => ipcRenderer.off("agent:exited", handler);
  },

  restartAgent: () => {
    ipcRenderer.send("agent:restart");
  },

  getApiKey: (): Promise<string | null> => ipcRenderer.invoke("api-key:get"),

  setApiKey: (key: string): Promise<boolean> => ipcRenderer.invoke("api-key:set", key),
});
