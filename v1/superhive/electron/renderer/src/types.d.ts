export interface SuperHiveWindow {
  send: (msg: { type: string; payload?: unknown }) => void;
  on: (cb: (msg: unknown) => void) => () => void;
  onAgentExit: (cb: (code: number) => void) => () => void;
  restartAgent: () => void;
}

declare global {
  interface Window {
    superhive: SuperHiveWindow;
  }
}

export {};
